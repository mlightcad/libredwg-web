import { DwgPoint3D } from '../common'
import { DwgCommonObject } from './common'

/**
 * MLEADERSTYLE object fields mapped from AutoCAD DXF group codes.
 *
 * Reference:
 * - https://help.autodesk.com/cloudhelp/2016/ENU/AutoCAD-DXF/files/GUID-0E489B69-17A4-4439-8505-9DCE032100B4.htm
 * - https://github.com/mlightcad/dxf-json/blob/main/src/parser/objects/mleaderStyle/types.ts
 */
export interface DwgMLeaderStyleObject extends DwgCommonObject {
  subclassMarker: 'AcDbMLeaderStyle'

  /** Group code 179: undocumented value observed in AutoCAD-generated objects. */
  unknown1?: number

  /** Group code 170: content type used by this MLeader style. */
  contentType?: number

  /** Group code 171: draw MLeader order type. */
  drawMLeaderOrderType?: number

  /** Group code 172: draw leader order type. */
  drawLeaderOrderType?: number

  /** Group code 90: max leader segment points. */
  maxLeaderSegmentPoints?: number

  /** Group code 40: first segment angle constraint. */
  firstSegmentAngleConstraint?: number

  /** Group code 41: second segment angle constraint. */
  secondSegmentAngleConstraint?: number

  /** Group code 173: leader line type. */
  leaderLineType?: number

  /** Group code 91: leader line color (DXF raw int32). */
  leaderLineColor?: number

  /** Group code 340: leader line type ID (handle reference). */
  leaderLineTypeId?: string

  /** Group code 92: leader line weight. */
  leaderLineWeight?: number

  /** Group code 290: enable landing. */
  landingEnabled?: boolean

  /** Group code 42: landing gap. */
  landingGap?: number

  /** Group code 291: enable dogleg. */
  doglegEnabled?: boolean

  /** Group code 43: dogleg length. */
  doglegLength?: number

  /** Group code 3: MLeader style description. */
  description?: string

  /** Group code 341: arrowhead ID (handle reference). */
  arrowheadId?: string

  /** Group code 44: arrowhead size. */
  arrowheadSize?: number

  /** Group code 300: default MText contents. */
  defaultMTextContents?: string

  /** Group code 342: MText style ID (handle reference). */
  textStyleId?: string

  /** Group code 174: text left attachment type. */
  textLeftAttachmentType?: number

  /** Group code 175: text angle type. */
  textAngleType?: number

  /** Group code 176: text alignment type. */
  textAlignmentType?: number

  /** Group code 178: text right attachment type. */
  textRightAttachmentType?: number

  /** Group code 93: text color (DXF raw int32). */
  textColor?: number

  /** Group code 45: text height. */
  textHeight?: number

  /** Group code 292: enable frame text. */
  textFrameEnabled?: boolean

  /** Group code 297: text align always left. */
  textAlignAlwaysLeft?: boolean

  /** Group code 46: align space. */
  alignSpace?: number

  /** Group code 343: block content ID (handle reference). */
  blockContentId?: string

  /** Group code 94: block content color (DXF raw int32). */
  blockContentColor?: number

  /** Group codes 47/49/140: block content scale on X/Y/Z axes. */
  blockContentScale?: DwgPoint3D

  /** Group code 293: enable block content scale. */
  blockContentScaleEnabled?: boolean

  /** Group code 141: block content rotation. */
  blockContentRotation?: number

  /** Group code 294: enable block content rotation. */
  blockContentRotationEnabled?: boolean

  /** Group code 177: block content connection type. */
  blockContentConnectionType?: number

  /** Group code 142: scale. */
  scale?: number

  /** Group code 295: overwrite property value flag. */
  overwritePropertyValue?: boolean

  /** Group code 296: annotative flag. */
  annotative?: boolean

  /** Group code 143: break gap size. */
  breakGapSize?: number

  /** Group code 271: text attachment direction for MText content. */
  textAttachmentDirection?: number

  /** Group code 272: bottom text attachment direction. */
  bottomTextAttachmentDirection?: number

  /** Group code 273: top text attachment direction. */
  topTextAttachmentDirection?: number

  /** Group code 298: undocumented flag observed in AutoCAD-generated objects. */
  unknown2?: boolean
}
