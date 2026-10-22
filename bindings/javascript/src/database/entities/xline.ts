import { DwgPoint3D } from '../common.js'
import { DwgEntity } from './entity.js'

export interface DwgXlineEntity extends DwgEntity {
  type: 'XLINE'
  firstPoint: DwgPoint3D
  unitDirection: DwgPoint3D
}
