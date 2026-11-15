import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { Dwg_File_Type, LibreDwg } from '../dist/libredwg-web.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(__dirname, '..')
const wasmDir = join(packageRoot, 'wasm')
const fixtureDxf = join(__dirname, 'fixtures/rotated-dimension.dxf')

test('LINEAR dimensions use AcDbRotatedDimension and dim_rotation', async () => {
  const libredwg = await LibreDwg.create(wasmDir)
  const fileContent = readFileSync(fixtureDxf)
  const ptr = libredwg.dwg_read_data(fileContent, Dwg_File_Type.DXF)
  assert.ok(ptr)
  try {
    const { database } = libredwg.convertEx(ptr)
    const dims = database.entities.filter(e => e.type === 'DIMENSION')
    assert.equal(dims.length, 2)

    const rotated = dims.find(d => d.subclassMarker === 'AcDbRotatedDimension')
    assert.ok(rotated)
    // DXF group 50 = 90° is stored in radians.
    assert.ok(Math.abs(rotated.rotationAngle - Math.PI / 2) < 1e-9)
    // DXF group 54 = 45° must stay on ocsRotation, not leak into rotationAngle.
    assert.ok(Math.abs(rotated.ocsRotation - Math.PI / 4) < 1e-9)

    const aligned = dims.find(d => d.subclassMarker === 'AcDbAlignedDimension')
    assert.ok(aligned)
    assert.equal(aligned.rotationAngle, 0)
    // Aligned fixture also has non-zero ins_rotation (group 54 = 30°).
    assert.ok(Math.abs(aligned.ocsRotation - Math.PI / 6) < 1e-9)
  } finally {
    libredwg.dwg_free(ptr)
  }
})
