import config from './config'
import client from './client'
import ChatHistory from './ChatHistory'
import ChatList from './ChatList'
import ProgressBar from 'progress'

async function main (): Promise<void> {
  await client.login()

  const chatListInstance = new ChatList(client)
  await chatListInstance.fetchChats()

  const chats = await chatListInstance.chatCollection.find({ 'type._': 'chatTypePrivate' }, { id: 1, 'last_message.id': 1 })
  const barTemplate = 'Loading :i/:total chat: :chatId'
  const bar = new ProgressBar(barTemplate, {
    total: chats.length,
    width: 30
  })

  for (let i = 0; i < chats.length; i++) {
    bar.tick({ i: i + 1, chatId: chats[i].id })

    const chat = chats[i]
    const chatHistoryInstance = new ChatHistory(client, chat.id)
    await chatHistoryInstance.fetchChatHistory(
      config.iterationForChat,
      chat.last_message?.id ?? 0,
      true,
      `Loading ${i}/${chats.length} chat: ${chat.id}`
    )
    bar.interrupt(`Loaded ${chat.id}`)
    await new Promise(resolve => setTimeout(resolve, 300))
  }
}

main().catch((err: Error) => {
  console.log(err)
})
