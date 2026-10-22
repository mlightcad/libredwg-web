import { DwgPoint2D } from '../common.js'
import { DwgCommonObject } from './common.js'

export interface DwgImageDefObject extends DwgCommonObject {
  fileName: string
  size: DwgPoint2D
  sizeOfOnePixel: DwgPoint2D
  isLoaded: number
  resolutionUnits: number
}
