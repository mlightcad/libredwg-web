import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { Dwg_File_Type, LibreDwg } from '../dist/libredwg-web.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(__dirname, '..')
const wasmDir = join(packageRoot, 'wasm')
const sampleDwg = join(
  packageRoot,
  '../../test/test-data/2000/Line.dwg'
)

async function readSampleDwg(libredwg) {
  const fileContent = readFileSync(sampleDwg)
  const dwg = libredwg.dwg_read_data(fileContent, Dwg_File_Type.DWG)
  try {
    return {
      version: libredwg.dwg_get_version_type(dwg),
      codepage: libredwg.dwg_get_codepage(dwg),
      ...libredwg.convertEx(dwg)
    }
  } finally {
    libredwg.dwg_free(dwg)
  }
}

test('LibreDwg.create(wasmDir) parses a DWG file in Node.js', async () => {
  const libredwg = await LibreDwg.create(wasmDir)
  const { version, codepage, database, stats } = await readSampleDwg(libredwg)

  assert.equal(version.hdr, 'AC1015')
  assert.equal(typeof codepage, 'number')
  assert.equal(typeof database.header, 'object')
  assert.equal(database.entities.length, 1)
  assert.ok(database.tables.LAYER.entries.length > 0)
  assert.equal(typeof stats.unknownEntityCount, 'number')
})

test('LibreDwg.create() resolves wasm next to the package', async () => {
  const libredwg = await LibreDwg.create()
  const { version, database } = await readSampleDwg(libredwg)

  assert.equal(version.hdr, 'AC1015')
  assert.equal(database.entities.length, 1)
})

test('LibreDwg.dwg_read_data parses an ASCII DXF file', async () => {
  const sampleDxf = join(packageRoot, '../../test/test-data/example_2000.dxf')
  const fileContent = readFileSync(sampleDxf)
  const libredwg = await LibreDwg.create(wasmDir)
  const ptr = libredwg.dwg_read_data(fileContent, Dwg_File_Type.DXF)
  assert.ok(ptr)
  try {
    const { database } = libredwg.convertEx(ptr)
    assert.ok(database.entities.length > 0)
    assert.ok(database.tables.VPORT.entries.length > 0)
    assert.ok(
      database.tables.VPORT.entries.some(e => /^\*ACTIVE$/i.test(e.name))
    )
  } finally {
    libredwg.dwg_free(ptr)
  }
})

test('convertEx decodes GROUP objects from DXF', async () => {
  const sampleDxf = join(packageRoot, '../../test/test-data/2000/Leader.dxf')
  const fileContent = readFileSync(sampleDxf)
  const libredwg = await LibreDwg.create(wasmDir)
  const ptr = libredwg.dwg_read_data(fileContent, Dwg_File_Type.DXF)
  assert.ok(ptr)
  try {
    const { database } = libredwg.convertEx(ptr)
    const groups = database.objects.GROUP
    assert.ok(Array.isArray(groups))
    assert.ok(groups.length >= 1)

    const group = groups.find(g => g.handle === '829')
    assert.ok(group, 'expected GROUP handle 829')
    assert.equal(group.description, 'Superhatch')
    assert.equal(group.unnamed, true)
    assert.equal(group.selectable, true)
    assert.deepEqual(group.objectHandles, ['81B', '82A', '82E', '830', '836'])

    const acadGroup = database.objects.DICTIONARY.find(d => d.handle === 'D')
    assert.ok(acadGroup, 'expected ACAD_GROUP dictionary handle D')
    assert.equal(acadGroup.entries['*A1'], '829')
  } finally {
    libredwg.dwg_free(ptr)
  }
})
