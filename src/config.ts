import * as dotenv from 'dotenv'

dotenv.config()

interface Config {
  testChatId?: number
  testMessageId?: number
  apiDelay: number
  iterationForChat: number
  apiId?: number
  apiHash?: string
}

const parseEnvNumber = (value: string | undefined): number | undefined => {
  return value !== undefined && value !== '' ? parseInt(value) : undefined
}

const config: Config = {
  testChatId: parseEnvNumber(process.env.TEST_CHAT_ID),
  testMessageId: parseEnvNumber(process.env.TEST_MESSAGE_ID),

  apiDelay: parseEnvNumber(process.env.API_DELAY) ?? 1200,
  iterationForChat: parseEnvNumber(process.env.ITERATION_FOR_CHAT) ?? 50,
  apiId: parseEnvNumber(process.env.API_ID),
  apiHash: process.env.API_HASH
}

if (config.apiId === undefined || config.apiHash === undefined) {
  throw new Error('API_ID or API_HASH is not set')
}

export default config
