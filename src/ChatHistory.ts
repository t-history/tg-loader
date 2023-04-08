// class for loading and updating telegram chat using TDLib
import Datastore from 'nedb-promises'
import path from 'path'
import { type Client } from 'tdl'
import { type Messages, type Message } from 'tdlib-types'

interface LMessage extends Message {
  _id: number
}

interface ChatHistory {
  chatId: number
  chatHistoryCollection: Datastore<LMessage>
  fromMessageId: number
  client: Client
}

class ChatHistory {
  constructor (client: Client, chatId: number) {
    const filename = path.join(__dirname, `../db/chats/${chatId}.db`)

    this.client = client
    this.chatId = chatId
    this.chatHistoryCollection = Datastore.create({ filename, autoload: true })
  }

  async writeMassageToDb (message: Message): Promise<string> {
    const doc = this.findMessageById(message.id)

    if (doc === null) {
      const messageWithId: LMessage = {
        ...message,
        _id: message.id
      }
      await this.chatHistoryCollection.insert(messageWithId)

      return 'inserted'
    } else {
      return 'updated'
      // TODO: update message if it's changed
    }
  }

  async findMessageById (messageId: number): Promise<LMessage | null> {
    return await this.chatHistoryCollection.findOne({ _id: messageId })
  }

  async requestMessageChunk (fromMessageId: number): Promise<Array<Message | undefined>> {
    const messageChunk: Messages = await this.client.invoke({
      _: 'getChatHistory',
      chat_id: this.chatId,
      from_message_id: fromMessageId,
      offset: 0,
      limit: 100,
      only_local: false
    })

    return messageChunk.messages
  }

  async writeMessageChunk (messages: Array<Message | undefined>): Promise<void> {
    for await (const message of messages) {
      if (message == null) break
      await this.writeMassageToDb(message)
    }
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

  async findOldestMessage (): Promise<LMessage | null> {
    const oldestMessage = await this.chatHistoryCollection
      .findOne({})
      .sort({ id: 1 })

    return oldestMessage
  }

  async findOldestMessageId (): Promise<number | null> {
    const oldestMessage = await this.findOldestMessage()

    return oldestMessage?._id ?? null
  }

  // async fetchChatHistory (
  //   remainingIterations: number,
  //   fromMessageId: number,
  //   depth: 'full' | 'sync' | number
  // ): Promise<number | null> {
  //   for (let i = 0; i < remainingIterations; i++) {
  //     const minMessageId = await this.fetchMessageChunk(fromMessageId)
  //     if (minMessageId == null) break
  //     fromMessageId = minMessageId

  //     await new Promise(resolve => setTimeout(resolve, 600))
  //   }

  //   return null
  // }
}

export default ChatHistory
