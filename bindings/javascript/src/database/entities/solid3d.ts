import { DwgEntity } from './entity'

export interface DwgSolid3dEntity extends DwgEntity {
  /**
   * Entity type
   */
  type: '3DSOLID'
  /**
   * DXF subclass marker
   */
  subclassMarker: 'AcDb3dSolid'
  /**
   * Modeler format version number (currently = 1)
   */
  version?: number
  /**
   * SAT cache flag (group 290, R2013+)
   */
  satCache?: number
  /**
   * GUID string (group 2, R2013+)
   */
  guid?: string
  /**
   * Proprietary ACIS/SAT data
   */
  data?: string
  /**
   * Soft-owner ID/handle to history object
   */
  historyObjectSoftId?: string
}
