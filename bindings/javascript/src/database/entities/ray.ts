import { DwgPoint3D } from '../common.js'
import { DwgEntity } from './entity.js'

export interface DwgRayEntity extends DwgEntity {
  type: 'RAY'
  firstPoint: DwgPoint3D
  unitDirection: DwgPoint3D
}
