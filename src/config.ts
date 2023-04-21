import * as dotenv from 'dotenv'

dotenv.config()

interface Config {
  testChatId?: number
  testMessageId?: number
  apiDelay: number
  iterationForChat: number
  apiId: number
  apiHash: string
  redisConnection: string
  mongoConnection: string
}

const parseEnvNumber = (value: string | undefined): number | undefined => {
  return value !== undefined && value !== '' ? parseInt(value) : undefined
}

const redisConnection = process.env.REDIS_CONNECTION_STRING
const mongoConnection = process.env.MONGO_CONNECTION_STRING
const apiHash = process.env.API_HASH
const apiId = parseEnvNumber(process.env.API_ID)

if (apiId === undefined ||
  apiHash === undefined ||
  redisConnection === undefined ||
  mongoConnection === undefined
) {
  throw new Error(
    'API_ID, API_HASH, REDIS_CONNECTION_STRING or MONGO_CONNECTION_STRING is not set'
  )
}

const config: Config = {
  testChatId: parseEnvNumber(process.env.TEST_CHAT_ID),
  testMessageId: parseEnvNumber(process.env.TEST_MESSAGE_ID),

  apiDelay: parseEnvNumber(process.env.API_DELAY) ?? 1200,
  iterationForChat: parseEnvNumber(process.env.ITERATION_FOR_CHAT) ?? 50,
  apiId,
  apiHash,
  redisConnection,
  mongoConnection
}

export default config
