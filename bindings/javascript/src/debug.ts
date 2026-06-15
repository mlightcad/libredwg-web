export interface LibreDwgDebugOptions {
  /** Master switch for all debug output. */
  enabled: boolean
  /** Log proxy entity graphics/entity data resolution. */
  proxyEntity: boolean
}

const defaultOptions: LibreDwgDebugOptions = {
  enabled: false,
  proxyEntity: false
}

let options: LibreDwgDebugOptions = { ...defaultOptions }

export function getLibreDwgDebugOptions(): Readonly<LibreDwgDebugOptions> {
  return options
}

export function setLibreDwgDebugOptions(
  partial: Partial<LibreDwgDebugOptions>
): LibreDwgDebugOptions {
  options = { ...options, ...partial }
  return options
}

export function resetLibreDwgDebugOptions(): void {
  options = { ...defaultOptions }
}

export function isLibreDwgDebugEnabled(
  scope?: keyof Omit<LibreDwgDebugOptions, 'enabled'>
): boolean {
  if (!options.enabled) {
    return false
  }
  if (!scope) {
    return true
  }
  return options[scope]
}

export function libreDwgDebugLog(
  scope: keyof Omit<LibreDwgDebugOptions, 'enabled'>,
  message: string,
  data?: unknown
): void {
  if (!isLibreDwgDebugEnabled(scope)) {
    return
  }
  if (data === undefined) {
    console.log(`[libredwg:${scope}] ${message}`)
  } else {
    console.log(`[libredwg:${scope}] ${message}`, data)
  }
}

export function hexPreview(
  bytes: Uint8Array | number[] | null | undefined,
  maxBytes = 16
): string {
  if (!bytes || bytes.length === 0) {
    return '(empty)'
  }
  const slice = bytes.subarray(0, maxBytes)
  const hex = Array.from(slice)
    .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
    .join('')
  return bytes.length > maxBytes
    ? `${hex}... (${bytes.length} bytes total)`
    : hex
}
