import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { Dwg_File_Type, LibreDwg } from '../dist/libredwg-web.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const wasmDir = join(__dirname, '..', 'wasm')

// Prefer compiled lib when present; otherwise skip (run after `pnpm build`).
let LibreEntityConverter
try {
  ;({ LibreEntityConverter } = await import(
    '../lib/converter/entityConverter.js'
  ))
} catch {
  test('MINSERT conversion (skipped — build lib first)', () => {
    assert.ok(true)
  })
}

const DWG_TYPE_INSERT = 0x07
const DWG_TYPE_MINSERT = 0x08

/**
 * Fake LibreDWG instance holding one block reference. The DXF reader always
 * produces INSERT (it keeps rows/columns on it), so a real MINSERT object only
 * comes from DWG files; fake the object to cover that path.
 */
function fakeLibreDwg(fixedtype, fields) {
  const BLOCK_HEADER_REF = 100
  const BLOCK_HEADER_OBJ = 101
  return {
    dwg_object_to_entity: () => 1,
    dwg_object_to_entity_tio: () => 2,
    dwg_object_get_fixedtype: () => fixedtype,
    dwg_dynapi_entity_data: (_tio, field) =>
      field === 'block_header' ? BLOCK_HEADER_REF : fields[field],
    dwg_ref_get_object: ref => (ref === BLOCK_HEADER_REF ? BLOCK_HEADER_OBJ : 0),
    dwg_object_to_object_tio: obj => obj,
    dwg_entity_block_header_get_block: () => ({ name: '*U17' }),
    dwg_entity_insert_get_attribs: () => []
  }
}

function convert(fixedtype, fields) {
  const converter = new LibreEntityConverter(fakeLibreDwg(fixedtype, fields))
  // Common attributes are covered elsewhere and need many more fakes.
  converter.getCommonAttrs = () => ({ handle: '3EA4', layer: '0' })
  return converter.convert(1)
}

const ARRAY_FIELDS = {
  ins_pt: { x: 1, y: 2, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  rotation: 0,
  num_cols: 3,
  num_rows: 2,
  col_spacing: 10,
  row_spacing: 20,
  extrusion: { x: 0, y: 0, z: 1 }
}

if (LibreEntityConverter) {
  // A MINSERT can be the only entity in model space (the whole drawing is an
  // anonymous block arrayed by it). Dropping it leaves the drawing empty.
  test('MINSERT converts to an INSERT with its array parameters', () => {
    const entity = convert(DWG_TYPE_MINSERT, ARRAY_FIELDS)
    assert.ok(entity, 'MINSERT must not be dropped')
    assert.equal(entity.type, 'INSERT')
    assert.equal(entity.handle, '3EA4')
    assert.equal(entity.name, '*U17')
    assert.deepEqual(entity.insertionPoint, { x: 1, y: 2, z: 0 })
    assert.equal(entity.columnCount, 3)
    assert.equal(entity.rowCount, 2)
    assert.equal(entity.columnSpacing, 10)
    assert.equal(entity.rowSpacing, 20)
  })

  test('INSERT still converts', () => {
    const entity = convert(DWG_TYPE_INSERT, ARRAY_FIELDS)
    assert.ok(entity)
    assert.equal(entity.type, 'INSERT')
    assert.equal(entity.name, '*U17')
    assert.equal(entity.columnCount, 3)
    assert.equal(entity.rowCount, 2)
  })

  // R13+ DWG stores the array fields only on MINSERT, so a plain INSERT
  // reads 0 counts. DXF defaults: 70/71 = 1, 44/45 = 0.
  test('INSERT without array fields gets DXF default counts', () => {
    const entity = convert(DWG_TYPE_INSERT, {
      ...ARRAY_FIELDS,
      num_cols: 0,
      num_rows: 0,
      col_spacing: undefined,
      row_spacing: undefined
    })
    assert.equal(entity.columnCount, 1)
    assert.equal(entity.rowCount, 1)
    assert.equal(entity.columnSpacing, 0)
    assert.equal(entity.rowSpacing, 0)
  })
}

// End to end through the wasm: the DXF reader turns an INSERT with the
// AcDbMInsertBlock subclass into a real MINSERT object. Its attribs sit at
// other offsets than INSERT's, so this also covers the attribs getter.
test('DXF MINSERT with attributes converts end to end', async () => {
  const libredwg = await LibreDwg.create(wasmDir)
  const ptr = libredwg.dwg_read_data(
    readFileSync(join(__dirname, 'fixtures/minsert.dxf')),
    Dwg_File_Type.DXF
  )
  assert.ok(ptr)
  try {
    const types = []
    for (let i = 0; i < libredwg.dwg_get_num_objects(ptr); i++) {
      types.push(
        libredwg.dwg_object_get_fixedtype(libredwg.dwg_get_object(ptr, i))
      )
    }
    assert.ok(types.includes(DWG_TYPE_MINSERT), 'fixture must hold a MINSERT')

    const { database } = libredwg.convertEx(ptr)
    const inserts = database.entities.filter(e => e.type === 'INSERT')
    assert.equal(inserts.length, 2)

    const array = inserts.find(e => e.handle === '100')
    assert.ok(array, 'MINSERT must not be dropped')
    assert.equal(array.name, 'ARR')
    assert.equal(array.columnCount, 3)
    assert.equal(array.rowCount, 2)
    assert.equal(array.columnSpacing, 10)
    assert.equal(array.rowSpacing, 20)
    assert.deepEqual(
      array.attribs.map(a => [a.tag, a.text.text]),
      [['TAG', 'HELLO']]
    )

    const single = inserts.find(e => e.handle === '101')
    assert.equal(single.columnCount, 1)
    assert.equal(single.rowCount, 1)
  } finally {
    libredwg.dwg_free(ptr)
  }
})
