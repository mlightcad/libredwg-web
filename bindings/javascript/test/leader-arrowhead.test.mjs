import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { Dwg_File_Type, LibreDwg } from '../dist/libredwg-web.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(__dirname, '..')
const wasmDir = join(packageRoot, 'wasm')

async function leadersFrom(fileName) {
  const libredwg = await LibreDwg.create(wasmDir)
  const fileContent = readFileSync(join(__dirname, 'fixtures', fileName))
  const ptr = libredwg.dwg_read_data(fileContent, Dwg_File_Type.DWG)
  assert.ok(ptr)
  try {
    const { database } = libredwg.convertEx(ptr)
    return database.entities.filter(e => e.type === 'LEADER')
  } finally {
    libredwg.dwg_free(ptr)
  }
}

test('LEADER R2013 keeps endptproj and does not swallow arrowhead_on', async () => {
  // Same leader as leader_2007.dwg, saved AC1027. R2010+ still stores
  // endptproj and drops box height/width; reading those two BDs on AC1027
  // used to fold endptproj.y into textWidth (-0.09) and desync arrowhead_on.
  const [leader] = await leadersFrom('leader_2013.dwg')
  assert.ok(leader)
  assert.equal(leader.isArrowheadEnabled, false)
  assert.equal(leader.isHooklineSameDirection, false)
  assert.equal(leader.textHeight ?? 0, 0)
  assert.equal(leader.textWidth ?? 0, 0)
  assert.equal(leader.offsetFromAnnotation?.x, 0)
  assert.ok(Math.abs(leader.offsetFromAnnotation?.y - -0.09) < 1e-9)
  assert.equal(leader.offsetFromAnnotation?.z, 0)
})

test('LEADER R2007 still reads box size after endptproj', async () => {
  const [leader] = await leadersFrom('leader_2007.dwg')
  assert.ok(leader)
  assert.equal(leader.isArrowheadEnabled, false)
  assert.equal(leader.isHooklineSameDirection, false)
  assert.ok(Math.abs(leader.textHeight - 0.18) < 1e-9)
  assert.ok(Math.abs(leader.offsetFromAnnotation?.y - -0.09) < 1e-9)
})
