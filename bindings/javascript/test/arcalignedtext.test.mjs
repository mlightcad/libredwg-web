import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { Dwg_File_Type, LibreDwg } from '../dist/libredwg-web.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(__dirname, '..')
const wasmDir = join(packageRoot, 'wasm')
const fixture = join(__dirname, 'fixtures/arcalignedtext.dxf')

/**
 * Release wasm builds previously marked ARCALIGNEDTEXT as DEBUGGING_CLASS, so
 * Express Tools arc text became UNKNOWN_ENT and disappeared from blocks such as
 * HYDR-WHARF. The entity must decode under the default (non-DEBUG_CLASSES) build.
 */
test('release wasm decodes ARCALIGNEDTEXT from DXF', async () => {
  const libredwg = await LibreDwg.create(wasmDir)
  const fileContent = readFileSync(fixture, 'utf8')
  const ptr = libredwg.dwg_read_data(fileContent, Dwg_File_Type.DXF)
  assert.ok(ptr)
  try {
    const { database, stats } = libredwg.convertEx(ptr)
    const arcs = database.entities.filter(e => e.type === 'ARCALIGNEDTEXT')
    assert.equal(arcs.length, 1)
    assert.equal(arcs[0].text, 'HYD')
    assert.equal(typeof arcs[0].radius, 'number')
    assert.ok(arcs[0].radius > 0)
    assert.equal(stats.unknownEntityCount, 0)
  } finally {
    libredwg.dwg_free(ptr)
  }
})
