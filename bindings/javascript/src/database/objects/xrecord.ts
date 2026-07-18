import { DwgCommonObject } from './common'

/**
 * One DXF group-code / value pair stored in an XRECORD.
 */
export interface DwgXRecordGroup {
  /** DXF group code. */
  code: number
  /**
   * Group value. Strings, numbers, booleans, handle hex strings, binary
   * byte arrays, or `{ x, y, z }` for 3D points.
   */
  value: unknown
}

/**
 * DWG XRECORD object fields.
 *
 * @remarks
 * Layer Manager filters (`ACAD_LAYERFILTERS` / `ACLYDICTIONARY`) store each
 * filter node as an XRECORD under those dictionaries. The payload mirrors the
 * DXF XRECORD `data` group list used by ObjectARX / dxf-json.
 */
export interface DwgXRecordObject extends DwgCommonObject {
  /** Duplicate record cloning flag (DXF group 280). */
  cloning?: number
  /** Extension dictionary handle, when the object has one. */
  extensionDictionary?: string
  /** XRecord payload as DXF group pairs. */
  data: DwgXRecordGroup[]
}
