import { DwgPoint3D } from '../common.js'
import { DwgEntity } from './entity.js'

export interface DwgLineEntity extends DwgEntity {
  type: 'LINE'
  thickness: number
  startPoint: DwgPoint3D
  endPoint: DwgPoint3D
  extrusionDirection: DwgPoint3D
}
