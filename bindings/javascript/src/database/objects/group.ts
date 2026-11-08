import { DwgCommonObject } from './common.js'

/**
 * DWG GROUP object fields (AcDbGroup).
 *
 * LibreDWG stores the DXF-300 description in `name`. The ObjectARX group
 * **name** is the key in the `ACAD_GROUP` dictionary, not this field.
 */
export interface DwgGroupObject extends DwgCommonObject {
  /** Group description (LibreDWG `GROUP.name` / DXF 300). */
  description: string
  /** True when the group is anonymous (`*A…`). */
  unnamed: boolean
  /** Whether the group is selectable as a unit. */
  selectable: boolean
  /** Soft-pointer handles of member entities, in group order. */
  objectHandles: string[]
}
