import crypto from 'crypto'

export const calculateHash = (obj: object): string => {
  const str = JSON.stringify(obj)
  return crypto.createHash('sha256').update(str).digest('hex')
}

export const copyObj = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj))
}
