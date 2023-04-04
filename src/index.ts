import config from './config'
import client from './client'
import ChatHistory from './ChatHistory'
import ChatList from './ChatList'

import { Queue, Worker, type Job } from 'bullmq'
import IORedis from 'ioredis'

interface ChatListJob {
  chatId: number
  fromMessageId: number
}

const connection = new IORedis(config.redisConnection)

const queue = new Queue('chatHistoryQueue', {
  connection
})

console.log(queue)

const worker = new Worker('chatHistoryQueue', async (job: Job) => {
  if (job.name === 'chatHistory') {
    const { chatId, fromMessageId }: ChatListJob = job.data
    const chatHistoryInstance = new ChatHistory(client, chatId)
    await chatHistoryInstance.fetchChatHistory(
      config.iterationForChat,
      fromMessageId
    )
  }
}, { connection })

worker.on('completed', (job: Job) => {
  const chatId: number = job.data.chatId
  if (job.id != null) {
    console.log(`Job ${job.id} completed with return value | ${chatId}`)
  }
})

async function main (): Promise<void> {
  await client.login()

  const chatListInstance = new ChatList(client)
  await chatListInstance.fetchChats()

  const chats = await chatListInstance.chatCollection.find({ 'type._': 'chatTypePrivate' }, { id: 1, 'last_message.id': 1 })

  const chat = chats[0]
  await queue.add('chatHistory', { chatId: chat.id, fromMessageId: chat.last_message?.id ?? 0 })
  // await queue.addBulk(chats.map(
  //   chat => ({
  //     name: 'chatHistory',
  //     data: { chatId: chat.id, fromMessageId: chat.last_message?.id ?? 0 }
  //   }))
  // )
}

main().catch((err: Error) => {
  console.log(err)
})
