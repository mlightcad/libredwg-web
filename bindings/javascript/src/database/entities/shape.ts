import { DwgPoint3D } from '../common'
import { DwgEntity } from './entity'

export interface DwgShapeEntity extends DwgEntity {
  /**
   * Entity type
   */
  type: 'SHAPE'
  /**
   * DXF subclass marker
   */
  subclassMarker: 'AcDbShape'
  /**
   * Thickness (optional; default = 0)
   */
  thickness: number
  /**
   * Insertion point (in OCS)
   */
  insertionPoint: DwgPoint3D
  /**
   * Size
   */
  size: number
  /**
   * Shape number (DXF group 2): index of the shape within the shape file, not
   * the shape file or text style name.
   */
  shapeNumber: number
  /**
   * The text style name that references the SHX font for this shape.
   */
  styleName: string
  /**
   * Rotation angle (optional; default = 0)
   */
  rotation: number
  /**
   * Relative X scale factor (optional; default = 1)
   */
  xScale: number
  /**
   * Oblique angle (optional; default = 0)
   */
  obliqueAngle: number
  /**
   * Extrusion direction (optional; default = 0, 0, 1)
   */
  extrusionDirection: DwgPoint3D
}
