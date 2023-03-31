import path from 'path'
import Datastore from 'nedb-promises'
import ProgressBar from 'progress'

import { Chat , Messages, Message} from "tdlib-types"
import config from './config'
import client from './client'

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
  // console.log('Getting chat')

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

  const fromMessageId = doc ? Number(doc._id) : config.testMessageId || 0
  
  return new Promise((resolve) => {
    getChat(chatId, fromMessageId, chatCollection)
      .then((messageCount: number | void) => {
        if (messageCount === 0 || i === 0) return resolve(i)
        setTimeout(() => {
          getChatLoop(chatId, i - 1, chatCollection)
            .then(
              (value) => resolve(value)
            ).catch((err: Error) => {
              console.log(err)
            })
        }, config.apiDelay)
      })
      .catch((err: Error) => {
        console.log(err)
      })
  })
}

async function processChats(chats: CollectionObject[], chatsCollection:Datastore<Chat>) {

  const barTemplate = 'Processing chat :current/:total [:bar:percent] Chat ID: :id'
  const bar = new ProgressBar(barTemplate, {
    total: chats.length,
    width: 30
  })

  for (let i = 0; i < chats.length; i++) {
    
    const chat = chats[i];
    const _id = Number(chat._id);
    
    bar.tick({ id: _id, current: i + 1 })

    const chatInfo = await getChatInfo(_id, chatsCollection)
    if (chatInfo.type._ !== "chatTypePrivate") {
      continue
    }
    
    const filename = path.join(__dirname, `../db/chats/${_id}.db`)
    const chatCollection = await Datastore.create({ filename, autoload: true });

    const res = await getChatLoop(_id, config.iterationForChat, chatCollection);
  }

  bar.terminate();
}

async function getChatInfo(chatId:number, chatsCollection:Datastore<Chat & CollectionObject>) {
  const chat =  await client.invoke({
    _: 'getChat',
    chat_id: chatId
  })

  const res = await chatsCollection.update({ _id: Number(chat.id) }, chat)

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
