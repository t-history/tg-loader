// class for loading and updating telegram chat list using TDLib
import { type Client as TgClient } from 'tdl'
import { type Chat } from 'tdlib-types'
import { type Collection, type WithId } from 'mongodb'
import type Database from './db'
import { copyObj, calculateHash } from './utils'
import { diff } from 'deep-diff'

type ChatStatus = 'queued' | 'in_progress' | 'idle'

export interface additionalChatFields {
  th_history: any[]
  th_hash: string
  th_status: ChatStatus
  th_last_update: Date
}

export type DbChat = Chat & additionalChatFields

interface ChatList {
  chatCollection: Collection<DbChat>
  tgClient: TgClient
}

type OmitExcessFields<T> = {
  [K in keyof T as Exclude<K,
  'last_message'
  >]: T[K]
}

class ChatList {
  constructor (tgClient: TgClient, dbClient: Database) {
    if (dbClient.db == null) {
      throw new Error('For init ChatList dbClient must be connected')
    }
    this.tgClient = tgClient
    this.chatCollection = dbClient.db.collection('chats')
  }

  stripDbFields (dbChat: WithId<DbChat>): Chat {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { _id, th_history, th_hash, th_status, th_last_update, ...chat } = dbChat

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const additionalFields: additionalChatFields = { th_history, th_hash, th_status, th_last_update } // for type checking
    return chat
  }

  async writeExistChatMessageIds (chatId: number, ids: number[], firstNewId: number): Promise<void> {
    await this.chatCollection.updateOne({ id: chatId }, { $set: { th_old_message_ids: ids, th_new_message_ids: [firstNewId] } })
  }

  async pushNewChatMessageIds (chatId: number, ids: number[]): Promise<void> {
    await this.chatCollection.updateOne({ id: chatId }, { $push: { th_new_message_ids: { $each: ids } } })
  }

  async getDiffChatMessageIds (chatId: number): Promise<number[]> {
    return await this.chatCollection.aggregate([
      { $match: { id: chatId } },
      { $project: { diff: { $setDifference: ['$th_old_message_ids', '$th_new_message_ids'] } } }
    ]).toArray().then(([{ diff }]) => diff)
  }

  getChatWithoutExcessFields (chat: Chat): OmitExcessFields<Chat> {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { last_message, ...strippedChat } = chat
    return strippedChat
  }

  async fetchChatList (): Promise<number[]> {
    const chats = await this.tgClient.invoke({
      _: 'getChats',
      chat_list: { _: 'chatListMain' },
      limit: 4000
    })

    return chats.chat_ids
  }

  async fetchChat (id: number): Promise<Chat> {
    const chat: Chat = await this.tgClient.invoke({
      _: 'getChat',
      chat_id: id
    })
    await this.writeChatToDb(chat)
    return chat
  }

  async updateChatStatus (id: number, status: ChatStatus): Promise<void> {
    await this.chatCollection.updateOne({ id }, { $set: { th_status: status } })
  }

  async writeChatToDb (chat: Chat): Promise<string> {
    const existingChat = await this.chatCollection.findOne({ id: chat.id })

    if (existingChat == null) {
      await this.insertChatToDb(chat)
      return 'inserted'
    }

    if (existingChat.th_status === 'queued') {
      await this.updateChatInDb(existingChat, chat)
      return 'updated'
    }

    console.error(`Chat ${chat.id} is already in progress`)
    return 'skipped'
  }

  async updateChatInDb (existingChat: WithId<DbChat>, chat: Chat): Promise<void> {
    const strippedChat = this.getChatWithoutExcessFields(chat)
    const newHash = calculateHash(strippedChat)
    if (existingChat.th_hash === newHash) return

    const copyExistingChat = this.stripDbFields(existingChat)
    const diffChats = diff(copyExistingChat, chat)
    const updateDate = new Date()
    const history = existingChat.th_history

    if (diffChats !== undefined) {
      history.push({
        diff: copyObj(diffChats),
        dateInterval: {
          start: existingChat.th_last_update,
          end: updateDate
        }
      })
    }

    const dbChat: DbChat = {
      ...chat,
      th_hash: newHash,
      th_history: history,
      th_status: 'in_progress',
      th_last_update: updateDate
    }

    await this.chatCollection.updateOne({ _id: existingChat._id }, { $set: dbChat })
  }

  // async getIdleChatList (): Promise<number[]> {
  //   const idleChats = await this.chatCollection.find({ status: 'idle' }).toArray()
  //   const idleChatsId = idleChats.map(chat => chat.id)
  //   return idleChatsId
  // }

  async getNotIdleChatList (): Promise<number[]> {
    const idleChats = await this.chatCollection.find({ th_status: { $ne: 'idle' } }).toArray()
    const idleChatsId = idleChats.map(chat => chat.id)
    return idleChatsId
  }

  async setChatStatus (id: number, status: ChatStatus): Promise<void> {
    await this.chatCollection.updateOne({ id }, { $set: { th_status: status } })
  }

  async insertChatToDb (chat: Chat): Promise<void> {
    const strippedChat = this.getChatWithoutExcessFields(chat)
    const hash = calculateHash(strippedChat)
    const dbChat: DbChat = {
      ...chat,
      th_hash: hash,
      th_history: [],
      th_status: 'in_progress',
      th_last_update: new Date()
    }

    await this.chatCollection.insertOne(dbChat)
  }

  async findChatById (chatId: number): Promise<WithId<DbChat> | null> {
    const chat = await this.chatCollection.findOne({ id: chatId })

    return chat
  }

  // async fetchChats (): Promise<void> {
  //   const chatsIds = await this.fetchChatList()
  //   console.log('Fetched', chatsIds)
  //   for (let i = 0; i < chatsIds.length; i++) {
  //     const chatId = chatsIds[i]
  //     await this.fetchChat(chatId)
  //     console.log(`Chat ${i + 1} of ${chatsIds.length} fetched`)
  //   }
  // }
}

export default ChatList
