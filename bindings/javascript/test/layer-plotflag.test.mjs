import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { Dwg_File_Type, LibreDwg } from '../dist/libredwg-web.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(__dirname, '..')
const wasmDir = join(packageRoot, 'wasm')
const r14Fixture = join(__dirname, 'fixtures/r14-layer-plotflag.dxf')
const r2000LayerNoPlot = join(__dirname, 'fixtures/r2000-layer-noplot.dxf')

test('R14 layers default plotFlag to 1 (no DXF 290 in format)', async () => {
  const libredwg = await LibreDwg.create(wasmDir)
  const fileContent = readFileSync(r14Fixture)
  const ptr = libredwg.dwg_read_data(fileContent, Dwg_File_Type.DXF)
  assert.ok(ptr)
  try {
    const { database } = libredwg.convertEx(ptr)
    const layers = database.tables.LAYER.entries
    assert.ok(layers.length >= 1)
    for (const layer of layers) {
      assert.equal(layer.plotFlag, 1, `layer ${layer.name} should be plottable`)
    }
  } finally {
    libredwg.dwg_free(ptr)
  }
})

test('R2000+ layers honor plotflag DXF 290 = 0', async () => {
  const libredwg = await LibreDwg.create(wasmDir)
  const fileContent = readFileSync(r2000LayerNoPlot)
  const ptr = libredwg.dwg_read_data(fileContent, Dwg_File_Type.DXF)
  assert.ok(ptr)
  try {
    const { database } = libredwg.convertEx(ptr)
    const layer0 = database.tables.LAYER.entries.find(l => l.name === '0')
    assert.ok(layer0)
    assert.equal(layer0.plotFlag, 0)
  } finally {
    libredwg.dwg_free(ptr)
  }
})
