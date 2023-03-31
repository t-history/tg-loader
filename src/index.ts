import config from './config'
import client from './client'
import ChatHistory from './ChatHistory'

async function main (): Promise<void> {
  await client.login()
  const testChatId = config.testChatId ?? 0

  const chatHistoryInstance = new ChatHistory(client, testChatId)
  await chatHistoryInstance.getChatHistory(10, 0)
}

main().catch((err: Error) => {
  console.log(err)
})
