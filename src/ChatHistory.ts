
import { type Client as TgClient } from 'tdl'
import { type Messages, type Message } from 'tdlib-types'
import type Database from './db'
import { type Collection, type WithId } from 'mongodb'
import { diff } from 'deep-diff'
import { calculateHash, copyObj } from './utils'

// th_removed excluded from with interface
export interface additionalMessageFields {
  th_history: any[]
  th_hash: string
  th_last_update: Date
}

export type DbMessage = Message & additionalMessageFields

interface ChatHistory {
  chatId: number
  collection: Collection<DbMessage>
  fromMessageId: number
  tgClient: TgClient
}

class ChatHistory {
  constructor (tgClient: TgClient, dbClient: Database, chatId: number) {
    if (dbClient.db == null) {
      throw new Error('For init ChatHistory dbClient must be connected')
    }
    this.tgClient = tgClient
    this.chatId = chatId
    this.collection = dbClient.db.collection('messages')
  }

  static stripDbFields (dbMessage: WithId<DbMessage>): Message {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { _id, th_history, th_hash, th_last_update, ...message } = dbMessage

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const additionalFields: additionalMessageFields = { th_history, th_hash, th_last_update } // for type check
    return message as Message
  }

  async getExistMessageIds (): Promise<number[]> {
    const existMessages = await this.collection.find({ chat_id: this.chatId }).project({ id: 1 }).toArray()
    return existMessages.map(message => message.id)
  }

  async markMessagesAsRemoved (ids: number[]): Promise<void> {
    await this.collection.updateMany({ id: { $in: ids } }, { $set: { th_removed: true } })
  }

  async updateMessageInDb (existingMessage: WithId<DbMessage>, message: Message): Promise<void> {
    const newHash = calculateHash(message)
    if (existingMessage.th_hash === newHash) return

    const copyExistingMessage = ChatHistory.stripDbFields(existingMessage)
    const diffMessages = diff(copyExistingMessage, message)
    const updateDate = new Date()
    const history = existingMessage.th_history

    if (diffMessages !== undefined) {
      history.push({
        diff: copyObj(diffMessages),
        dateInterval: {
          start: existingMessage.th_last_update,
          end: updateDate
        }
      })
    }

    const dbMessage: DbMessage = {
      ...message,
      th_hash: newHash,
      th_history: history,
      th_last_update: updateDate
    }

    await this.collection.updateOne({ _id: existingMessage._id }, { $set: dbMessage })
  }

  async insertMessageToDb (message: Message): Promise<void> {
    const hash = calculateHash(message)
    const dbMessage: DbMessage = {
      ...message,
      th_hash: hash,
      th_history: [],
      th_last_update: new Date()
    }
    await this.collection.insertOne(dbMessage)
  }

  async writeMassageToDb (message: Message): Promise<string> {
    const existingMessage: WithId<DbMessage> | null =
      await this.collection.findOne({ chat_id: this.chatId, id: message.id })

    if (existingMessage === null) {
      await this.insertMessageToDb(message)
      return 'inserted'
    } else {
      await this.updateMessageInDb(existingMessage, message)
      return 'updated'
    }
  }

  async requestMessageChunk (fromMessageId: number): Promise<Array<Message | undefined>> {
    const messageChunk: Messages = await this.tgClient.invoke({
      _: 'getChatHistory',
      chat_id: this.chatId,
      from_message_id: fromMessageId,
      offset: 0,
      limit: 100,
      only_local: false
    })

    return messageChunk.messages
  }

  async writeMessageChunk (messages: Array<Message | undefined>): Promise<number[]> {
    const onlyMessages = messages.filter(message => message !== undefined) as Message[]
    const ids = onlyMessages.map(message => message.id)

    const writePromise = messages
      .filter(message => message !== undefined)
      .map(async message => {
        return await this.writeMassageToDb(message as Message)
      })

    await Promise.all(writePromise)

    return ids
  }

  async fetchMessageChunk (fromMessageId: number): Promise<number | null> {
    const messages = await this.requestMessageChunk(fromMessageId)

    if (messages.length === 0) {
      return null
    }

    await this.writeMessageChunk(messages)

    const oldestMessage = messages[messages.length - 1]
    if (oldestMessage == null) {
      throw new Error('oldestMessage is null')
    }

    return oldestMessage.id
  }

  async findOldestMessage (): Promise<Message | null> {
    const messages = await this.collection
      .find({ chatId: this.chatId })
      .sort({ id: 1 })
      .limit(1)
      .toArray()

    return messages.length > 0 ? messages[0] : null
  }

  async findOldestMessageId (): Promise<number | null> {
    const oldestMessage = await this.findOldestMessage()

    return oldestMessage?.id ?? null
  }
}

export default ChatHistory
