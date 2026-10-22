import { DwgClass } from './classes/index.js'
import { DwgEntity } from './entities/index.js'
import { DwgHeader } from './header/index.js'
import {
  DwgDictionaryObject,
  DwgImageDefObject,
  DwgLayerFilterObject,
  DwgLayerIndexObject,
  DwgLayoutObject,
  DwgMLeaderStyleObject,
  DwgSpatialFilterObject,
  DwgXRecordObject
} from './objects/index.js'
import {
  DwgAppIdEntry,
  DwgBlockRecordTableEntry,
  DwgDimStyleTableEntry,
  DwgLayerTableEntry,
  DwgLTypeTableEntry,
  DwgStyleTableEntry,
  DwgTable,
  DwgVPortTableEntry
} from './tables/index.js'

export interface DwgDatabase {
  tables: {
    APPID: DwgTable<DwgAppIdEntry>
    BLOCK_RECORD: DwgTable<DwgBlockRecordTableEntry>
    DIMSTYLE: DwgTable<DwgDimStyleTableEntry>
    LAYER: DwgTable<DwgLayerTableEntry>
    LTYPE: DwgTable<DwgLTypeTableEntry>
    STYLE: DwgTable<DwgStyleTableEntry>
    VPORT: DwgTable<DwgVPortTableEntry>
  }
  objects: {
    DICTIONARY: DwgDictionaryObject[]
    IMAGEDEF: DwgImageDefObject[]
    LAYER_FILTER: DwgLayerFilterObject[]
    LAYER_INDEX: DwgLayerIndexObject[]
    LAYOUT: DwgLayoutObject[]
    MLEADERSTYLE: DwgMLeaderStyleObject[]
    SPATIAL_FILTER: DwgSpatialFilterObject[]
    XRECORD: DwgXRecordObject[]
  }
  thumbnailImage?: Uint8Array
  header: DwgHeader
  /**
   * All of entities in the model space.
   */
  entities: DwgEntity[]
  classes: DwgClass[]
}
