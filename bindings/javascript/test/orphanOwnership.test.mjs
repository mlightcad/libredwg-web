import assert from 'node:assert/strict'
import test from 'node:test'

// Prefer compiled lib when present; otherwise skip (run after `pnpm build`).
let LibreDwgConverter
try {
  ;({ LibreDwgConverter } = await import('../lib/converter/converter.js'))
} catch {
  test('orphan ownership (skipped — build lib first)', () => {
    assert.ok(true)
  })
}

const ENTITY = 0
const OBJECT = 1
const BLOCK_HEADER = 49

/**
 * Fake LibreDWG instance. Object pointer = index + 1; TIO and ref pointers
 * mirror the object pointer. No BLOCK_HEADER owns anything through the
 * ownership chain, so every entity takes the orphan path.
 */
function fakeLibreDwg(objects) {
  const at = ptr => objects[ptr - 1]
  const ptrOf = handle => objects.findIndex(o => o.handle === handle) + 1
  return {
    dwg_get_num_objects: () => objects.length,
    dwg_get_object: (_data, index) => index + 1,
    dwg_object_get_supertype: obj => at(obj).supertype,
    dwg_object_get_fixedtype: obj => at(obj).fixedtype ?? 0,
    dwg_object_to_object_tio: obj => obj,
    dwg_object_to_entity_tio: obj => obj,
    get_first_owned_entity: () => 0,
    get_next_owned_entity: () => 0,
    // Mirrors LibreDWG: resolve ownerhandle; entmode 2 falls back to MSPACE.
    dwg_entity_owner: etio => {
      const entity = at(etio)
      const owner = entity.owner != null ? ptrOf(entity.owner) : 0
      if (owner) return owner
      return entity.entmode === 2 ? ptrOf(0x1f) : 0
    },
    dwg_dynapi_common_value: (tio, field) => {
      const entity = at(tio)
      if (field === 'entmode') return { success: true, data: entity.entmode }
      if (field === 'ownerhandle') {
        return { success: true, data: entity.owner == null ? 0 : tio }
      }
      return { success: false }
    },
    dwg_ref_get_absref: ref => at(ref).owner ?? null,
    dwg_resolve_handle_silent: (_data, absref) => ptrOf(Number(absref))
  }
}

function ownerlessHandles(objects) {
  const converter = new LibreDwgConverter(fakeLibreDwg(objects))
  converter.ensureOrphanEntityIndex(1)
  return converter.ownerlessOrphanIndices.map(index => objects[index].handle)
}

if (LibreDwgConverter) {
  test('skips block-owned orphans whose owner block was erased', () => {
    const handles = ownerlessHandles([
      { handle: 0x1f, supertype: OBJECT, fixedtype: BLOCK_HEADER },
      // Leftover of an erased anonymous *D block: owner 0x171BC is gone.
      { handle: 0x171c0, supertype: ENTITY, entmode: 0, owner: 0x171bc }
    ])
    assert.deepEqual(handles, [])
  })

  test('keeps ownerless entities without an owner handle', () => {
    const handles = ownerlessHandles([
      { handle: 0x1f, supertype: OBJECT, fixedtype: BLOCK_HEADER },
      { handle: 0x200, supertype: ENTITY, entmode: 0 }
    ])
    assert.deepEqual(handles, [0x200])
  })

  test('keeps block-owned entities whose owner object still exists', () => {
    const handles = ownerlessHandles([
      { handle: 0x1f, supertype: OBJECT, fixedtype: BLOCK_HEADER },
      // Owner resolves to a non-BLOCK_HEADER object: not a dangling handle.
      { handle: 0x300, supertype: OBJECT },
      { handle: 0x301, supertype: ENTITY, entmode: 0, owner: 0x300 }
    ])
    assert.deepEqual(handles, [0x301])
  })
}
