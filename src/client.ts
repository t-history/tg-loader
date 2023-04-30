import path from 'path'
import { platform } from 'os'
import { Client } from 'tdl'
import { TDLib } from 'tdl-tdlib-addon'
import config from './config'

const ext = platform() === 'darwin' ? '.dylib' : platform() === 'win32' ? '.dll' : '.so'
const tdl = new TDLib(path.join(__dirname, `bin/libtdjson${ext}`))

const client = new Client(tdl, {
  apiId: config.apiId,
  apiHash: config.apiHash
})

export default client
