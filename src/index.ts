const path = require('node:path');
import Datastore from 'nedb-promises'

const { Client } = require('tdl')
const { TDLib } = require('tdl-tdlib-addon')
import { Chat , Messages, Message} from "tdlib-types";

require('dotenv').config()

const testChatId:number | undefined = process.env.TEST_CHAT_ID ? parseInt(process.env.TEST_CHAT_ID) : undefined
const testMessageId:number | undefined = process.env.TEST_MESSAGE_ID ? parseInt(process.env.TEST_MESSAGE_ID) : undefined

const apiId:number | undefined = process.env.API_ID ? parseInt(process.env.API_ID) : undefined
const apiHash:string | undefined = process.env.API_HASH
const tdl = new TDLib(path.join(__dirname, 'bin/libtdjson.dylib'))

if (!apiId || !apiHash) {
  throw new Error('API_ID or API_HASH is not set')
}

const client = new Client(tdl, {
  apiId,
  apiHash
})

interface CollectionObject {
  _id: string;
  [key: string]: any;
}

async function insertIfNotExists<T extends CollectionObject>(collection: Datastore<T>, record:T) {
  const doc = await collection.findOne({ _id: record._id })
  
  if (!doc) {
    console.log('Inserting new object:', record._id)
    collection
      .insert(record)
      .then((newDoc) => console.log('Added new object:', newDoc))
      .catch((err) => console.log(err))
  }
}

async function getChats() {
  const chats = await client.invoke({
    _: 'getChats',
    chat_list: { _: 'chatListMain' },
    limit: 4000
  })
  const chatIds = chats.chat_ids.map((id:number) => Object({_id: id}))
  
  const filename = path.join(__dirname, `../db/chats.db`)
  const chatsCollection = await Datastore.create({ filename, autoload: true });

  chatIds.forEach((chat: Chat & CollectionObject) => {
    insertIfNotExists(chatsCollection, chat)
  })

  return chats
}

async function getChat(chatId:number) {
  console.log('Getting chat')

  client.invoke({
    _: 'getChatHistory',
    chat_id: chatId,
    from_message_id: testMessageId,
    offset: 0,
    limit: 100,
    only_local: false
  })
  .then(async (chat: Messages) => {
    console.log(`Chat ID: ${chatId}`)
    console.log(`Messages count:`, chat.total_count)
    
    console.log('Writing chat to file')
    const filename = path.join(__dirname, `../db/chats/${chatId}.db`)
    const chatCollection = await Datastore.create({ filename, autoload: true });

    chat.messages.forEach((message: Message | undefined) => {
      if (!message) return

      const messageWithId: Message & CollectionObject = {
        ...message,
        _id: String(message.id),
      }

      insertIfNotExists(chatCollection, messageWithId)
    })

    console.log('Chat written to file')
  })
  .catch((err: Error) => {
    console.log(err)
  })
}

async function main() {
  await client.login()
  const chats = await getChats()
  const chatId = testChatId
  chatId && await getChat(chatId)
}

main()
