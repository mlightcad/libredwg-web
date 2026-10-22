import { DwgPoint3D } from '../common.js'
import { DwgEntity } from './entity.js'

export interface DwgPointEntity extends DwgEntity {
  type: 'POINT'
  position: DwgPoint3D
  thickness: number
  extrusionDirection: DwgPoint3D
  angle: number
}
