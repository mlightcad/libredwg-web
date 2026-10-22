import { DwgPoint3D } from '../common.js'
import { DwgEntity } from './entity.js'

export interface DwgCircleEntity extends DwgEntity {
  /**
   * Entity type
   */
  type: 'CIRCLE'
  /**
   * Thickness (optional; default = 0)
   */
  thickness: number
  /**
   * Center point (in OCS)
   */
  center: DwgPoint3D
  /**
   * Radius
   */
  radius: number
  /**
   * Extrusion direction (optional; default = 0, 0, 1)
   */
  extrusionDirection: DwgPoint3D
}
