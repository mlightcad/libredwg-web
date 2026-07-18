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

/**
 * OLE2FRAME binary payloads begin with a 0x80-byte Autodesk header, then an
 * MS-CFB compound document. Corner points for DXF groups 10/11 are stored in
 * that header (also decoded by `dwg_decode_ole2`).
 *
 * Layout after a 2-byte unknown prefix (`0x80 0x55` in common files):
 * four WCS corners as little-endian 3D doubles (upper-left, upper-right,
 * lower-right, lower-left). DXF group codes 10/11 store the first and third.
 */
export const decodeOle2FrameCornersFromData = (
  data: Uint8Array
): { upperLeft: { x: number; y: number; z: number }; lowerRight: { x: number; y: number; z: number } } | null => {
  // 2-byte prefix + 4 corners * 3 doubles * 8 bytes = 98 bytes
  if (!data || data.length < 98) {
    return null
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const readPoint = (offset: number) => ({
    x: view.getFloat64(offset, true),
    y: view.getFloat64(offset + 8, true),
    z: view.getFloat64(offset + 16, true)
  })
  const upperLeft = readPoint(2)
  const lowerRight = readPoint(2 + 48)
  if (![upperLeft.x, upperLeft.y, upperLeft.z, lowerRight.x, lowerRight.y, lowerRight.z].every(Number.isFinite)) {
    return null
  }
  return { upperLeft, lowerRight }
}
