import * as dotenv from 'dotenv'

dotenv.config()

interface Config {
  testChatId?: number
  testMessageId?: number
  iterationForChat: number
  apiId: number
  apiHash: string
  redisPort: number
  redisHost: string
  redisUser: string | null
  redisPass: string | null
  mongoConnection: string
  mongoDbName: string
}

const parseEnvNumber = (value: string | undefined): number | undefined => {
  return value !== undefined && value !== '' ? parseInt(value) : undefined
}

const mongoConnection = process.env.MONGO_CONNECTION_STRING
const mongoDbName = process.env.MONGO_DB_NAME
const apiHash = process.env.API_HASH
const apiId = parseEnvNumber(process.env.API_ID)
const redisPort = parseEnvNumber(process.env.REDIS_PORT)
const redisHost = process.env.REDIS_HOST
const redisUser = process.env.REDIS_USER ?? null
const redisPass = process.env.REDIS_PASS ?? null

if (apiId === undefined ||
  apiHash === undefined ||
  redisPort === undefined ||
  redisHost === undefined ||
  // redisUser === undefined ||
  // redisPass === undefined ||
  mongoConnection === undefined ||
  mongoDbName === undefined
) {
  throw new Error(
    'API_ID, API_HASH, REDIS_CONNECTION, MONGO_DB_NAME or MONGO_CONNECTION_STRING is not set'
  )
}

const config: Config = {
  testChatId: parseEnvNumber(process.env.TEST_CHAT_ID),
  testMessageId: parseEnvNumber(process.env.TEST_MESSAGE_ID),

  iterationForChat: parseEnvNumber(process.env.ITERATION_FOR_CHAT) ?? 50,
  apiId,
  apiHash,
  redisPort,
  redisHost,
  redisPass,
  redisUser,
  mongoConnection,
  mongoDbName
}

export default config
