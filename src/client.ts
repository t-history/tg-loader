import path from 'path'
import { platform } from 'os'
import { Client } from 'tdl'
import { TDLib } from 'tdl-tdlib-addon'
import config from './config'
import { getTdjson } from 'prebuilt-tdlib'
import { type Update } from 'tdlib-types'
import qrcode from 'qrcode-terminal'

const ext = platform() === 'darwin' ? '.dylib' : platform() === 'win32' ? '.dll' : '.so'
const connection = process.arch === 'arm64'
  ? path.join(__dirname, `../bin/libtdjson${ext}`)
  : getTdjson()

const tdlib = new TDLib(connection)

const client = new Client(tdlib, {
  apiId: config.apiId,
  apiHash: config.apiHash
})

client.on('error', console.error)

client.on('update', (update: Update) => {
  if (update._ === 'updateAuthorizationState') {
    const authState = update.authorization_state._

    if (authState === 'authorizationStateWaitPhoneNumber') {
      client.invoke({
        _: 'requestQrCodeAuthentication'
      }).then(console.log).catch(console.error)
    }

    if (authState === 'authorizationStateWaitOtherDeviceConfirmation') {
      const qrString = update.authorization_state.link
      qrcode.generate(qrString, { small: true }, (qrCode: string) => {
        console.log(qrCode)
      })
      console.log('token', authState.link)
    }

    if (authState === 'authorizationStateReady') {
      client.invoke({
        _: 'getMe'
      }).then(console.log).catch(console.error)
    }
  }
})

export default client
