export const WASM_BITS_KEY = 'libredwg-web-wasm-bits'

/** @returns {'32' | '64'} */
export function getWasmBits() {
  const fromUrl = new URLSearchParams(location.search).get('wasm')
  if (fromUrl === '32' || fromUrl === '64') {
    return fromUrl
  }
  const stored = localStorage.getItem(WASM_BITS_KEY)
  if (stored === '32' || stored === '64') {
    return stored
  }
  return '32'
}

/** @param {'32' | '64'} bits */
export function setWasmBits(bits) {
  localStorage.setItem(WASM_BITS_KEY, bits)
  const url = new URL(location.href)
  url.searchParams.set('wasm', bits)
  history.replaceState(null, '', url)
}

/** @param {'32' | '64'} [bits] */
export function getWasmDir(bits = getWasmBits()) {
  return bits === '64' ? './wasm64/' : './wasm/'
}

/** @param {'32' | '64'} [bits] */
export function getBundleUrl(bits = getWasmBits()) {
  return bits === '64'
    ? new URL('./dist/memory64/libredwg-web.js', import.meta.url)
    : new URL('./dist/libredwg-web.js', import.meta.url)
}

/** @returns {Promise<boolean>} */
export async function isMemory64Available() {
  try {
    const response = await fetch(getBundleUrl('64'), { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

/** @param {'32' | '64'} [bits] */
export async function loadLibredwgModule(bits = getWasmBits()) {
  if (bits === '64' && !(await isMemory64Available())) {
    throw new Error(
      'Memory64 bundle is not installed in examples/dist/memory64/. ' +
        'Run pnpm build:64 or pnpm build:all, then restart pnpm demo.'
    )
  }

  try {
    const url = getBundleUrl(bits)
    return await import(/* @vite-ignore */ url.href)
  } catch (err) {
    if (bits === '64') {
      throw new Error(
        'Failed to load Memory64 bundle. Run pnpm build:64 or pnpm build:all, then restart pnpm demo.',
        { cause: err }
      )
    }
    throw err
  }
}

/** @param {'32' | '64'} [bits] */
export async function createLibreDwg(bits = getWasmBits()) {
  const mod = await loadLibredwgModule(bits)
  return mod.LibreDwg.create(getWasmDir(bits))
}

/** @param {'32' | '64'} [bits] */
export async function createRawModule(bits = getWasmBits()) {
  const mod = await loadLibredwgModule(bits)
  const wasmDir = getWasmDir(bits)
  return mod.createModule({
    locateFile: (filename) => `${wasmDir}${filename}`
  })
}
