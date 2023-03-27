const { Client } = require('tdl')
const { TDLib } = require('tdl-tdlib-addon')

const client = new Client(new TDLib(), {
  apiId: 2222, // Your api_id
  apiHash: '0123456789abcdef0123456789abcdef' // Your api_hash
})

