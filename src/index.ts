import config from './config'
import client from './client'
import ChatHistory from './ChatHistory'
import ChatList from './ChatList'

async function main (): Promise<void> {
  await client.login()
  const testChatId = config.testChatId ?? 0

  const chatHistoryInstance = new ChatHistory(client, testChatId)
  await chatHistoryInstance.fetchChatHistory(10, 0)

  const chatListInstance = new ChatList(client)
  await chatListInstance.fetchChats()
}

main().catch((err: Error) => {
  console.log(err)
})
