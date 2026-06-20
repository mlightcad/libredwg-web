import { DwgPoint3D } from '../common'
import { DwgEntity } from './entity'

/**
 * MULTILEADER entity fields mapped from AutoCAD DXF MLEADER group codes.
 *
 * References:
 * - https://help.autodesk.com/cloudhelp/2023/ENU/AutoCAD-DXF/files/GUID-69B9139A-48B4-48A5-B3CF-A3233ABFBE49.htm
 * - https://github.com/mlightcad/dxf-json/blob/main/src/parser/entities/multileader/types.ts
 */
export interface DwgMultiLeaderEntity extends DwgEntity {
  type: 'MULTILEADER'

  subclassMarker?: 'AcDbMLeader'

  /** Group code 270: MLeader version. */
  version?: number

  /** Group code 340: leader style ID (handle reference). */
  leaderStyleId?: string

  /** Group code 90: property override bit flags. */
  propertyOverrideFlag?: number

  /** Group code 170: leader line type. */
  leaderLineType?: number

  /** Group code 91: leader line color (DXF raw int32). */
  leaderLineColor?: number

  /** Group code 341: leader line type ID (handle reference to linetype). */
  leaderLineTypeId?: string

  /** Group code 171: leader line weight. */
  leaderLineWeight?: number

  /** Group code 290: enable landing. */
  landingEnabled?: boolean

  /** Group code 291: enable dogleg. */
  doglegEnabled?: boolean

  /** Group code 41: dogleg length. */
  doglegLength?: number

  /** Group code 342: arrowhead ID (handle reference). */
  arrowheadId?: string

  /** Group code 42: arrowhead size. */
  arrowheadSize?: number

  /** Group code 172: content type (none / MText / block). */
  contentType?: number

  /** Group code 343: text style ID (handle reference). */
  textStyleId?: string

  /** Group code 173: text left attachment type. */
  textLeftAttachmentType?: number

  /** Group code 95: text right attachment type. */
  textRightAttachmentType?: number

  /** Group code 174: text angle type. */
  textAngleType?: number

  /** Group code 175: text alignment type. */
  textAlignmentType?: number

  /** Group code 92: text color in common MLeader data (DXF raw int32). */
  textColor?: number

  /** Group code 292: enable text frame. */
  textFrameEnabled?: boolean

  /** Group code 145 in CONTEXT_DATA: landing gap. */
  landingGap?: number

  /** Group code 171 in CONTEXT_DATA: text attachment mode. */
  textAttachment?: number

  /** Group code 172 in CONTEXT_DATA: text flow direction. */
  textFlowDirection?: number

  /** Group code 344 (common) / 341 (CONTEXT_DATA): block content ID. */
  blockContentId?: string

  /** Group code 93: block content color (DXF raw int32). */
  blockContentColor?: number

  /** Group code 10: block content scale. */
  blockContentScale?: DwgPoint3D

  /** Group code 43: block content rotation. */
  blockContentRotation?: number

  /** Group code 176: block content connection type. */
  blockContentConnectionType?: number

  /** Group code 293: enable annotation scale. */
  annotativeScaleEnabled?: boolean

  /** Group code pair 94 + 345 (repeated). */
  arrowheadOverrides?: DwgMultiLeaderIndexedHandle[]

  /** Repeated block attribute override entries. */
  blockAttributes?: DwgMultiLeaderBlockAttribute[]

  /** Group code 294: text direction negative flag. */
  textDirectionNegative?: boolean

  /** Group code 178: text align in IPE flag/value. */
  textAlignInIPE?: number

  /** Group code 179: text attachment point. */
  textAttachmentPoint?: number

  /** Group code 271: text attachment direction for MText content. */
  textAttachmentDirection?: number

  /** Group code 273: bottom text attachment direction. */
  bottomTextAttachmentDirection?: number

  /** Group code 272: top text attachment direction. */
  topTextAttachmentDirection?: number

  /** CONTEXT_DATA group code 40: content scale. */
  contentScale?: number

  /** CONTEXT_DATA group codes 10/20/30: content base position. */
  contentBasePosition?: DwgPoint3D

  /** CONTEXT_DATA group codes 11/21/31: text normal direction vector. */
  normal?: DwgPoint3D

  /** CONTEXT_DATA group codes 41 and 44: text height. */
  textHeight?: number

  /** CONTEXT_DATA group code 42: text rotation. */
  textRotation?: number

  /** CONTEXT_DATA group code 43: text width. */
  textWidth?: number

  /** CONTEXT_DATA group code 45: text line spacing factor. */
  textLineSpacingFactor?: number

  /** CONTEXT_DATA group code 170: text line spacing style. */
  textLineSpacingStyle?: number

  /** CONTEXT_DATA group codes 12/22/32: text location (anchor point). */
  textAnchor?: DwgPoint3D

  /** CONTEXT_DATA group codes 13/23/33: text direction vector. */
  textDirection?: DwgPoint3D

  /** CONTEXT_DATA group code 91: text background color (DXF raw int32). */
  textBackgroundColor?: number

  /** CONTEXT_DATA group code 141: text background scale factor. */
  textBackgroundScaleFactor?: number

  /** CONTEXT_DATA group code 92: text background transparency. */
  textBackgroundTransparency?: number

  /** CONTEXT_DATA group code 291: text background color on/off. */
  textBackgroundColorOn?: boolean

  /** CONTEXT_DATA group code 292: text background fill on/off. */
  textFillOn?: boolean

  /** CONTEXT_DATA group code 173: text column type. */
  textColumnType?: number

  /** CONTEXT_DATA group code 293: use text auto height. */
  textUseAutoHeight?: boolean

  /** CONTEXT_DATA group code 142: text column width. */
  textColumnWidth?: number

  /** CONTEXT_DATA group code 143: text column gutter width. */
  textColumnGutterWidth?: number

  /** CONTEXT_DATA group code 294: text column flow reversed. */
  textColumnFlowReversed?: boolean

  /** CONTEXT_DATA group code 144: text column height. */
  textColumnHeight?: number

  /** CONTEXT_DATA group code 295: use word break for text columns. */
  textUseWordBreak?: boolean

  /** CONTEXT_DATA group code 304: default/actual text content. */
  textContent?: string

  /** CONTEXT_DATA group code 290: has MText content flag. */
  hasMText?: boolean

  /** CONTEXT_DATA group code 296: has block content flag. */
  hasBlock?: boolean

  /** CONTEXT_DATA block content bundle. */
  blockContent?: DwgMultiLeaderBlockContent

  /** CONTEXT_DATA group codes 110/120/130: MLeader plane origin point. */
  planeOrigin?: DwgPoint3D

  /** CONTEXT_DATA group codes 111/121/131: MLeader plane X-axis direction. */
  planeXAxisDirection?: DwgPoint3D

  /** CONTEXT_DATA group codes 112/122/132: MLeader plane Y-axis direction. */
  planeYAxisDirection?: DwgPoint3D

  /** CONTEXT_DATA group code 297: plane normal reversed flag. */
  planeNormalReversed?: boolean

  /** CONTEXT_DATA nested LEADER sections. */
  leaderSections?: DwgMultiLeaderLeaderSection[]
}

export interface DwgMultiLeaderLeaderSection {
  lastLeaderLinePoint?: DwgPoint3D
  lastLeaderLinePointSet?: boolean
  doglegVector?: DwgPoint3D
  doglegVectorSet?: boolean
  doglegLength?: number
  breaks?: DwgMultiLeaderBreak[]
  leaderBranchIndex?: number
  leaderLines: DwgMultiLeaderLeaderLine[]
}

export interface DwgMultiLeaderLeaderLine {
  vertices: DwgPoint3D[]
  breakPointIndexes?: number[]
  leaderLineIndex?: number
  breaks?: DwgMultiLeaderBreak[]
}

export interface DwgMultiLeaderBreak {
  index?: number
  start: DwgPoint3D
  end: DwgPoint3D
}

export interface DwgMultiLeaderIndexedHandle {
  index: number
  handle: string
}

export interface DwgMultiLeaderBlockAttribute {
  id?: string
  index?: number
  width?: number
  text?: string
}

export interface DwgMultiLeaderBlockContent {
  blockContentId?: string
  normal?: DwgPoint3D
  position?: DwgPoint3D
  scale?: DwgPoint3D
  rotation?: number
  color?: number
  transformationMatrix?: number[]
}
