import { DwgPoint2D, DwgPoint3D } from '../common'
import { DwgCommonObject } from './common'

export interface DwgSpatialFilterObject extends DwgCommonObject {
  /**
   * Origin used to define the local coordinate system of the clip boundary
   */
  origin: DwgPoint3D
  /**
   * Number of points on the clip boundary
   * - 2 = Rectangular clip boundary (lower-left and upper-right)
   * - greater than 2 = Polyline clip boundary
   */
  numberOfPointsOnClipBoundary: number
  /**
   * Clip boundary definition point (in OCS) (always 2 or more) based on an xref scale of 1
   */
  vertices: DwgPoint2D[]
  /**
   * Extrusion direction (optional; default = 0, 0, 1)
   */
  extrusionDirection: DwgPoint3D
  /**
   * Clip boundary display enabled flag
   * - 0 = Disabled
   * - 1 = Enabled
   */
  clipBoundaryVisible: boolean
  /**
   * Front clipping plane flag
   * - 0 = No
   * - 1 = Yes
   */
  frontClippingPlaneFlag: boolean
  /**
   * Front clipping plane distance if clipBoundaryVisible is true (1)
   */
  frontClippingPlaneDistance: number
  /**
   * Back clipping plane flag
   * - 0 = No
   * - 1 = Yes
   */
  backClippingPlaneFlag: boolean
  /**
   * Back clipping plane distance if clipBoundaryVisible is true (1)
   */
  backClippingPlaneDistance: number
  /**
   * 4x3 transformation matrix written out in column major order. This matrix transforms
   * points into the coordinate system of the clip boundary (12 entries).
   */
  matrix: number[]
  /**
   * 4x3 transformation matrix written out in column major order. This matrix is the inverse
   * of the original block reference (insert entity) transformation. The original block
   * reference transformation is the one that is applied to all entities in the block when
   * the block reference is regenerated (always 12 entries).
   */
  invertBlockMatrix: number[]
}
