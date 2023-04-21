import { MongoClient, type Db, type Collection } from 'mongodb'

class Database {
  // private static readonly instance: Database | undefined
  public client: MongoClient | undefined
  public db: Db | undefined
  private readonly url: string

  public constructor (url: string) {
    this.url = url
  }

  async connect (dbName: string): Promise<void> {
    this.client = await MongoClient.connect(this.url)

    await this.client.connect()
    this.db = this.client.db(dbName)
  }

  // TO DO fix return type of getCollection
  getCollection<T extends Collection>(collectionName: string): Collection<T> {
    if (this.db == null) throw new Error('Database is not connected')
    return this.db.collection<T>(collectionName)
  }
}

export default Database
