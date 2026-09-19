import { DwgPoint3D } from '../common'
import { DwgEntity } from './entity'

/**
 * Express Tools arc-aligned text (DXF ARCALIGNEDTEXT / AcDbArcAlignedText).
 * Doubles that the DWG stores as strings (text size, scales, offsets) are
 * already parsed to numbers here.
 */
export interface DwgArcAlignedTextEntity extends DwgEntity {
  /**
   * Entity type
   */
  type: 'ARCALIGNEDTEXT'
  /**
   * Text contents
   */
  text: string
  /**
   * Text height
   */
  textSize: number
  /**
   * Width factor
   */
  xScale: number
  /**
   * Extra spacing between characters, in text-height units
   */
  characterSpacing: number
  /**
   * Text style name
   */
  styleName: string
  /**
   * Font file name
   */
  fontName: string
  /**
   * Bigfont file name
   */
  bigFontName: string
  /**
   * Offset from the reference arc
   */
  offsetFromArc: number
  /**
   * Offset from the end of the arc
   */
  rightOffset: number
  /**
   * Offset from the start of the arc
   */
  leftOffset: number
  /**
   * Center of the reference arc (in OCS)
   */
  center: DwgPoint3D
  /**
   * Radius of the reference arc
   */
  radius: number
  /**
   * Start angle of the reference arc
   */
  startAngle: number
  /**
   * End angle of the reference arc
   */
  endAngle: number
  /**
   * Extrusion direction (optional; default = 0, 0, 1)
   */
  extrusionDirection: DwgPoint3D
  /**
   * Raw text color: 0 ByBlock, 256 ByLayer, 1-255 ACI, or a true-color method
   */
  rawTextColor: number
  characterSet: number
  pitchAndFamily: number
  isShx: boolean
  isBold: boolean
  isItalic: boolean
  isUnderlined: boolean
  /**
   * 1 Fit, 2 Left, 3 Right, 4 Center
   */
  alignment: number
  isReverse: boolean
  wizardFlag: number
  /**
   * 1 OnConvexSide, 2 OnConcaveSide
   */
  textPosition: number
  /**
   * 1 OutwardFromCenter, 2 InwardToTheCenter
   */
  textDirection: number
  /**
   * Handle of the associated ARC, if any
   */
  arcHandle: string
}
