import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { Dwg_Object_Type } from '../dist/libredwg-web.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dwgHeader = join(__dirname, '../../../include/dwg.h')

/**
 * TS names that differ from the C enumerator they mirror. C prefixes names
 * that would start with a digit with an extra underscore (`DWG_TYPE__3DFACE`),
 * which is handled generically below.
 */
const TS_TO_C_ALIASES = {
  DWG_TYPE_LAYERFILTER: 'DWG_TYPE_LAYER_FILTER'
}

/**
 * Evaluates the C `Dwg_Object_Type` enum from include/dwg.h the way a C
 * compiler would: implicit members are the previous value plus one.
 */
function parseCObjectTypes(source) {
  const start = source.indexOf('typedef enum DWG_OBJECT_TYPE')
  const end = source.indexOf('} Dwg_Object_Type;', start)
  assert.ok(start >= 0 && end > start, 'Dwg_Object_Type not found in dwg.h')
  const body = source
    .slice(source.indexOf('{', start) + 1, end)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
  const values = new Map()
  let next = 0
  for (const raw of body.split(',')) {
    const item = raw.trim()
    if (!item) continue
    const m = /^(\w+)(?:\s*=\s*(0x[0-9a-fA-F]+|\d+))?$/.exec(item)
    assert.ok(m, `Unsupported enum item in dwg.h: ${item}`)
    const value = m[2] === undefined ? next : Number(m[2])
    values.set(m[1], value)
    next = value + 1
  }
  return values
}

function cValueFor(cValues, tsName) {
  const cName = TS_TO_C_ALIASES[tsName] ?? tsName
  return (
    cValues.get(cName) ?? cValues.get(cName.replace(/^DWG_TYPE_/, 'DWG_TYPE__'))
  )
}

test('Dwg_Object_Type values match include/dwg.h', () => {
  const cValues = parseCObjectTypes(readFileSync(dwgHeader, 'utf8'))
  const tsEntries = Object.entries(Dwg_Object_Type).filter(
    ([name, value]) => typeof value === 'number' && name.startsWith('DWG_TYPE_')
  )
  assert.ok(tsEntries.length > 300, 'expected the full Dwg_Object_Type enum')

  const mismatches = []
  for (const [name, value] of tsEntries) {
    const cValue = cValueFor(cValues, name)
    if (cValue !== value) mismatches.push(`${name}: ts=${value} c=${cValue}`)
  }
  assert.deepEqual(mismatches, [])
})

test('every C object type up to DWG_TYPE_LOAD has a TS member', () => {
  const cValues = parseCObjectTypes(readFileSync(dwgHeader, 'utf8'))
  const load = cValues.get('DWG_TYPE_LOAD')
  const tsValues = new Set(
    Object.values(Dwg_Object_Type).filter(value => typeof value === 'number')
  )
  // Members after DWG_TYPE_LOAD are unstable "unhandled class" ids that the
  // JS API does not expose.
  const missing = [...cValues]
    .filter(([, value]) => value <= load && !tsValues.has(value))
    .map(([name, value]) => `${name}=${value}`)
  assert.deepEqual(missing, [])
})
