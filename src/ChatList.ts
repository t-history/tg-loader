// class for loading and updating telegram chat list using TDLib
import Datastore from 'nedb-promises'
import path from 'path'
import { type Client } from 'tdl'
import { type Chat } from 'tdlib-types'
import ProgressBar from 'progress'

interface LChat extends Chat {
  _id: number
}

interface ChatList {
  chatCollection: Datastore<Chat>
  client: Client
}

class ChatList {
  constructor (client: Client) {
    const filename = path.join(__dirname, '../db/chats.db')

    this.client = client
    this.chatCollection = Datastore.create({ filename, autoload: true })
  }

  async fetchChatList (): Promise<number[]> {
    const chats = await this.client.invoke({
      _: 'getChats',
      chat_list: { _: 'chatListMain' },
      limit: 4000
    })

    return chats.chat_ids
  }

  async fetchChat (id: number): Promise<Chat> {
    return await this.client.invoke({
      _: 'getChat',
      chat_id: id
    })
  }

  async writeChatToDb (chat: Chat): Promise<void> {
    const chatWithId: LChat = {
      ...chat,
      _id: chat.id
    }

    const doc = await this.chatCollection.findOne({ _id: chatWithId.id })

    if (doc === null) {
      await this.chatCollection.insert(chatWithId)
    } else {
      // TODO: update chat if it's changed
    }
  }

  async fetchChats (): Promise<void> {
    const chatsIds = await this.fetchChatList()

    const bar = new ProgressBar('Loading :i/:total: [:bar:percent] :etas', {
      complete: '=',
      incomplete: ' ',
      width: 20,
      total: chatsIds.length
    })

    for (let i = 0; i < chatsIds.length; i++) {
      bar.tick({
        i: i + 1
      })

      const chatId = chatsIds[i]
      const chat: Chat = await this.fetchChat(chatId)
      await this.writeChatToDb(chat)
    }

    bar.terminate()
  }
}

export default ChatList
