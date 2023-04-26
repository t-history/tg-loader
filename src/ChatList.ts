// class for loading and updating telegram chat list using TDLib
import { type Client as TgClient } from 'tdl'
import { type Chat } from 'tdlib-types'
import { type Collection, type WithId } from 'mongodb'
import type Database from './db'
import { copyObj, calculateHash } from './utils'
import { diff } from 'deep-diff'

export interface additionalChatFields {
  history: any[]
  hash: string
  status: 'queued' | 'in_progress' | 'idle'
  lastUpdate: Date
}

export type DbChat = Chat & additionalChatFields

interface ChatList {
  chatCollection: Collection<DbChat>
  tgClient: TgClient
}

type OmitExcessFields<T> = {
  [K in keyof T as Exclude<K,
  'last_message' |
  'last_read_inbox_message_id' |
  'last_read_outbox_message_id'
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
    const { _id, history, hash, status, lastUpdate, ...chat } = dbChat

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const additionalFields: additionalChatFields = { history, hash, status, lastUpdate } // for type checking
    return chat
  }

  getChatWithoutExcessFields (chat: Chat): OmitExcessFields<Chat> {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { last_message, last_read_inbox_message_id, last_read_outbox_message_id, ...strippedChat } = chat
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

  async writeChatToDb (chat: Chat): Promise<string> {
    const existingChat = await this.chatCollection.findOne({ id: chat.id })

    if (existingChat == null) {
      await this.insertChatToDb(chat)
      return 'inserted'
    }

    if (existingChat.status === 'queued') {
      await this.updateChatInDb(existingChat, chat)
      return 'updated'
    }

    console.error(`Chat ${chat.id} is already in progress`)
    return 'skipped'
  }

  async updateChatInDb (existingChat: WithId<DbChat>, chat: Chat): Promise<void> {
    const strippedChat = this.getChatWithoutExcessFields(chat)
    const newHash = calculateHash(strippedChat)
    if (existingChat.hash === newHash) return

    const copyExistingChat = this.stripDbFields(existingChat)
    const diffChats = diff(copyExistingChat, chat)
    const updateDate = new Date()
    const history = existingChat.history

    if (diffChats !== undefined) {
      history.push({
        diff: copyObj(diffChats),
        dateInterval: {
          start: existingChat.lastUpdate,
          end: updateDate
        }
      })
    }

    const dbChat: DbChat = {
      ...chat,
      hash: newHash,
      history,
      status: 'in_progress',
      lastUpdate: updateDate
    }

    await this.chatCollection.updateOne({ _id: existingChat._id }, { $set: dbChat })
  }

  async insertChatToDb (chat: Chat): Promise<void> {
    const strippedChat = this.getChatWithoutExcessFields(chat)
    const hash = calculateHash(strippedChat)
    const dbChat: DbChat = {
      ...chat,
      hash,
      history: [],
      status: 'in_progress',
      lastUpdate: new Date()
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
