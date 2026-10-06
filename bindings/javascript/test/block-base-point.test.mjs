import assert from 'node:assert/strict'
import test from 'node:test'

import {
  inferBlockBasePointFromEntities,
  resolveBlockBasePoint
} from '../src/converter/blockBasePoint.ts'

test('keeps a stored non-zero BLOCK_HEADER base point', () => {
  const base = resolveBlockBasePoint({
    headerBase: { x: 12, y: 34, z: 1 },
    blockEntityBase: { x: 0, y: 0 },
    entities: [
      {
        type: 'LINE',
        handle: '1',
        ownerBlockRecordSoftId: '0',
        layer: '0',
        startPoint: { x: 1e6, y: 1e6, z: 0 },
        endPoint: { x: 1e6 + 10, y: 1e6 + 10, z: 0 },
        thickness: 0,
        extrusionDirection: { x: 0, y: 0, z: 1 }
      }
    ]
  })
  assert.deepEqual(base, { x: 12, y: 34, z: 1 })
})

test('falls back to the BLOCK entity base point when the header is origin', () => {
  const base = resolveBlockBasePoint({
    headerBase: { x: 0, y: 0, z: 0 },
    blockEntityBase: { x: 50, y: 60 },
    entities: []
  })
  assert.equal(base.x, 50)
  assert.equal(base.y, 60)
})

test('infers bbox-min for a normal block whose geometry is far from origin (GH #26)', () => {
  const base = resolveBlockBasePoint({
    headerBase: { x: 0, y: 0, z: 0 },
    entities: [
      {
        type: 'LINE',
        handle: '1',
        ownerBlockRecordSoftId: '0',
        layer: '0',
        startPoint: { x: 1093216, y: 81356, z: 0 },
        endPoint: { x: 1105105, y: 134984, z: 0 },
        thickness: 0,
        extrusionDirection: { x: 0, y: 0, z: 1 }
      }
    ],
    blockName: 'ewrfeterttretwetrt34t43'
  })
  assert.equal(base.x, 1093216)
  assert.equal(base.y, 81356)
})

test('does not infer when geometry already surrounds the origin', () => {
  const inferred = inferBlockBasePointFromEntities([
    {
      type: 'LINE',
      handle: '1',
      ownerBlockRecordSoftId: '0',
      layer: '0',
      startPoint: { x: -8440, y: -4585, z: 0 },
      endPoint: { x: 385, y: 4753, z: 0 },
      thickness: 0,
      extrusionDirection: { x: 0, y: 0, z: 1 }
    }
  ])
  assert.equal(inferred, null)
})

test('does not rewrite *Model_Space even when entities are far from origin', () => {
  const base = resolveBlockBasePoint({
    headerBase: { x: 0, y: 0, z: 0 },
    entities: [
      {
        type: 'LINE',
        handle: '1',
        ownerBlockRecordSoftId: '0',
        layer: '0',
        startPoint: { x: 1093216, y: 81356, z: 0 },
        endPoint: { x: 1105105, y: 134984, z: 0 },
        thickness: 0,
        extrusionDirection: { x: 0, y: 0, z: 1 }
      }
    ],
    blockName: '*Model_Space'
  })
  assert.deepEqual(base, { x: 0, y: 0, z: 0 })
})
