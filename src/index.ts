import config from './config'
import client from './client'
import ChatHistory from './ChatHistory'
import ChatList from './ChatList'

async function main (): Promise<void> {
  await client.login()

  const chatListInstance = new ChatList(client)
  await chatListInstance.fetchChats()

  const chats = await chatListInstance.chatCollection.find({ 'type._': 'chatTypePrivate' }, { id: 1, 'last_message.id': 1 })

  for await (const chat of chats) {
    const chatHistoryInstance = new ChatHistory(client, chat.id)
    await chatHistoryInstance.fetchChatHistory(config.iterationForChat, chat.last_message?.id ?? 0, true)
    await new Promise(resolve => setTimeout(resolve, 600))
  }
}

main().catch((err: Error) => {
  console.log(err)
})
