import assert from 'node:assert/strict'
import test from 'node:test'

// Prefer compiled lib when present; otherwise skip (run after `pnpm build`).
let dwgColorToBackgroundFillColor
try {
  ;({ dwgColorToBackgroundFillColor } = await import(
    '../lib/converter/dwgColorToBackgroundFillColor.js'
  ))
} catch {
  test('dwgColorToBackgroundFillColor (skipped — build lib first)', () => {
    assert.ok(true)
  })
}

if (dwgColorToBackgroundFillColor) {
  test('ByLayer CMC placeholder is omitted (not black RGB)', () => {
    assert.equal(
      dwgColorToBackgroundFillColor({
        method: 0xc0,
        index: 256,
        rgb: 0xc0000000,
        flag: 0,
        name: '',
        book_name: ''
      }),
      undefined
    )
  })

  test('ByBlock CMC placeholder is omitted', () => {
    assert.equal(
      dwgColorToBackgroundFillColor({
        method: 0xc1,
        index: 0,
        rgb: 0xc1000000,
        flag: 0,
        name: '',
        book_name: ''
      }),
      undefined
    )
  })

  test('None / window-background CMC is omitted', () => {
    assert.equal(
      dwgColorToBackgroundFillColor({
        method: 0xc8,
        index: 0,
        rgb: 0xc8000000,
        flag: 0,
        name: '',
        book_name: ''
      }),
      undefined
    )
  })

  test('null / undefined colour is omitted', () => {
    assert.equal(dwgColorToBackgroundFillColor(null), undefined)
    assert.equal(dwgColorToBackgroundFillColor(undefined), undefined)
  })

  test('foreground CMC becomes ACI 7', () => {
    assert.equal(
      dwgColorToBackgroundFillColor({
        method: 0xc5,
        index: 7,
        rgb: 0xc5000007,
        flag: 0,
        name: '',
        book_name: ''
      }),
      7
    )
  })

  test('true-color CMC keeps 24-bit RGB', () => {
    assert.equal(
      dwgColorToBackgroundFillColor({
        method: 0xc3,
        index: 0,
        rgb: 0xc3336699,
        flag: 0,
        name: '',
        book_name: ''
      }),
      0x336699
    )
  })

  test('true-color black keeps RGB 0', () => {
    assert.equal(
      dwgColorToBackgroundFillColor({
        method: 0xc3,
        index: 0,
        rgb: 0xc3000000,
        flag: 0,
        name: '',
        book_name: ''
      }),
      0
    )
  })

  test('ACI entity colour keeps the index', () => {
    assert.equal(
      dwgColorToBackgroundFillColor({
        method: 0xc2,
        index: 1,
        rgb: 0xc2ff0000,
        flag: 0,
        name: '',
        book_name: ''
      }),
      1
    )
  })
}
