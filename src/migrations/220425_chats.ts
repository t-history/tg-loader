// class for loading and updating telegram chat list using TDLib
import { type Chat } from 'tdlib-types'
import { type Collection, type WithId } from 'mongodb'
import { calculateHash } from '../utils'
import Database from '../db'
import config from '../config'

const dbClient = new Database(config.mongoConnection)

type DbChat = Chat & {
  history?: any[]
  hash?: string
  status: 'queued' | 'in_progress' | 'idle'
  lastUpdate?: Date
}

interface ChatList {
  chatCollection: Collection<DbChat>
}

class ChatList {
  constructor (dbClient: Database) {
    if (dbClient.db == null) {
      throw new Error('For init ChatList dbClient must be connected')
    }
    this.chatCollection = dbClient.db.collection('chats')
  }

  stripDbFields (dbChat: WithId<DbChat>): Chat {
    const { _id, ...chat } = dbChat
    return chat
  }

  async updateChatInDb (existingChat: WithId<DbChat>): Promise<string> {
    const newHash = calculateHash(existingChat)
    if (existingChat.hash === newHash) return 'unchanged'

    const dbChat: DbChat = {
      ...existingChat,
      hash: newHash,
      history: [],
      status: 'idle',
      lastUpdate: new Date()
    }

    await this.chatCollection.updateOne({ _id: existingChat._id }, { $set: dbChat })
    return 'updated'
  }

  async updateAllChats (): Promise<void> {
    const chats = await this.chatCollection.find({}).toArray()
    for (const chat of chats) {
      const res = await this.updateChatInDb(chat)
      console.log(`Chat ${String(chat.id)} ${res}`)
    }
  }

  // async updateChat (id: number): Promise<string> {
  //   const existingChat = await this.chatCollection.findOne({ id })
  //   if (existingChat == null) return 'not found'

  //   return await this.updateChatInDb(existingChat)
  // }
}

async function main (): Promise<void> {
  await dbClient.connect('thistory')

  const chatList = new ChatList(dbClient)
  await chatList.updateAllChats()
  // const res = await chatList.updateChat(401739365)
  // console.log(res)
}

main().catch(console.error)
