import { DwgClass } from './classes'
import { DwgEntity } from './entities'
import { DwgHeader } from './header'
import {
  DwgDictionaryObject,
  DwgImageDefObject,
  DwgLayoutObject,
  DwgSpatialFilterObject
} from './objects'
import {
  DwgAppIdEntry,
  DwgBlockRecordTableEntry,
  DwgDimStyleTableEntry,
  DwgLayerTableEntry,
  DwgLTypeTableEntry,
  DwgStyleTableEntry,
  DwgTable,
  DwgVPortTableEntry
} from './tables'

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
    LAYOUT: DwgLayoutObject[]
    SPATIAL_FILTER: DwgSpatialFilterObject[]
  }
  header: DwgHeader
  /**
   * All of entities in the model space.
   */
  entities: DwgEntity[]
  classes: DwgClass[]
}
