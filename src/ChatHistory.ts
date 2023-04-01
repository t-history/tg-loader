// class for loading and updating telegram chat using TDLib
import Datastore from 'nedb-promises'
import path from 'path'
import { type Client } from 'tdl'
import ProgressBar from 'progress'

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

  async writeMassageToDb (message: Message): Promise<void> {
    const messageWithId: LMessage = {
      ...message,
      _id: message.id
    }

    const doc = this.chatHistoryCollection.findOne({ _id: messageWithId._id })

    if (doc === null) {
      await this.chatHistoryCollection.insert(message)
    } else {
      // TODO: update message if it's changed
    }
  }

  async fetchMessageChunk (fromMessageId: number): Promise<number | null> {
    const messageChunk: Messages = await this.client.invoke({
      _: 'getChatHistory',
      chat_id: this.chatId,
      from_message_id: fromMessageId,
      offset: 0,
      limit: 100,
      only_local: false
    })

    if (messageChunk.total_count === 0) {
      return null
    }

    const messages = messageChunk.messages
    for await (const message of messages) {
      if (message == null) break
      await this.writeMassageToDb(message)
    }

    const minMessage = messages[messages.length - 1]
    if (minMessage == null) {
      throw new Error('minMessageId is null')
    }

    return minMessage.id
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

  async fetchChatHistory (remainingIterations: number, fromMessageId?: number, hideProgressBar: boolean = false): Promise<void> {
    fromMessageId = fromMessageId ?? await this.findOldestMessageId() ?? 0

    const barTemplate = `Loading chat: ${this.chatId} (iteration :i) [:bar:percent] :etas`

    const bar = new ProgressBar(barTemplate, {
      width: 20,
      total: remainingIterations,
      clear: hideProgressBar
    })

    let i
    for (i = 0; i < remainingIterations; i++) {
      bar.tick({ i: i + 1 })

      const minMessageId = await this.fetchMessageChunk(fromMessageId)
      if (minMessageId == null) break
      fromMessageId = minMessageId

      await new Promise(resolve => setTimeout(resolve, 600))
    }

    // if there are remaining iterations, tick the bar to the end
    if (i < remainingIterations) {
      bar.tick({ i: remainingIterations })
    }
    bar.terminate()

    console.log(`Chat ${this.chatId} loaded`)
  }
}

export default ChatHistory
