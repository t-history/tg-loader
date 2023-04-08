import config from './config'
import client from './client'
import ChatHistory from './ChatHistory'
import ChatList from './ChatList'

import { Queue, Worker, type Job } from 'bullmq'
import IORedis from 'ioredis'

interface ChatListJob {
  chatId: number
  depth: 'full' | 'sync' | number
}

interface MessagesJob extends ChatListJob {
  fromMessageId: number
  toMessageId?: number
}

const connection = new IORedis(config.redisConnection)

const queue = new Queue('chatHistoryQueue', {
  connection
})

console.log(queue)

const getChatJob = async (job: ChatListJob): Promise<void> => {
  const { chatId, depth }: ChatListJob = job

  const chatListInstance = new ChatList(client)
  const oldChat = await chatListInstance.findChatById(chatId)
  const chat = await chatListInstance.fetchChat(chatId)

  const messageJob: MessagesJob = {
    chatId,
    fromMessageId: chat.last_message?.id ?? 0,
    depth
  }

  if (depth === 'sync') {
    messageJob.toMessageId = oldChat?.last_message?.id ?? 0
  }

  await queue.add('getMessages', messageJob)
}

const getMessagesJob = async (job: MessagesJob): Promise<void> => {
  const { chatId, depth, fromMessageId, toMessageId }: MessagesJob = job
  const chatHistoryInstance = new ChatHistory(client, chatId)
  const unixtime = Math.floor(Date.now() / 1000)

  const messageChunk = await chatHistoryInstance.requestMessageChunk(
    fromMessageId
  )

  let quite = false

  if (depth === 'sync' && toMessageId != null) {
    for await (const message of messageChunk) {
      if (message == null) break
      if (message.id <= toMessageId) {
        quite = true
        continue
      }

      const res = await chatHistoryInstance.writeMassageToDb(message)
      if (res === 'updated') {
        throw new Error('Message updated on sync')
      }
    }
  } else if (depth === 'full' || depth === 'sync') { // if toMessageId is null
    await chatHistoryInstance.writeMessageChunk(messageChunk)
  } else if (typeof depth === 'number') {
    for await (const message of messageChunk) {
      if (message == null) break
      if (message.date <= unixtime - depth) {
        quite = true
        continue
      }

      await chatHistoryInstance.writeMassageToDb(message)
    }
  } else {
    throw new Error('Unknown depth')
  }

  if (quite) {
    return
  }

  const oldestMessage = messageChunk[messageChunk.length - 1]

  if (oldestMessage != null) {
    const messageJob: MessagesJob = {
      chatId,
      fromMessageId: oldestMessage.id,
      toMessageId: toMessageId ?? undefined,
      depth
    }

    await queue.add('getMessages', messageJob)
  }
}

const worker = new Worker('chatHistoryQueue', async (job: Job) => {
  if (job.name === 'getChat') {
    const chatListJob: ChatListJob = job.data
    await getChatJob(chatListJob)
  }

  if (job.name === 'getMessages') {
    const messagesJob: MessagesJob = job.data
    await getMessagesJob(messagesJob)
  }
}, { connection })

worker.on('completed', (job: Job) => {
  const chatId: number = job.data.chatId
  if (job.id != null) {
    console.log(`Job ${job.name}:${job.id} completed for chat | ${chatId}`)
  }
})

async function main (): Promise<void> {
  await client.login()
}

main().catch((err: Error) => {
  console.log(err)
})
