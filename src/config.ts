require('dotenv').config()

interface Config {
  testChatId?: number;
  testMessageId?: number;
  apiDelay: number;
  iterationForChat: number;
  apiId?: number;
  apiHash?: string;
}

const config: Config = {
  testChatId: process.env.TEST_CHAT_ID ? parseInt(process.env.TEST_CHAT_ID) : undefined,
  testMessageId: process.env.TEST_MESSAGE_ID ? parseInt(process.env.TEST_MESSAGE_ID) : undefined,
  apiDelay: process.env.API_DELAY ? parseInt(process.env.API_DELAY) : 1200,
  iterationForChat: process.env.ITERATION_FOR_CHAT ? parseInt(process.env.ITERATION_FOR_CHAT) : 50,
  apiId: process.env.API_ID ? parseInt(process.env.API_ID) : undefined,
  apiHash: process.env.API_HASH,
};

if (!config.apiId || !config.apiHash) {
  throw new Error('API_ID or API_HASH is not set')
}

export default config;