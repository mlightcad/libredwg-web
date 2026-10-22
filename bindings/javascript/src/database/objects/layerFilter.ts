import { DwgCommonObject } from './common.js'

/**
 * DWG LAYER_FILTER / LAYERFILTER object fields.
 *
 * @remarks
 * This shape mirrors the DXF LAYER_FILTER mapping used by ObjectARX / dxf-json.
 */
export interface DwgLayerFilterObject extends DwgCommonObject {
  /** Layer names included in this filter. */
  layerNames?: string[]
}
