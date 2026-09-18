import { DwgCommonTableEntry } from './table'

export interface DwgLTypeTableEntry extends DwgCommonTableEntry {
  name: string
  standardFlag: number
  description: string
  numberOfLineTypes: number
  totalPatternLength: number
  pattern?: DwgLineTypeElement[]
}

export interface DwgLineTypeElement {
  elementLength: number
  /** DXF 74: 1 = absolute rotation, 2 = embedded text, 4 = shape */
  elementTypeFlag: number
  /** DXF 75: shape number when elementTypeFlag has bit 4 */
  shapeNumber?: number
  styleObjectId?: string
  scale?: number
  rotation?: number
  offsetX?: number
  offsetY?: number
  /** DXF 9: embedded text when elementTypeFlag has bit 2 */
  text?: string
}
