import config from './config'
import tgClient from './client'
import Database from './db'
import ChatHistory from './ChatHistory'
import ChatList from './ChatList'

import { Queue, Worker, type Job, MetricsTime } from 'bullmq'
import IORedis, { type RedisOptions } from 'ioredis'

const dbClient = new Database(config.mongoConnection)

interface ChatListJob {
  chatId: number
  depth: 'full' | 'sync' | number
}

interface MessagesJob extends ChatListJob {
  fromMessageId: number
  toMessageId?: number
}

const redisConfig: RedisOptions = {
  port: config.redisPort,
  host: config.redisHost,
  maxRetriesPerRequest: null
}

if (config.redisUser !== null) {
  redisConfig.username = config.redisUser
}

if (config.redisPass !== null) {
  redisConfig.password = config.redisPass
}

const connection = new IORedis({
  port: config.redisPort,
  host: config.redisHost,
  // username: config.redisUser,
  // password: config.redisPass,
  maxRetriesPerRequest: null
})

// queue for chat history
const queue = new Queue('chatHistoryQueue', { connection })

const getMessagesJob = async (job: MessagesJob): Promise<void> => {
  const { chatId, depth, fromMessageId, toMessageId }: MessagesJob = job
  const chatHistoryInstance = new ChatHistory(tgClient, dbClient, chatId)
  const unixtime = Math.floor(Date.now() / 1000)

  const messageChunk = await chatHistoryInstance.requestMessageChunk(
    fromMessageId
  )

  let quite = false

  if (toMessageId != null) {
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

  if (messageChunk.length === 0) {
    console.log(`Chat ${chatId} is synced`)
    quite = true
  }

  if (quite) {
    console.log(`Chat ${chatId} is synced`)
    // TODO rewrite to ChatItem class
    const chatListInstance = new ChatList(tgClient, dbClient)
    const chat = await chatListInstance.findChatById(chatId)
    if (chat == null) throw new Error('Chat not found')
    await chatListInstance.chatCollection.updateOne({ _id: chat._id }, { $set: { th_status: 'idle' } })

    return
  }

  if (messageChunk.length === 0) {
    console.log(`Chat ${chatId} is synced`)
  }

  const oldestMessage = messageChunk[messageChunk.length - 1]

  if (oldestMessage == null) {
    throw new Error('Oldest message is null')
  }

  const messageJob: MessagesJob = {
    chatId,
    fromMessageId: oldestMessage.id,
    toMessageId: toMessageId ?? undefined,
    depth
  }

  await queue.add('getMessages', messageJob)
}

const worker = new Worker('chatHistoryQueue', async (job: Job) => {
  if (job.name === 'getMessages') {
    const messagesJob: MessagesJob = job.data
    await getMessagesJob(messagesJob)
  }
}, {
  connection,
  limiter: {
    max: 5,
    duration: 1000
  },
  metrics: {
    maxDataPoints: MetricsTime.ONE_WEEK * 2
  }
})

worker.on('completed', (job: Job) => {
  const chatId: number = job.data.chatId
  if (job.id != null) {
    console.log(`Job ${job.name}:${job.id} completed for chat | ${chatId}`)
  }
})

// queue for chat list
const chatQueue = new Queue('chatQueue', { connection })

const getChatListJob = async (): Promise<void> => {
  const chatListInstance = new ChatList(tgClient, dbClient)
  const chatIds = await chatListInstance.fetchChatList()
  const notIdleChatIds = await chatListInstance.getNotIdleChatList()
  const chatIdsToSync = chatIds.filter((chatId) => !notIdleChatIds.includes(chatId))

  for (const chatId of chatIdsToSync) {
    const chatListJob: ChatListJob = {
      chatId,
      depth: 'sync'
    }

    await chatListInstance.updateChatStatus(chatId, 'queued')
    await chatQueue.add('getChat', chatListJob)
  }
}

const getChatJob = async (job: ChatListJob): Promise<void> => {
  const { chatId, depth }: ChatListJob = job

  const chatListInstance = new ChatList(tgClient, dbClient)
  const oldChat = await chatListInstance.findChatById(chatId)
  const chat = await chatListInstance.fetchChat(chatId)

  if (
    chat.type._ !== 'chatTypePrivate' ||
    chat.last_message == null ||
    (chat.last_message.id === oldChat?.last_message?.id && depth === 'sync')
  ) {
    await chatListInstance.updateChatStatus(chatId, 'idle')
    return
  }

  const chatHistoryInstance = new ChatHistory(tgClient, dbClient, chatId)
  await chatHistoryInstance.writeMassageToDb(chat.last_message)

  const messageJob: MessagesJob = {
    chatId,
    fromMessageId: chat.last_message.id ?? 0,
    depth
  }

  if (depth === 'sync') {
    messageJob.toMessageId = oldChat?.last_message?.id ?? 0
  }

  await queue.add('getMessages', messageJob)
}

const chatWorker = new Worker('chatQueue', async (job: Job) => {
  if (job.name === 'getChat') {
    const chatListJob: ChatListJob = job.data
    await getChatJob(chatListJob)
  }

  if (job.name === 'getChatList') {
    await getChatListJob()
  }
}, {
  connection,
  limiter: {
    max: 20,
    duration: 1000
  },
  metrics: {
    maxDataPoints: MetricsTime.ONE_WEEK * 2
  }
})

chatWorker.on('completed', (job: Job) => {
  if (job.id != null) {
    console.log(`Job ${job.name}:${job.id} completed`)
  }
})

async function main (): Promise<void> {
  await connection.flushdb()
  console.log('Queue flushed')

  await dbClient.connect('thistory')

  // hack for reset status if server was down on in progress
  if (dbClient.db !== undefined) {
    await dbClient.db.collection('chats').updateMany({}, { $set: { th_status: 'idle' } })
  }

  await chatQueue.add('getChatList', {})
  await chatQueue.add('getChatList', {}, { repeat: { every: 1000 * 60 * 5 } })

  if (dbClient.db != null) {
    await dbClient.db.collection('messages').createIndex({ chatId: 1 })
    await dbClient.db.collection('messages').createIndex({ chatId: 1, id: 1 })
    await dbClient.db.collection('messages').createIndex({ id: 1 })

    await dbClient.db.collection('chats').createIndex({ id: 1 })
    await dbClient.db.collection('chats').createIndex({ th_status: 1 })
  }
  // add index for chatId

  // const chatListInstance = new ChatList(tgClient, dbClient)
  // const chatIds = await chatListInstance.fetchChatList()

  // for (const chatId of chatIds) {
  //   const chatListJob: ChatListJob = {
  //     chatId,
  //     depth: 'full'
  //   }

  //   await queue.add('getChat', chatListJob)
  // }

  // const chatHistoryInstance = new ChatHistory(tgClient, dbClient, 464028197)
  // await chatHistoryInstance.fetchMessageChunk(0)

  // getMessagesJob({
  //   chatId: 464028197,
  //   fromMessageId: 0,
  //   depth: 'full'
  // })
}

main().catch(console.log)
