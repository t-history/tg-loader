import { type Collection } from 'mongodb'
import Database from '../db'
import config from '../config'

const dbClient = new Database(config.mongoConnection)

interface Class {
  collectionM: Collection<any>
  collectionC: Collection<any>
}

class Class {
  constructor (dbClient: Database) {
    if (dbClient.db == null) {
      throw new Error('For init ChatList dbClient must be connected')
    }
    this.collectionM = dbClient.db.collection('messages')
    this.collectionC = dbClient.db.collection('chats')
  }

  async updateAllMessages (): Promise<void> {
    await this.collectionM.updateMany({}, {
      $rename: {
        history: 'th_history',
        hash: 'th_hash',
        lastUpdate: 'th_last_update'
      }
    })

    console.log('All messages updated')
  }

  async updateAllChats (): Promise<void> {
    await this.collectionC.updateMany({}, {
      $rename: {
        history: 'th_history',
        hash: 'th_hash',
        status: 'th_status',
        lastUpdate: 'th_last_update'
      }
    })

    console.log('All chats updated')
  }
}

async function main (): Promise<void> {
  await dbClient.connect('thistory')

  const instance = new Class(dbClient)
  await instance.updateAllMessages()
  await instance.updateAllChats()
}

main().catch(console.error)
