const path = require('node:path');
import Datastore from 'nedb-promises'

const { Client } = require('tdl')
const { TDLib } = require('tdl-tdlib-addon')
import { Chat , Messages, Message} from "tdlib-types";

require('dotenv').config()

const testChatId:number | undefined = process.env.TEST_CHAT_ID ? parseInt(process.env.TEST_CHAT_ID) : undefined
const testMessageId:number | undefined = process.env.TEST_MESSAGE_ID ? parseInt(process.env.TEST_MESSAGE_ID) : undefined
const apiDelay:number = process.env.API_DELAY ? parseInt(process.env.API_DELAY) : 1200
const iterationForChat:number = process.env.ITERATION_FOR_CHAT ? parseInt(process.env.ITERATION_FOR_CHAT) : 50

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
  _id: number;
  [key: string]: any;
}

async function insertIfNotExists<T extends CollectionObject>(collection: Datastore<T>, record:T) {
  const doc = await collection.findOne({ _id: record._id })
  
  if (!doc) {
    collection
      .insert(record)
      .catch((err) => console.log(err))
  }
}

async function getChats(chatsCollection:Datastore<Chat>) {
  const chats = await client.invoke({
    _: 'getChats',
    chat_list: { _: 'chatListMain' },
    limit: 4000
  })
  const chatIds = chats.chat_ids.map((id:number) => Object({_id: id}))

  chatIds.forEach((chat: Chat & CollectionObject) => {
    insertIfNotExists(chatsCollection, chat)
  })

  return chatIds
}

function getChat(chatId:number, fromMessageId:number, chatCollection:Datastore<Message & CollectionObject>) {
  console.log('Getting chat')

  return client.invoke({
    _: 'getChatHistory',
    chat_id: chatId,
    from_message_id: fromMessageId,
    offset: 0,
    limit: 100,
    only_local: false
  })
  .then(async (chat: Messages) => {
    chat.messages.forEach((message: Message | undefined) => {
      if (!message) return

      const messageWithId: Message & CollectionObject = {
        ...message,
        _id: message.id,
      }

      insertIfNotExists(chatCollection, messageWithId)
    })

    return chat.total_count
  })
  .catch((err: Error) => {
    console.log(err)
  })
}

async function getChatLoop(chatId:number, i:number, chatCollection:Datastore<Message & CollectionObject>) {
  const doc = await chatCollection
    .findOne({})
    .sort({ id: 1 })

  const fromMessageId = doc ? Number(doc._id) : testMessageId || 0
  
  return new Promise((resolve) => {
    getChat(chatId, fromMessageId, chatCollection)
      .then((messageCount: Number) => {
        if (messageCount === 0 || i === 0) return resolve(i)
        setTimeout(() => {
          getChatLoop(chatId, i - 1, chatCollection).then(
            (value) => resolve(value)
          )
        }, apiDelay)
      })
  })
}

async function processChats(chats: CollectionObject[], chatsCollection:Datastore<Chat>) {

  for (let i = 0; i < chats.length; i++) {
    const chat = chats[i];
    const _id = Number(chat._id);

    const chatInfo = await getChatInfo(_id, chatsCollection)
    if (chatInfo.type._ !== "chatTypePrivate") {
      console.log(`Chat ID: ${_id} is not private. Skipping`)
      continue
    }
    
    const filename = path.join(__dirname, `../db/chats/${_id}.db`)
    const chatCollection = await Datastore.create({ filename, autoload: true });
    
    console.log(`Chat ID: ${_id}   ${i + 1}/${chats.length}`);
    const res = await getChatLoop(_id, iterationForChat, chatCollection);
    console.log(`Chat ID: ${_id} done. ${res} iterations`);
  }
}

async function getChatInfo(chatId:number, chatsCollection:Datastore<Chat & CollectionObject>) {
  const chat =  await client.invoke({
    _: 'getChat',
    chat_id: chatId
  })

  const res = await chatsCollection.update({ _id: Number(chat.id) }, chat)
  console.log(res)

  return chat
}

async function main() {
  await client.login()

  const filename = path.join(__dirname, `../db/chats.db`)
  const chatsCollection = await Datastore.create({ filename, autoload: true });

  const chatIds = await getChats(chatsCollection)
  
  processChats(chatIds, chatsCollection)
}

main()
