import path from 'path'
import { Client } from 'tdl'
import { TDLib } from 'tdl-tdlib-addon'
import config from './config'

const tdl = new TDLib(path.join(__dirname, 'bin/libtdjson.dylib'))

const client = new Client(tdl, {
  apiId: config.apiId,
  apiHash: config.apiHash
})

export default client
