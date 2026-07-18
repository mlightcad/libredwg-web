import { DwgCommonObject } from './common'

/**
 * DWG LAYER_INDEX object fields.
 *
 * @remarks
 * This shape mirrors the DXF LAYER_INDEX mapping used by ObjectARX / dxf-json.
 */
export interface DwgLayerIndexObject extends DwgCommonObject {
  /** Julian / last-updated timestamp. */
  timeStamp?: number
  /** Layer names included in this layer index. */
  layerNames?: string[]
  /** Hard-owner handles to IDBUFFER objects. */
  idBufferIds?: string[]
  /** Number of entries in each referenced IDBUFFER. */
  idBufferEntryCounts?: number[]
}
