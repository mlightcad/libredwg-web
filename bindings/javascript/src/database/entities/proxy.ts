import { DwgEntity } from './entity'

export interface DwgProxyEntity extends DwgEntity {
  type: 'PROXY'
  applicationEntityClassId: number
}
