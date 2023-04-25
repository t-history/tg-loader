import { type WithId, type Collection } from 'mongodb'
import Database from '../db'
import config from '../config'
import { type DbMessage } from '../ChatHistory'

const dbClient = new Database(config.mongoConnection)

interface Class {
  collection: Collection<DbMessage>
}

class Class {
  constructor (dbClient: Database) {
    if (dbClient.db == null) {
      throw new Error('For init ChatList dbClient must be connected')
    }
    this.collection = dbClient.db.collection('messages')
  }

  async updateMessageInDb (message: WithId<DbMessage>): Promise<void> {
    const updateDate = new Date()
    await this.collection.updateOne({ _id: message._id }, {
      $set: {
        lastUpdate: updateDate
      }
    })
  }

  async updateAllMessages (): Promise<void> {
    await this.collection.updateMany({}, { $set: { lastUpdate: new Date() } })

    console.log('All messages updated')
    // const messages = await this.collection.find({}).toArray()
    // for (const message of messages) {
    //   await this.updateMessageInDb(message)
    //   console.log(`Message ${String(message.id)}`)
    // }
  }

  // async updateMessage (message: WithId<DbMessage>): Promise<void> {
  //   await this.updateMessageInDb(message)
  // }
}

async function main (): Promise<void> {
  await dbClient.connect('thistory')

  const chatList = new Class(dbClient)
  await chatList.updateAllMessages()

  // const message = await chatList.collection.findOne({ id: 278927507456 })
  // if (message == null) throw new Error('Message not found')
  // await chatList.updateMessage(message)
}

main().catch(console.error)
