// class for loading and updating telegram chat list using TDLib
import { type Client as TgClient } from 'tdl'
import { type Chat } from 'tdlib-types'
import { type Collection } from 'mongodb'
import type Database from './db'

interface ChatList {
  chatCollection: Collection<Chat>
  tgClient: TgClient
}

class ChatList {
  constructor (tgClient: TgClient, dbClient: Database) {
    if (dbClient.db == null) {
      throw new Error('For init ChatList dbClient must be connected')
    }
    this.tgClient = tgClient
    this.chatCollection = dbClient.db.collection('chats')
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

  async writeChatToDb (chat: Chat): Promise<void> {
    await this.chatCollection.updateOne(
      { id: chat.id },
      { $set: chat },
      { upsert: true }
    )
  }

  async findChatById (chatId: number): Promise<Chat | null> {
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
