const MODEL_SPACE = '*MODEL_SPACE'
const MODEL_SPACE_PREFIX = '*PAPER_SPACE'

export const isModelSpace = (name: string) => {
  return name && name.toUpperCase() == MODEL_SPACE
}

export const isPaperSpace = (name: string) => {
  return name && name.toUpperCase().startsWith(MODEL_SPACE_PREFIX)
}

export const idToString = (id: number | bigint) => {
  return id.toString(16).toUpperCase()
}

export const uint8ArrayToHexString = (bytes: Uint8Array): string => {
  const hexChars: string[] = new Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) {
    hexChars[i] = bytes[i].toString(16).toUpperCase().padStart(2, '0')
  }
  return hexChars.join('')
}
