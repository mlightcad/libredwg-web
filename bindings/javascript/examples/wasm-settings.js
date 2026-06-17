import {
  getWasmBits,
  isMemory64Available,
  setWasmBits
} from './libredwg-loader.js'

/**
 * @param {object} [options]
 * @param {HTMLElement} [options.container]
 * @param {(bits: '32' | '64') => void} [options.onChange]
 */
export async function mountWasmSettings(options = {}) {
  const memory64Available = await isMemory64Available()
  let bits = getWasmBits()

  if (bits === '64' && !memory64Available) {
    bits = '32'
    setWasmBits('32')
  }

  const bar = document.createElement('div')
  bar.id = 'wasm-settings-bar'
  bar.style.cssText =
    'margin: 0 0 1em; padding: 0.5em 0; font: 14px sans-serif;'

  const label = document.createElement('label')
  label.textContent = 'WASM mode: '

  const select = document.createElement('select')
  select.id = 'wasmBitsSelect'
  for (const [value, text] of [
    ['32', '32-bit (default, up to 4 GB)'],
    ['64', '64-bit Memory64 (Chrome 133+, large files)']
  ]) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = text
    option.selected = value === bits
    if (value === '64' && !memory64Available) {
      option.disabled = true
      option.textContent += ' (run pnpm build:64)'
    }
    select.appendChild(option)
  }

  select.addEventListener('change', () => {
    /** @type {'32' | '64'} */
    const next = select.value === '64' ? '64' : '32'
    setWasmBits(next)
    if (options.onChange) {
      options.onChange(next)
    } else {
      location.reload()
    }
  })

  label.appendChild(select)
  bar.appendChild(label)

  const note = document.createElement('span')
  note.style.marginLeft = '0.75em'
  note.style.color = '#555'
  if (bits === '64') {
    note.textContent = 'Using wasm64/ (Memory64)'
  } else if (!memory64Available) {
    note.textContent =
      'Using wasm/ (32-bit). Memory64 bundle not found — run pnpm build:64.'
  } else {
    note.textContent = 'Using wasm/ (32-bit)'
  }
  bar.appendChild(note)

  const container = options.container ?? document.body
  const first = container.firstElementChild
  if (first && options.prepend !== false) {
    container.insertBefore(bar, first)
  } else {
    container.appendChild(bar)
  }

  return bar
}

/** Keep example links in sync with the selected wasm mode. */
export function syncExampleLinks() {
  const bits = getWasmBits()
  document.querySelectorAll('[data-example-link]').forEach((anchor) => {
    const url = new URL(anchor.getAttribute('href'), location.href)
    url.searchParams.set('wasm', bits)
    anchor.href = `${url.pathname.split('/').pop()}?${url.searchParams.toString()}`
  })
}
