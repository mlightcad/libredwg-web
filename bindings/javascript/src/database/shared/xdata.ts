import { DwgPoint3D } from '../common'

export interface DwgXData {
  appName: string
  value: DwgXDataEntry[]
}
export interface DwgXDataEntry {
  code?: number
  value: DwgXDataEntry[] | number | string | DwgPoint3D
}
