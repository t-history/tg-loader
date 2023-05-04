import path from 'path'
import { platform } from 'os'
import { Client } from 'tdl'
import { TDLib } from 'tdl-tdlib-addon'
import config from './config'
import { getTdjson } from 'prebuilt-tdlib'

const ext = platform() === 'darwin' ? '.dylib' : platform() === 'win32' ? '.dll' : '.so'
const connection = process.arch === 'arm64'
  ? path.join(__dirname, `../bin/libtdjson${ext}`)
  : getTdjson()

console.log('Using', connection)
const tdl = new TDLib(connection)

const client = new Client(tdl, {
  apiId: config.apiId,
  apiHash: config.apiHash
})

export default client
