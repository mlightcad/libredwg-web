import {
  DwgAppIdEntry,
  DwgAssocActionObject,
  DwgAssocActionParamObject,
  DwgAssocArrayActionBodyObject,
  DwgAssocArrayItem,
  DwgAssocDependencyObject,
  DwgAssocEdgeActionParamObject,
  DwgAssocHandleRef,
  DwgAssocNetworkObject,
  DwgAssocValueParam,
  DwgAssocVertexActionParamObject,
  DwgBlockRecordTableEntry,
  DwgClass,
  DwgCommonObject,
  DwgCommonTableEntry,
  DwgDatabase,
  DwgDictionaryObject,
  DwgDimStyleTableEntry,
  DwgEntity,
  DwgGroupObject,
  DwgHeader,
  DwgImageDefObject,
  DwgInsertEntity,
  DwgLayerFilterObject,
  DwgLayerIndexObject,
  DwgLayerTableEntry,
  DwgLayoutObject,
  DwgLineTypeElement,
  DwgLTypeTableEntry,
  DwgMLeaderStyleObject,
  DwgPoint2D,
  DwgPoint3D,
  DwgSpatialFilterObject,
  DwgStyleTableEntry,
  DwgViewportEntity,
  DwgVPortTableEntry,
  DwgXRecordObject,
  HEADER_VARIABLES
} from '../database/index.js'
import { LibreDwgEx } from '../libredwg.js'
import {
  Dwg_Array_Ptr,
  Dwg_Color,
  Dwg_Data_Ptr,
  Dwg_LTYPE_Dash,
  Dwg_Object_Entity_TIO_Ptr,
  Dwg_Object_Object_Ptr,
  Dwg_Object_Object_TIO_Ptr,
  Dwg_Object_Ptr,
  Dwg_Object_Ref_Ptr,
  Dwg_Object_Supertype,
  Dwg_Object_Type
} from '../types/index.js'
import { dwgColorToMLeaderRawColor } from './dwgColorToMLeaderRawColor.js'
import { LibreEntityConverter } from './entityConverter.js'
import { idToString, isModelSpace, isPaperSpace, uint8ArrayToHexString } from './utils.js'

/**
 * Class used to convert Dwg_Data instance to DwgDatabase instance.
 */
export class LibreDwgConverter {
  private libredwg: LibreDwgEx
  private entityConverter: LibreEntityConverter
  /**
   * Entity object indices keyed by owning BLOCK_HEADER object pointer.
   * Built lazily when an ownership walk returns no entities (LibreDWG
   * https://github.com/LibreDWG/libredwg/issues/1199).
   */
  private orphanEntitiesByBlock: Map<number, number[]> | null = null
  /** Entity indices whose ownerhandle does not resolve to any object. */
  private ownerlessOrphanIndices: number[] | null = null
  private orphanIndexDataPtr: Dwg_Data_Ptr | null = null

  constructor(instance: LibreDwgEx) {
    this.libredwg = instance
    this.entityConverter = new LibreEntityConverter(instance)
  }

  /**
   * True when LAYER.plotflag (DXF 290) is present in the file format
   * (LibreDWG: SINCE R_2000b / binary version >= 0x16).
   * Cleared for older versions so convertLayer defaults plotFlag to 1 instead
   * of LibreDWG's zeroed bit (which would mark every layer non-plottable).
   */
  private layerPlotFlagSupported = true

  convert(data: Dwg_Data_Ptr) {
    this.entityConverter.clear()
    this.orphanEntitiesByBlock = null
    this.ownerlessOrphanIndices = null
    this.orphanIndexDataPtr = data
    this.layerPlotFlagSupported = true
    const db: DwgDatabase = {
      tables: {
        APPID: {
          entries: []
        },
        BLOCK_RECORD: {
          entries: []
        },
        DIMSTYLE: {
          entries: []
        },
        LAYER: {
          entries: []
        },
        LTYPE: {
          entries: []
        },
        STYLE: {
          entries: []
        },
        VPORT: {
          entries: []
        }
      },
      objects: {
        ASSOCNETWORK: [],
        ASSOCACTION: [],
        ASSOCDEPENDENCY: [],
        ASSOCARRAYACTIONBODY: [],
        ASSOCVERTEXACTIONPARAM: [],
        ASSOCEDGEACTIONPARAM: [],
        DICTIONARY: [],
        GROUP: [],
        IMAGEDEF: [],
        LAYER_FILTER: [],
        LAYER_INDEX: [],
        LAYOUT: [],
        MLEADERSTYLE: [],
        SPATIAL_FILTER: [],
        XRECORD: []
      },
      header: {},
      entities: [],
      classes: []
    }
    const libredwg = this.libredwg
    this.convertHeader(data, db.header)
    // Prefer the binary DWG version over ACADVER string compares (MC0.0 etc.).
    // Unknown/invalid (version 0) also defaults plotFlag to 1 below.
    this.layerPlotFlagSupported =
      libredwg.dwg_get_version_type(data).version >= 0x16
    this.convertClasses(data, db.classes)
    this.entityConverter.setClasses(db.classes)
    const num_objects = libredwg.dwg_get_num_objects(data)

    for (let i = 0; i < num_objects; i++) {
      const obj = libredwg.dwg_get_object(data, i)
      if (obj) {
        const tio = this.safeObjectTio(obj)
        if (tio) {
          const fixedtype = libredwg.dwg_object_get_fixedtype(obj)
          switch (fixedtype) {
            case Dwg_Object_Type.DWG_TYPE_LAYER:
              {
                const layer = this.convertLayer(tio, obj)
                db.tables.LAYER.entries.push(layer)
                this.entityConverter.layers.set(layer.handle, layer.name)
              }
              break
            case Dwg_Object_Type.DWG_TYPE_LTYPE:
              {
                const ltype = this.convertLineType(tio, obj)
                db.tables.LTYPE.entries.push(ltype)
                this.entityConverter.ltypes.set(ltype.handle, ltype.name)
              }
              break
            default:
              break
          }
        }
      }
    }

    for (let i = 0; i < num_objects; i++) {
      const obj = libredwg.dwg_get_object(data, i)
      if (obj) {
        const tio = this.safeObjectTio(obj)
        if (tio) {
          const fixedtype = libredwg.dwg_object_get_fixedtype(obj)
          switch (fixedtype) {
            case Dwg_Object_Type.DWG_TYPE_APPID:
              db.tables.APPID.entries.push(this.convertAppId(tio))
              break
            case Dwg_Object_Type.DWG_TYPE_BLOCK_HEADER:
              {
                const btr = this.convertBlockRecord(tio, obj)
                db.tables.BLOCK_RECORD.entries.push(btr)
                // Store entities in model space and paper space to db.entities to keep the
                // the consistent data structure as DXF file
                if (isModelSpace(btr.name) || isPaperSpace(btr.name)) {
                  btr.entities.forEach(entity => {
                    db.entities.push(entity)
                    // Store ATTRIB entity in db.entities to keep the the consistent data
                    // structure as DXF file
                    if (entity.type === 'INSERT') {
                      (entity as DwgInsertEntity).attribs.forEach(attrib => {
                        db.entities.push(attrib)
                      })
                    }
                  })
                }
              }
              break
            case Dwg_Object_Type.DWG_TYPE_DIMSTYLE:
              db.tables.DIMSTYLE.entries.push(this.convertDimStyle(tio, obj))
              break
            case Dwg_Object_Type.DWG_TYPE_STYLE:
              db.tables.STYLE.entries.push(this.convertStyle(tio, obj))
              break
            case Dwg_Object_Type.DWG_TYPE_VPORT:
              db.tables.VPORT.entries.push(this.convertViewport(tio, obj))
              break
            case Dwg_Object_Type.DWG_TYPE_DICTIONARY:
              db.objects.DICTIONARY.push(this.convertDictionary(tio, obj))
              break
            case Dwg_Object_Type.DWG_TYPE_GROUP:
              db.objects.GROUP.push(this.convertGroup(tio, obj))
              break
            case Dwg_Object_Type.DWG_TYPE_IMAGEDEF:
              db.objects.IMAGEDEF.push(this.convertImageDef(tio, obj))
              break
            case Dwg_Object_Type.DWG_TYPE_LAYERFILTER:
              db.objects.LAYER_FILTER.push(this.convertLayerFilter(tio, obj))
              break
            case Dwg_Object_Type.DWG_TYPE_LAYER_INDEX:
              db.objects.LAYER_INDEX.push(this.convertLayerIndex(tio, obj))
              break
            case Dwg_Object_Type.DWG_TYPE_LAYOUT:
              db.objects.LAYOUT.push(this.convertLayout(tio, obj))
              break
            case Dwg_Object_Type.DWG_TYPE_MLEADERSTYLE:
              db.objects.MLEADERSTYLE.push(this.convertMLeaderStyle(tio, obj))
              break
            case Dwg_Object_Type.DWG_TYPE_SPATIAL_FILTER:
              db.objects.SPATIAL_FILTER.push(
                this.convertSpatialFilter(tio, obj)
              )
              break
            case Dwg_Object_Type.DWG_TYPE_XRECORD:
              db.objects.XRECORD.push(this.convertXRecord(tio, obj))
              break
            case Dwg_Object_Type.DWG_TYPE_ASSOCNETWORK:
              db.objects.ASSOCNETWORK.push(this.convertAssocNetwork(tio, obj))
              break
            case Dwg_Object_Type.DWG_TYPE_ASSOCACTION:
              db.objects.ASSOCACTION.push(this.convertAssocAction(tio, obj))
              break
            case Dwg_Object_Type.DWG_TYPE_ASSOCDEPENDENCY:
              db.objects.ASSOCDEPENDENCY.push(
                this.convertAssocDependency(tio, obj)
              )
              break
            case Dwg_Object_Type.DWG_TYPE_ASSOCARRAYACTIONBODY:
              db.objects.ASSOCARRAYACTIONBODY.push(
                this.convertAssocArrayActionBody(tio, obj)
              )
              break
            case Dwg_Object_Type.DWG_TYPE_ASSOCVERTEXACTIONPARAM:
              db.objects.ASSOCVERTEXACTIONPARAM.push(
                this.convertAssocVertexActionParam(tio, obj)
              )
              break
            case Dwg_Object_Type.DWG_TYPE_ASSOCEDGEACTIONPARAM:
              db.objects.ASSOCEDGEACTIONPARAM.push(
                this.convertAssocEdgeActionParam(tio, obj)
              )
              break
            default:
              break
          }
        }
      }
    }

    // Process viewport entities: sort by objectId (handle) and assign viewportId
    const viewportEntities = db.entities.filter(
      entity => entity.type === 'VIEWPORT'
    ) as DwgViewportEntity[]
    viewportEntities.sort((a, b) => {
      // Convert handle to hex number for sorting
      const handleA = parseInt(a.handle, 16)
      const handleB = parseInt(b.handle, 16)
      return handleA - handleB
    })

    // Assign viewportId starting from 1
    viewportEntities.forEach((viewport, index) => {
      viewport.viewportId = index + 1
    })

    const thumbnail = libredwg.dwg_bmp(data)
    if (thumbnail?.data?.length) {
      db.thumbnailImage = thumbnail.data
    }

    return db
  }

  getConversionStats() {
    return {
      unknownEntityCount: this.entityConverter.unknownEntityCount
    }
  }

  private safeObjectTio(obj: Dwg_Object_Ptr): Dwg_Object_Object_TIO_Ptr | null {
    const libredwg = this.libredwg
    try {
      if (
        libredwg.dwg_object_get_supertype(obj) !=
        Dwg_Object_Supertype.DWG_SUPERTYPE_OBJECT
      ) {
        return null
      }
      const tio = libredwg.dwg_object_to_object_tio(obj)
      return tio ? tio : null
    } catch {
      return null
    }
  }

  private convertHeader(data: Dwg_Data_Ptr, header: DwgHeader) {
    const libredwg = this.libredwg
    HEADER_VARIABLES.forEach(name => {
      let var_name = name
      if (name == 'DIMBLK' || name == 'DIMBLK1' || name == 'DIMBLK2') {
        var_name = var_name + '_T'
      }
      let value = libredwg.dwg_dynapi_header_data<number | string>(data, var_name)

      // Get object name if the 'value' is one Dwg_Object_Ref instance.
      // TODO: handle 'CMLSTYLE' correctly
      if (
        name == 'CELTYPE' ||
        name == 'CLAYER' ||
        name == 'CLAYER' ||
        name == 'DIMSTYLE' ||
        name == 'DIMTXSTY' ||
        name == 'TEXTSTYLE'
      ) {
        value = value ? libredwg.dwg_ref_get_object_name(value as number) : ''
      } else if (name == 'DRAGVS') {
        value = value ? (libredwg.dwg_ref_get_absref(value as number) ?? 2) : 2
      }
      // @ts-expect-error header variable name
      header[name] = value
    })
  }

  private convertClasses(data: Dwg_Data_Ptr, classes: DwgClass[]) {
    const libredwg = this.libredwg
    const count = libredwg.dwg_get_num_classes(data)
    for (let index = 0; index < count; index++) {
      const cls = libredwg.dwg_get_class(data, index)
      classes.push({
        dxfName: cls.dxfname,
        cppName: cls.cppname,
        appName: cls.appname,
        capabilitiesFlag: cls.proxyflag,
        instanceCount: cls.num_instances,
        wasAProxyFlag: cls.s_zombie,
        // DWG_TYPE_PROXY_ENTITY = 0x1F2 /* 498 */,
        // DWG_TYPE_PROXY_OBJECT = 0x1F3 /* 499 */,
        isAnEntityFlag: cls.item_class_id === 0x1f2
      })
    }
  }

  private convertAppId(item: Dwg_Object_Object_Ptr): DwgAppIdEntry {
    const libredwg = this.libredwg
    const name = libredwg.dwg_dynapi_entity_data<string>(item, 'name')
    const flag = libredwg.dwg_dynapi_entity_data<number>(item, 'flag')

    return {
      name: name,
      standardFlag: flag
    }
  }

  private convertBlockRecord(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgBlockRecordTableEntry {
    const libredwg = this.libredwg
    const commonAttrs = this.getCommonTableEntryAttrs(item, obj)

    // The BLOCK_HEADER has only the abbrevated name, but we want "*D30" instead of "*D".
    // So get full name from BLOCK entity.
    const block = libredwg.dwg_entity_block_header_get_block(item)
    if (block.name) {
      commonAttrs.name = block.name
    }

    // The number of entities
    const num_owned = libredwg.dwg_dynapi_entity_data<number>(item, 'num_owned')

    const flags = libredwg.dwg_dynapi_entity_data<number>(item, 'flag')
    const description = libredwg.dwg_dynapi_entity_data<string>(item, 'description')
    const basePoint = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(item, 'base_pt')
    const insertionUnits = libredwg.dwg_dynapi_entity_data<number>(item, 'insert_units')
    const explodability = libredwg.dwg_dynapi_entity_data<number>(item, 'explodable')
    const scalability = libredwg.dwg_dynapi_entity_data<number>(item, 'block_scaling')
    const layout_ptr = libredwg.dwg_dynapi_entity_data<number>(item, 'layout')
    const layout = (libredwg.dwg_ref_get_id(layout_ptr) ?? '')

    let bmpPreview: string | undefined
    const bmpPreviewBinaryData =
      libredwg.dwg_entity_block_header_get_preview(item)
    if (bmpPreviewBinaryData && bmpPreviewBinaryData.length > 0) {
      bmpPreview = uint8ArrayToHexString(bmpPreviewBinaryData)
    }

    // Sometimes function get_first_owned_entity returns 0 when trying to iterate entities in one block.
    // I guess it is one bug on libredwg. I logged [one bug](https://github.com/LibreDWG/libredwg/issues/1199)
    // on libredwg too. In this time, I try to use property 'entities' of block header to iterate entities.
    let entities = this.convertEntities(obj, commonAttrs.handle)
    if (!entities || entities.length == 0) {
      entities = []
      const entities_ptr = libredwg.dwg_dynapi_entity_data<number>(item, 'entities')
      if (entities_ptr) {
        const object_ref_ptr_array = libredwg.dwg_ptr_to_object_ref_ptr_array(
          entities_ptr,
          num_owned
        )
        const converter = this.entityConverter
        for (let index = 0; index < num_owned; index++) {
          const object = libredwg.dwg_ref_get_object(
            object_ref_ptr_array[index]
          )
          const entity = converter.convert(object)
          if (entity) {
            entity.ownerBlockRecordSoftId = commonAttrs.handle
            entities.push(entity)
          }
        }
      }
    }
    // Some DWG writers (including LibreDWG's own) declare first_entity /
    // last_entity handles that resolve to no object, or only link a
    // partial ownership chain. Fall back to entity objects whose owner
    // (ownerhandle / entmode via dwg_entity_owner) names this block.
    // For *Model_Space only, also pick up entities with no resolvable owner.
    if (this.orphanIndexDataPtr != null) {
      const orphans = this.convertOrphanOwnedEntities(
        this.orphanIndexDataPtr,
        obj,
        commonAttrs.handle,
        isModelSpace(commonAttrs.name) === true
      )
      if (orphans.length) {
        if (entities.length === 0) {
          entities = orphans
        } else {
          const seen = new Set(entities.map(e => e.handle))
          for (const entity of orphans) {
            if (!seen.has(entity.handle)) {
              entities.push(entity)
            }
          }
        }
      }
    }

    return {
      ...commonAttrs,
      flags: flags,
      description: description,
      basePoint: basePoint,
      layout: layout,
      insertionUnits: insertionUnits,
      explodability: explodability,
      scalability: scalability,
      bmpPreview: bmpPreview,
      entities: entities
    }
  }

  private convertEntities(
    obj: Dwg_Object_Ptr,
    ownerHandle: string
  ): DwgEntity[] {
    const libredwg = this.libredwg
    const converter = this.entityConverter
    const entities: DwgEntity[] = []
    let next = libredwg.get_first_owned_entity(obj)
    while (next) {
      const entity = converter.convert(next)
      if (entity) {
        entity.ownerBlockRecordSoftId = ownerHandle
        entities.push(entity)
      }
      next = libredwg.get_next_owned_entity(obj, next)
    }
    return entities
  }

  /**
   * Builds (once) a map of BLOCK_HEADER object pointer → entity object indices
   * for entities that are not reachable through the ownership chain, then
   * converts the entities owned by `blockHeaderPtr`.
   *
   * @param includeOwnerless - When true (only for *Model_Space), also convert
   *   entities that still have no resolvable owner after ownerhandle + entmode
   *   fallback via dwg_entity_owner.
   */
  private convertOrphanOwnedEntities(
    data: Dwg_Data_Ptr,
    blockHeaderPtr: Dwg_Object_Ptr,
    ownerHandle: string,
    includeOwnerless: boolean
  ): DwgEntity[] {
    this.ensureOrphanEntityIndex(data)
    const byBlock = this.orphanEntitiesByBlock ?? new Map<number, number[]>()
    const owned = byBlock.get(blockHeaderPtr) ?? []
    const ownerless =
      includeOwnerless && this.ownerlessOrphanIndices
        ? this.ownerlessOrphanIndices
        : []
    const indices = owned.length && ownerless.length
      ? owned.concat(ownerless)
      : owned.length
        ? owned
        : ownerless
    if (indices.length === 0) {
      return []
    }
    const libredwg = this.libredwg
    const converter = this.entityConverter
    const entities: DwgEntity[] = []
    for (const index of indices) {
      const object = libredwg.dwg_get_object(data, index)
      const entity = converter.convert(object)
      if (entity) {
        entity.ownerBlockRecordSoftId = ownerHandle
        entities.push(entity)
      }
    }
    return entities
  }

  /**
   * True when the entity is block-owned (`entmode` 0) but its owner handle
   * names an object that does not exist in the drawing.
   *
   * These are leftovers of erased blocks (typically stale anonymous `*D`
   * dimension pictures). AutoCAD never draws them, so they must not be
   * adopted into *Model_Space as ownerless orphans. Entities without an owner
   * handle are still adopted because some writers omit it for genuine
   * model-space entities.
   */
  private isOwnedByMissingBlock(
    data: Dwg_Data_Ptr,
    etio: Dwg_Object_Entity_TIO_Ptr
  ): boolean {
    if (!etio) return false
    const libredwg = this.libredwg
    try {
      const entmode = libredwg.dwg_dynapi_common_value(etio, 'entmode')
      if (!entmode.success || Number(entmode.data) !== 0) return false
      const ref = libredwg.dwg_dynapi_common_value(etio, 'ownerhandle')
      if (!ref.success || !ref.data) return false
      const absref = libredwg.dwg_ref_get_absref(ref.data as number)
      if (absref == null) return false
      return !libredwg.dwg_resolve_handle_silent(data, BigInt(absref))
    } catch {
      return false
    }
  }

  private ensureOrphanEntityIndex(data: Dwg_Data_Ptr): void {
    if (this.orphanEntitiesByBlock) {
      return
    }
    const libredwg = this.libredwg
    const numObjects = libredwg.dwg_get_num_objects(data)
    const indexByEntityPtr = new Map<number, number>()
    const entityIndices: number[] = []
    const blockHeaderPtrs: number[] = []
    // dwg_entity_owner returns a BLOCK_HEADER TIO pointer; map it back to the
    // Dwg_Object* used as the orphan-index key.
    const blockObjByTio = new Map<number, number>()

    for (let i = 0; i < numObjects; i++) {
      const obj = libredwg.dwg_get_object(data, i)
      if (!obj) continue
      if (
        libredwg.dwg_object_get_supertype(obj) ===
        Dwg_Object_Supertype.DWG_SUPERTYPE_ENTITY
      ) {
        entityIndices.push(i)
        indexByEntityPtr.set(obj, i)
      } else if (
        libredwg.dwg_object_get_fixedtype(obj) ===
        Dwg_Object_Type.DWG_TYPE_BLOCK_HEADER
      ) {
        blockHeaderPtrs.push(obj)
        const tio = libredwg.dwg_object_to_object_tio(obj)
        if (tio) blockObjByTio.set(tio, obj)
      }
    }

    const claimed = new Set<number>()
    for (const blockHeader of blockHeaderPtrs) {
      let current = libredwg.get_first_owned_entity(blockHeader)
      let steps = 0
      while (current && steps++ <= entityIndices.length) {
        const index = indexByEntityPtr.get(current)
        if (index === undefined || claimed.has(index)) break
        claimed.add(index)
        current = libredwg.get_next_owned_entity(blockHeader, current)
      }
    }

    const orphansByBlock = new Map<number, number[]>()
    const ownerless: number[] = []
    for (const index of entityIndices) {
      if (claimed.has(index)) continue
      const obj = libredwg.dwg_get_object(data, index)
      const etio = obj ? libredwg.dwg_object_to_entity_tio(obj) : 0
      // Resolves ownerhandle, then entmode → MSPACE/PSPACE (LibreDWG).
      const ownerTio = etio ? libredwg.dwg_entity_owner(etio) : 0
      const owner = ownerTio ? (blockObjByTio.get(ownerTio) ?? 0) : 0
      if (owner) {
        const owned = orphansByBlock.get(owner)
        if (owned) owned.push(index)
        else orphansByBlock.set(owner, [index])
      } else if (!this.isOwnedByMissingBlock(data, etio)) {
        ownerless.push(index)
      }
    }

    this.orphanEntitiesByBlock = orphansByBlock
    this.ownerlessOrphanIndices = ownerless
  }

  private convertDimStyle(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgDimStyleTableEntry {
    const libredwg = this.libredwg
    const commonAttrs = this.getCommonTableEntryAttrs(item, obj)
    const DIMTOL = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMTOL')
    const DIMLIM = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMLIM')
    const DIMTIH = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMTIH')
    const DIMTOH = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMTOH')
    const DIMSE1 = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMSE1')
    const DIMSE2 = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMSE2')
    const DIMALT = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMALT')
    const DIMTOFL = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMTOFL')
    const DIMSAH = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMSAH')
    const DIMTIX = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMTIX')
    const DIMSOXD = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMSOXD')
    const DIMALTD = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMALTD')
    const DIMZIN = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMZIN')
    const DIMSD1 = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMSD1')
    const DIMSD2 = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMSD2')
    const DIMTOLJ = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMTOLJ')
    const DIMJUST = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMJUST')
    const DIMFIT = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMFIT')
    const DIMUPT = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMUPT')
    const DIMTZIN = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMTZIN')
    const DIMALTZ = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMALTZ')
    const DIMALTTZ = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMALTTZ')
    const DIMTAD = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMTAD')
    const DIMUNIT = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMUNIT')
    const DIMAUNIT = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMAUNIT')
    const DIMDEC = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMDEC')
    const DIMTDEC = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMTDEC')
    const DIMALTU = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMALTU')
    const DIMALTTD = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMALTTD')
    const DIMSCALE = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMSCALE')
    const DIMASZ = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMASZ')
    const DIMEXO = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMEXO')
    const DIMDLI = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMDLI')
    const DIMEXE = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMEXE')
    const DIMRND = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMRND')
    const DIMDLE = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMDLE')
    const DIMTP = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMTP')
    const DIMTM = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMTM')
    const DIMFXL = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMFXL')
    const DIMJOGANG = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMJOGANG')
    const DIMTFILL = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMTFILL')
    const DIMTFILLCLR = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMTFILLCLR')
    const DIMAZIN = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMAZIN')
    const DIMARCSYM = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMARCSYM')
    const DIMTXT = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMTXT')
    const DIMCEN = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMCEN')
    const DIMTSZ = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMTSZ')
    const DIMALTF = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMALTF')
    const DIMLFAC = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMLFAC')
    const DIMTVP = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMTVP')
    const DIMTFAC = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMTFAC')
    const DIMGAP = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMGAP')
    const DIMPOST = libredwg.dwg_dynapi_entity_data<string>(item, 'DIMPOST')
    const DIMAPOST = libredwg.dwg_dynapi_entity_data<string>(item, 'DIMAPOST')
    const DIMBLK_T = libredwg.dwg_dynapi_entity_data<string>(item, 'DIMBLK_T')
    const DIMBLK1_T = libredwg.dwg_dynapi_entity_data<string>(item, 'DIMBLK1_T')
    const DIMBLK2_T = libredwg.dwg_dynapi_entity_data<string>(item, 'DIMBLK2_T')
    const DIMALTRND = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMALTRND')
    const DIMCLRD_N = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMCLRD_N')
    const DIMCLRE_N = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMCLRE_N')
    const DIMCLRT_N = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMCLRT_N')
    const DIMCLRD = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMCLRD')
    const DIMCLRE = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMCLRE')
    const DIMCLRT = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMCLRT')
    const DIMADEC = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMADEC')
    const DIMFRAC = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMFRAC')
    const DIMLUNIT = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMLUNIT')
    const DIMDSEP = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMDSEP')
    const DIMTMOVE = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMTMOVE')
    const DIMATFIT = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMATFIT')
    const DIMFXLON = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMFXLON')
    const DIMTXTDIRECTION = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMTXTDIRECTION')
    const DIMALTMZF = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMALTMZF')
    const DIMALTMZS = libredwg.dwg_dynapi_entity_data<string>(item, 'DIMALTMZS')
    const DIMMZF = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMMZF')
    const DIMMZS = libredwg.dwg_dynapi_entity_data<string>(item, 'DIMMZS')
    const DIMLWD = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMLWD')
    const DIMLWE = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMLWE')
    const DIMTXSTY_Ptr = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMTXSTY')
    const DIMTXSTY = libredwg.dwg_ref_get_absref(DIMTXSTY_Ptr) ?? undefined
    const DIMLDRBLK_Ptr = libredwg.dwg_dynapi_entity_data<number>(item, 'DIMLDRBLK')
    const DIMLDRBLK = libredwg.dwg_ref_get_absref(DIMLDRBLK_Ptr) ?? undefined

    return {
      ...commonAttrs,
      DIMPOST: DIMPOST,
      DIMAPOST: DIMAPOST,
      DIMBLK: DIMBLK_T,
      DIMBLK1: DIMBLK1_T,
      DIMBLK2: DIMBLK2_T,
      DIMSCALE: DIMSCALE,
      DIMASZ: DIMASZ,
      DIMEXO: DIMEXO,
      DIMDLI: DIMDLI,
      DIMEXE: DIMEXE,
      DIMRND: DIMRND,
      DIMDLE: DIMDLE,
      DIMTP: DIMTP,
      DIMTM: DIMTM,
      DIMTXT: DIMTXT,
      DIMCEN: DIMCEN,
      DIMTSZ: DIMTSZ,
      DIMALTF: DIMALTF,
      DIMLFAC: DIMLFAC,
      DIMTVP: DIMTVP,
      DIMTFAC: DIMTFAC,
      DIMGAP: DIMGAP,
      DIMALTRND: DIMALTRND,
      DIMTOL: DIMTOL,
      DIMLIM: DIMLIM,
      DIMTIH: DIMTIH,
      DIMTOH: DIMTOH,
      DIMSE1: DIMSE1 as 0 | 1,
      DIMSE2: DIMSE2 as 0 | 1,
      DIMTAD: DIMTAD,
      DIMZIN: DIMZIN,
      DIMAZIN: DIMAZIN,
      DIMALT: DIMALT as 0 | 1,
      DIMALTD: DIMALTD as 0 | 1,
      DIMTOFL: DIMTOFL as 0 | 1,
      DIMSAH: DIMSAH as 0 | 1,
      DIMTIX: DIMTIX as 0 | 1,
      DIMSOXD: DIMSOXD as 0 | 1,
      DIMCLRD: DIMCLRD,
      DIMCLRE: DIMCLRE,
      DIMCLRT: DIMCLRT,
      DIMADEC: DIMADEC,
      DIMUNIT: DIMUNIT,
      DIMDEC: DIMDEC,
      DIMTDEC: DIMTDEC,
      DIMALTU: DIMALTU,
      DIMALTTD: DIMALTTD,
      DIMAUNIT: DIMAUNIT,
      DIMFRAC: DIMFRAC,
      DIMLUNIT: DIMLUNIT,
      DIMDSEP: String.fromCharCode(DIMDSEP),
      DIMTMOVE: DIMTMOVE,
      DIMJUST: DIMJUST,
      DIMSD1: DIMSD1 as 0 | 1,
      DIMSD2: DIMSD2 as 0 | 1,
      DIMTOLJ: DIMTOLJ,
      DIMTZIN: DIMTZIN,
      DIMALTZ: DIMALTZ,
      DIMALTTZ: DIMALTTZ,
      DIMFIT: DIMFIT,
      DIMUPT: DIMUPT,
      DIMATFIT: DIMATFIT,
      DIMTXSTY: DIMTXSTY,
      DIMLDRBLK: DIMLDRBLK,
      DIMLWD: DIMLWD,
      DIMLWE: DIMLWE,

      DIMFXL: DIMFXL,
      DIMJOGANG: DIMJOGANG,
      DIMTFILL: DIMTFILL,
      DIMTFILLCLR: DIMTFILLCLR,
      DIMARCSYM: DIMARCSYM,
      DIMCLRD_N: DIMCLRD_N,
      DIMCLRE_N: DIMCLRE_N,
      DIMCLRT_N: DIMCLRT_N,
      DIMFXLON: DIMFXLON,
      DIMTXTDIRECTION: DIMTXTDIRECTION,
      DIMALTMZF: DIMALTMZF,
      DIMALTMZS: DIMALTMZS,
      DIMMZF: DIMMZF,
      DIMMZS: DIMMZS
    }
  }

  private convertLayer(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgLayerTableEntry {
    const libredwg = this.libredwg
    const commonAttrs = this.getCommonTableEntryAttrs(item, obj)
    const flag = libredwg.dwg_dynapi_entity_data<number>(item, 'flag')
    const frozen = libredwg.dwg_dynapi_entity_data<number>(item, 'frozen')
    const off = libredwg.dwg_dynapi_entity_data<number>(item, 'off')
    const frozenInNew = libredwg.dwg_dynapi_entity_data<number>(item, 'frozen_in_new')
    const locked = libredwg.dwg_dynapi_entity_data<number>(item, 'locked')
    let plotFlag = libredwg.dwg_dynapi_entity_data<number>(item, 'plotflag')
    // Pre-R2000 DWGs have no LAYER plot flag; LibreDWG reports 0 which would
    // incorrectly mark every layer non-plottable for consumers that honor it.
    if (!this.layerPlotFlagSupported) {
      plotFlag = 1
    }
    const linewt = libredwg.dwg_dynapi_entity_data<number>(item, 'linewt')
    const color = libredwg.dwg_dynapi_entity_data<Dwg_Color>(item, 'color')
    const ltypeRef = libredwg.dwg_dynapi_entity_data<number>(item, 'ltype')
    let ltypeName = 'Continuous'
    if (ltypeRef) {
      try {
        ltypeName = libredwg.dwg_ref_get_object_name(ltypeRef)
      } catch {
        // ref may be invalid in some DWG files
      }
    }

    // - 0xc0 for ByLayer (also c3 and rgb of 0x100)
    // - 0xc1 for ByBlock (also c3 and rgb of 0)
    // - 0xc2 for entities (default), with names with an additional name flag RC
    // - 0xc3 for truecolor
    // - 0xc5 for foreground color
    // - 0xc8 for none (also c3 and rgb of 0x101)
    const method = color.method
    let colorIndex = 256
    let rgbColor = 0xffffff
    // NOTE: Some older DWG formats use method=0x0 and provide the ACI index via color.index.
    if (method === 0xc3 || ((color.rgb >>> 24) & 0xff) === 0xc3) {
      colorIndex = color.rgb & 0x000000ff
    } else if (method == 0xc2 || ((color.rgb >>> 24) & 0xff) === 0xc2) {
      rgbColor = color.rgb & 0x00ffffff
    } else if (color.index >= 1 && color.index <= 255) {
      // Older DWG format: ACI index is directly available in color.index.
      colorIndex = color.index
    }

    return {
      ...commonAttrs,
      standardFlag: flag,
      colorIndex: colorIndex,
      color: rgbColor,
      colorName: color.name,
      transparency: color.alpha,
      lineType: ltypeName,
      frozen: frozen != 0,
      off: off != 0,
      frozenInNew: frozenInNew != 0,
      locked: locked != 0,
      plotFlag: plotFlag,
      lineweight: linewt,
      plotStyleNameObjectId: '',
      materialObjectId: ''
    }
  }

  private convertLineType(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgLTypeTableEntry {
    const libredwg = this.libredwg
    const commonAttrs = this.getCommonTableEntryAttrs(item, obj)
    const flag = libredwg.dwg_dynapi_entity_data<number>(item, 'flag')
    const description = libredwg.dwg_dynapi_entity_data<string>(item, 'description')
    const numDashes = libredwg.dwg_dynapi_entity_data<number>(item, 'numdashes')
    const patternLen = libredwg.dwg_dynapi_entity_data<number>(item, 'pattern_len')
    const dashes = libredwg.dwg_dynapi_entity_data<Dwg_Array_Ptr>(item, 'dashes')
    const dashArray = dashes
      ? libredwg.dwg_ptr_to_ltype_dash_array(dashes, numDashes)
      : []
    return {
      ...commonAttrs,
      description: description,
      standardFlag: flag,
      numberOfLineTypes: numDashes,
      totalPatternLength: patternLen,
      pattern: this.convertLineTypePattern(dashArray)
    }
  }

  private convertLineTypePattern(dashes: Dwg_LTYPE_Dash[]) {
    const patterns: DwgLineTypeElement[] = []
    dashes.forEach(dash => {
      patterns.push({
        elementLength: dash.length || 0,
        // DXF 74: 1=absolute rotation, 2=text, 4=shape
        elementTypeFlag: dash.shape_flag || 0,
        // DXF 75: shape number (when flag has bit 4)
        shapeNumber: dash.complex_shapecode,
        // TODO: convert style handle to style object id
        // styleObjectId: dash.style,
        scale: dash.scale,
        rotation: dash.rotation,
        offsetX: dash.x_offset,
        offsetY: dash.y_offset,
        text: dash.text
      })
    })
    return patterns
  }

  private convertStyle(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgStyleTableEntry {
    const libredwg = this.libredwg
    const commonAttrs = this.getCommonTableEntryAttrs(item, obj)
    const standardFlag = libredwg.dwg_dynapi_entity_data<number>(item, 'flag')
    const widthFactor = libredwg.dwg_dynapi_entity_data<number>(item, 'width_factor')
    const obliqueAngle = libredwg.dwg_dynapi_entity_data<number>(item, 'oblique_angle')
    const textGenerationFlag = libredwg.dwg_dynapi_entity_data<number>(item, 'generation')
    const lastHeight = libredwg.dwg_dynapi_entity_data<number>(item, 'last_height')
    const font = libredwg.dwg_dynapi_entity_data<string>(item, 'font_file')
    const bigFont = libredwg.dwg_dynapi_entity_data<string>(item, 'bigfont_file')

    return {
      ...commonAttrs,
      standardFlag: standardFlag,
      fixedTextHeight: 0, // TODO: Set the correct value
      widthFactor: widthFactor,
      obliqueAngle: obliqueAngle,
      textGenerationFlag: textGenerationFlag,
      lastHeight: lastHeight,
      font: font,
      bigFont: bigFont
    }
  }

  private convertViewport(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgVPortTableEntry {
    const libredwg = this.libredwg
    const commonAttrs = this.getCommonTableEntryAttrs(item, obj)
    const standardFlag = libredwg.dwg_dynapi_entity_data<number>(item, 'flag')
    const viewHeight = libredwg.dwg_dynapi_entity_data<number>(item, 'VIEWSIZE')
    const aspectRatio = libredwg.dwg_dynapi_entity_data<number>(item, 'aspect_ratio')
    const center = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(item, 'VIEWCTR')
    const viewTarget = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(item, 'view_target')
    const viewDirectionFromTarget = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(item, 'VIEWDIR')
    const viewTwistAngle = libredwg.dwg_dynapi_entity_data<number>(item, 'view_twist')
    const lensLength = libredwg.dwg_dynapi_entity_data<number>(item, 'lens_length')
    const frontClippingPlane = libredwg.dwg_dynapi_entity_data<number>(item, 'front_clip_z')
    const backClippingPlane = libredwg.dwg_dynapi_entity_data<number>(item, 'back_clip_z')
    const viewMode = libredwg.dwg_dynapi_entity_data<number>(item, 'VIEWMODE')
    const renderMode = libredwg.dwg_dynapi_entity_data<number>(item, 'render_mode')
    const isDefaultLightingOn =
      libredwg.dwg_dynapi_entity_data<number>(item, 'use_default_lights') != 0
    const defaultLightningType = libredwg.dwg_dynapi_entity_data<number>(item, 'default_lightning_type')
    const brightness = libredwg.dwg_dynapi_entity_data<number>(item, 'brightness')
    const contrast = libredwg.dwg_dynapi_entity_data<number>(item, 'contrast')
    const ambient_color = libredwg.dwg_dynapi_entity_data<Dwg_Color>(item, 'ambient_color')

    // ViewportTableRecord
    const lowerLeftCorner = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(item, 'lower_left')
    const upperRightCorner = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(item, 'upper_right')
    // TODO: Not sure whether 'circleSides' is equal to 'circle_zoom'
    const circleSides = libredwg.dwg_dynapi_entity_data<number>(item, 'circle_zoom')
    const ucsIconSetting = libredwg.dwg_dynapi_entity_data<number>(item, 'UCSICON')
    // TODO: Not sure whether 'gridSpacing' is equal to 'GRIDUNIT'
    const gridSpacing = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(item, 'GRIDUNIT')
    const snapRotationAngle = libredwg.dwg_dynapi_entity_data<number>(item, 'SNAPANG')
    const snapBasePoint = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(item, 'SNAPBASE')
    // TODO: Not sure whether 'snapSpacing' is equal to 'SNAPUNIT'
    const snapSpacing = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(item, 'SNAPUNIT')
    const ucsOrigin = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(item, 'ucsorg')
    const ucsXAxis = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(item, 'ucsxdir')
    const ucsYAxis = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(item, 'ucsydir')
    const elevation = libredwg.dwg_dynapi_entity_data<number>(item, 'ucs_elevation')
    const majorGridLines = libredwg.dwg_dynapi_entity_data<number>(item, 'grid_major')
    const background = libredwg.dwg_dynapi_entity_data<Dwg_Object_Ref_Ptr>(item, 'background')
    const backgroundObjectId = background
      ? (libredwg.dwg_ref_get_id(background) ?? '')
      : undefined
    const visualstyle = libredwg.dwg_dynapi_entity_data<Dwg_Object_Ref_Ptr>(item, 'visualstyle')
    const visualStyleObjectId = visualstyle
      ? (libredwg.dwg_ref_get_id(visualstyle) ?? '')
      : undefined

    // BITCODE_B UCSFOLLOW;
    // BITCODE_B FASTZOOM;
    // BITCODE_B GRIDMODE;     /* DXF 76: on or off */
    // BITCODE_B SNAPMODE;     /* DXF 75: on or off */
    // BITCODE_B SNAPSTYLE;
    // BITCODE_BS SNAPISOPAIR;
    // BITCODE_B ucs_at_origin;
    // BITCODE_B UCSVP;
    // BITCODE_BS UCSORTHOVIEW;
    // BITCODE_BS grid_flags; /* bit 1: bound to limits, bit 2: adaptive */
    // BITCODE_H sun;
    // BITCODE_H named_ucs;
    // BITCODE_H base_ucs;

    return {
      ...commonAttrs,
      standardFlag: standardFlag,
      lowerLeftCorner: lowerLeftCorner,
      upperRightCorner: upperRightCorner,
      center: center,
      snapBasePoint: snapBasePoint,
      snapSpacing: snapSpacing,
      gridSpacing: gridSpacing,
      viewDirectionFromTarget: viewDirectionFromTarget,
      viewTarget: viewTarget,
      lensLength: lensLength,
      frontClippingPlane: frontClippingPlane,
      backClippingPlane: backClippingPlane,
      viewHeight: viewHeight,
      aspectRatio: aspectRatio,
      snapRotationAngle: snapRotationAngle,
      viewTwistAngle: viewTwistAngle,
      circleSides: circleSides,
      frozenLayers: [], // TODO: Set the correct value
      styleSheet: '', // TODO: Set the correct value
      renderMode: renderMode,
      viewMode: viewMode,
      ucsIconSetting: ucsIconSetting,
      ucsOrigin: ucsOrigin,
      ucsXAxis: ucsXAxis,
      ucsYAxis: ucsYAxis,
      orthographicType: 0, // TODO: Set the correct value
      elevation: elevation,
      shadePlotSetting: 0, // TODO: Set the correct value
      majorGridLines: majorGridLines,
      backgroundObjectId: backgroundObjectId,
      // shadePlotObjectId: undefined,
      visualStyleObjectId: visualStyleObjectId,
      isDefaultLightingOn: isDefaultLightingOn,
      defaultLightingType: defaultLightningType,
      brightness: brightness,
      contrast: contrast,
      // TODO: Not sure whether 'index' or 'rgb' should be used
      ambientColor: ambient_color.index
    }
  }

  private getCommonTableEntryAttrs(
    tio: number,
    obj: Dwg_Object_Ptr
  ): DwgCommonTableEntry {
    const libredwg = this.libredwg
    const object_tio = libredwg.dwg_object_get_tio(obj)
    const ownerhandle =
      libredwg.dwg_object_object_get_ownerhandle_object(object_tio)
    const handle = libredwg.dwg_object_get_handle_object(obj)
    return {
      handle: idToString(handle.value),
      ownerHandle: idToString(ownerhandle.absolute_ref),
      name: libredwg.dwg_dynapi_entity_data<string>(tio, 'name')
    }
  }

  private convertDictionary(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgDictionaryObject {
    const libredwg = this.libredwg
    const commonAttrs = this.getCommonObjectAttrs(obj)

    const isHardOwner = libredwg.dwg_dynapi_entity_data<number>(item, 'is_hardowner')
    const cloningFlag = libredwg.dwg_dynapi_entity_data<number>(item, 'cloning')
    const numitems = libredwg.dwg_dynapi_entity_data<number>(item, 'numitems')
    const itemhandles_ptr = libredwg.dwg_dynapi_entity_data<number>(item, 'itemhandles')
    const itemhandles = libredwg.dwg_ptr_to_object_ref_array(
      itemhandles_ptr,
      numitems
    )
    const texts = libredwg.dwg_object_dictionary_get_texts(obj)

    const entries: Record<string, string> = {}
    itemhandles.forEach(
      (handle, index) =>
        (entries[texts[index]] = idToString(handle.absolute_ref))
    )

    return {
      ...commonAttrs,
      isHardOwner: !!isHardOwner,
      cloningFlag: cloningFlag,
      entries: entries
    }
  }

  private convertImageDef(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgImageDefObject {
    const libredwg = this.libredwg
    const commonAttrs = this.getCommonObjectAttrs(obj)
    // const classVersion = libredwg.dwg_dynapi_entity_data<number>(item, 'class_version')
    const size = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(item, 'image_size')
    const fileName = libredwg.dwg_dynapi_entity_data<string>(item, 'file_path')
    const isLoaded = libredwg.dwg_dynapi_entity_data<number>(item, 'is_loaded')
    const sizeOfOnePixel = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(item, 'pixel_size')
    const resolutionUnits = libredwg.dwg_dynapi_entity_data<number>(item, 'resunits')

    return {
      ...commonAttrs,
      fileName: fileName,
      size: size,
      sizeOfOnePixel: sizeOfOnePixel,
      isLoaded: isLoaded,
      resolutionUnits: resolutionUnits
    }
  }

  private convertLayerFilter(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgLayerFilterObject {
    const libredwg = this.libredwg
    const commonAttrs = this.getCommonObjectAttrs(obj)
    const numNames = libredwg.dwg_dynapi_entity_data<number>(item, 'num_names') ?? 0
    const namesPtr = libredwg.dwg_dynapi_entity_data<number>(item, 'names')
    const layerNames =
      namesPtr && numNames > 0
        ? libredwg
            .dwg_ptr_to_wchar_string_array(namesPtr, numNames)
            .filter((name): name is string => name != null && name !== '')
        : []

    return {
      ...commonAttrs,
      ...(layerNames.length ? { layerNames } : {})
    }
  }

  private convertLayerIndex(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgLayerIndexObject {
    const libredwg = this.libredwg
    const commonAttrs = this.getCommonObjectAttrs(obj)
    const timeStamp = libredwg.dwg_dynapi_entity_data<number>(item, 'last_updated')
    const numEntries =
      libredwg.dwg_dynapi_entity_data<number>(item, 'num_entries') ?? 0
    const entriesPtr = libredwg.dwg_dynapi_entity_data<number>(item, 'entries')
    const entrySize = libredwg.dwg_dynapi_subclass_size('LAYER_entry')

    const layerNames: string[] = []
    const idBufferIds: string[] = []
    const idBufferEntryCounts: number[] = []

    if (entriesPtr && entrySize > 0) {
      for (let i = 0; i < numEntries; i++) {
        const entryPtr = entriesPtr + i * entrySize
        const name = libredwg.dwg_dynapi_subclass_data<string>(
          entryPtr,
          'LAYER_entry',
          'name'
        )
        // Keep parallel arrays aligned with entries even when name is absent.
        layerNames.push(name ?? '')
        const handleRef = libredwg.dwg_dynapi_subclass_data<number>(
          entryPtr,
          'LAYER_entry',
          'handle'
        )
        idBufferIds.push(handleRef ? (libredwg.dwg_ref_get_id(handleRef) ?? '') : '')
        idBufferEntryCounts.push(
          libredwg.dwg_dynapi_subclass_data<number>(
            entryPtr,
            'LAYER_entry',
            'numlayers'
          ) ?? 0
        )
      }
    }

    return {
      ...commonAttrs,
      ...(timeStamp != null ? { timeStamp } : {}),
      ...(layerNames.length ? { layerNames } : {}),
      ...(idBufferIds.length ? { idBufferIds } : {}),
      ...(idBufferEntryCounts.length ? { idBufferEntryCounts } : {})
    }
  }

  private convertLayout(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgLayoutObject {
    const libredwg = this.libredwg
    const commonAttrs = this.getCommonObjectAttrs(obj)

    // AcDbLayout
    const layoutName = libredwg.dwg_dynapi_entity_data<string>(item, 'layout_name')
    const tabOrder = libredwg.dwg_dynapi_entity_data<number>(item, 'tab_order')
    const controlFlag = libredwg.dwg_dynapi_entity_data<number>(item, 'layout_flags')
    const insertionPoint = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(item, 'INSBASE')
    const minLimit = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(item, 'LIMMIN')
    const maxLimit = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(item, 'LIMMAX')
    const ucsOrigin = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(item, 'UCSORG')
    const ucsXAxis = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(item, 'UCSXDIR')
    const ucsYAxis = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(item, 'UCSYDIR')
    const orthographicType = libredwg.dwg_dynapi_entity_data<number>(item, 'UCSORTHOVIEW')
    const minExtent = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(item, 'EXTMIN')
    const maxExtent = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(item, 'EXTMAX')
    const elevation = libredwg.dwg_dynapi_entity_data<number>(item, 'ucs_elevation')

    const block_header_ref = libredwg.dwg_dynapi_entity_data<number>(item, 'block_header')
    const paperSpaceTableId = (libredwg.dwg_ref_get_id(block_header_ref) ?? '')

    const active_viewport_ref = libredwg.dwg_dynapi_entity_data<number>(item, 'active_viewport')
    const viewportId = (libredwg.dwg_ref_get_id(active_viewport_ref) ?? '')

    const named_ucs_ref = libredwg.dwg_dynapi_entity_data<number>(item, 'named_ucs')
    const namedUcsId = named_ucs_ref
      ? (libredwg.dwg_ref_get_id(named_ucs_ref) ?? '')
      : undefined

    // BITCODE_H base_ucs;
    // BITCODE_BL num_viewports; // r2004+
    // BITCODE_H *viewports;     // r2004+

    return {
      ...commonAttrs,
      layoutName: layoutName,
      controlFlag: controlFlag,
      tabOrder: tabOrder,
      minLimit: minLimit,
      maxLimit: maxLimit,
      insertionPoint: insertionPoint,
      minExtent: minExtent,
      maxExtent: maxExtent,
      elevation: elevation,
      ucsOrigin: ucsOrigin,
      ucsXAxis: ucsXAxis,
      ucsYAxis: ucsYAxis,
      orthographicType: orthographicType,
      paperSpaceTableId: paperSpaceTableId,
      viewportId: viewportId,
      namedUcsId: namedUcsId,
      // orthographicUcsId?: string;
      shadePlotId: '' // TODO: Set the correct value
    }
  }

  private convertMLeaderStyle(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgMLeaderStyleObject {
    const libredwg = this.libredwg
    const commonAttrs = this.getCommonObjectAttrs(obj)
    const objectVal = <T>(field: string) => libredwg.dwg_dynapi_entity_data<T>(item, field)
    const refToId = (ref: number) => libredwg.dwg_ref_get_id(ref)
    const asBool = (value: number) => value > 0
    const mleaderColor = (color: Dwg_Color | undefined) =>
      color != null ? dwgColorToMLeaderRawColor(color) : undefined

    return {
      ...commonAttrs,
      subclassMarker: 'AcDbMLeaderStyle',
      unknown1: objectVal<number>('class_version'),
      contentType: objectVal<number>('content_type'),
      drawMLeaderOrderType: objectVal<number>('mleader_order'),
      drawLeaderOrderType: objectVal<number>('leader_order'),
      maxLeaderSegmentPoints: objectVal<number>('max_points'),
      firstSegmentAngleConstraint: objectVal<number>('first_seg_angle'),
      secondSegmentAngleConstraint: objectVal<number>('second_seg_angle'),
      leaderLineType: objectVal<number>('type'),
      leaderLineColor: mleaderColor(objectVal<Dwg_Color>('line_color')),
      leaderLineTypeId: refToId(objectVal<number>('line_type')),
      leaderLineWeight: objectVal<number>('linewt'),
      landingEnabled: asBool(objectVal<number>('has_landing')),
      landingGap: objectVal<number>('landing_gap'),
      doglegEnabled: asBool(objectVal<number>('has_dogleg')),
      doglegLength: objectVal<number>('landing_dist'),
      description: objectVal<string>('description'),
      arrowheadId: refToId(objectVal<number>('arrow_head')),
      arrowheadSize: objectVal<number>('arrow_head_size'),
      defaultMTextContents: objectVal<string>('text_default'),
      textStyleId: refToId(objectVal<number>('text_style')),
      textLeftAttachmentType: objectVal<number>('attach_left'),
      textAngleType: objectVal<number>('text_angle_type'),
      textAlignmentType: objectVal<number>('text_align_type'),
      textRightAttachmentType: objectVal<number>('attach_right'),
      textColor: mleaderColor(objectVal<Dwg_Color>('text_color')),
      textHeight: objectVal<number>('text_height'),
      textFrameEnabled: asBool(objectVal<number>('has_text_frame')),
      textAlignAlwaysLeft: asBool(objectVal<number>('text_always_left')),
      alignSpace: objectVal<number>('align_space'),
      blockContentId: refToId(objectVal<number>('block')),
      blockContentColor: mleaderColor(objectVal<Dwg_Color>('block_color')),
      blockContentScale: objectVal<DwgPoint3D>('block_scale'),
      blockContentScaleEnabled: asBool(objectVal<number>('use_block_scale')),
      blockContentRotation: objectVal<number>('block_rotation'),
      blockContentRotationEnabled: asBool(objectVal<number>('use_block_rotation')),
      blockContentConnectionType: objectVal<number>('block_connection'),
      scale: objectVal<number>('scale'),
      overwritePropertyValue: asBool(objectVal<number>('is_changed')),
      annotative: asBool(objectVal<number>('is_annotative')),
      breakGapSize: objectVal<number>('break_size'),
      textAttachmentDirection: objectVal<number>('attach_dir'),
      bottomTextAttachmentDirection: objectVal<number>('attach_bottom'),
      topTextAttachmentDirection: objectVal<number>('attach_top'),
      unknown2: asBool(objectVal<number>('text_extended'))
    }
  }

  private convertSpatialFilter(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgSpatialFilterObject {
    const libredwg = this.libredwg
    const commonAttrs = this.getCommonObjectAttrs(obj)

    const origin = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(item, 'origin')
    const numberOfPointsOnClipBoundary = libredwg.dwg_dynapi_entity_data<number>(item, 'num_clip_verts')
    const clip_verts_ptr = libredwg.dwg_dynapi_entity_data<number>(item, 'clip_verts')
    const vertices = libredwg.dwg_ptr_to_point2d_array(
      clip_verts_ptr,
      numberOfPointsOnClipBoundary
    )
    const extrusionDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(item, 'extrusion')
    const clipBoundaryVisible = libredwg.dwg_dynapi_entity_data<number>(item, 'display_boundary_on')
    const frontClippingPlaneFlag = libredwg.dwg_dynapi_entity_data<number>(item, 'front_clip_on')
    const frontClippingPlaneDistance = libredwg.dwg_dynapi_entity_data<number>(item, 'front_clip_z')
    const backClippingPlaneFlag = libredwg.dwg_dynapi_entity_data<number>(item, 'back_clip_on')
    const backClippingPlaneDistance = libredwg.dwg_dynapi_entity_data<number>(item, 'back_clip_z')
    const transform_ptr = libredwg.dwg_dynapi_entity_data<number>(item, 'transform')
    const matrix = libredwg.dwg_ptr_to_double_array(transform_ptr, 12)
    const inverse_transform_ptr = libredwg.dwg_dynapi_entity_data<number>(item, 'inverse_transform')
    const invertBlockMatrix = libredwg.dwg_ptr_to_double_array(
      inverse_transform_ptr,
      12
    )

    return {
      ...commonAttrs,
      origin: origin,
      numberOfPointsOnClipBoundary: numberOfPointsOnClipBoundary,
      vertices: vertices,
      extrusionDirection: extrusionDirection,
      clipBoundaryVisible: !!clipBoundaryVisible,
      frontClippingPlaneFlag: !!frontClippingPlaneFlag,
      frontClippingPlaneDistance: frontClippingPlaneDistance,
      backClippingPlaneFlag: !!backClippingPlaneFlag,
      backClippingPlaneDistance: backClippingPlaneDistance,
      matrix: matrix,
      invertBlockMatrix: invertBlockMatrix
    }
  }

  private convertGroup(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgGroupObject {
    const libredwg = this.libredwg
    const commonAttrs = this.getCommonObjectAttrs(obj)
    // LibreDWG `name` is the DXF-300 description, not the ACAD_GROUP key.
    const description =
      libredwg.dwg_dynapi_entity_data<string>(item, 'name') ?? ''
    const unnamed = !!libredwg.dwg_dynapi_entity_data<number>(item, 'unnamed')
    const selectableRaw =
      libredwg.dwg_dynapi_entity_data<number>(item, 'selectable')
    // ObjectARX defaults selectable groups to true when the flag is absent.
    const selectable = selectableRaw != null ? !!selectableRaw : true
    const numGroups =
      libredwg.dwg_dynapi_entity_data<number>(item, 'num_groups') ?? 0
    const groupsPtr =
      libredwg.dwg_dynapi_entity_data<number>(item, 'groups') ?? 0
    const refs =
      numGroups > 0 && groupsPtr
        ? libredwg.dwg_ptr_to_object_ref_array(groupsPtr, numGroups)
        : []
    // Keep 1:1 with LibreDWG `num_groups` / DXF 340 order (do not filter).
    const objectHandles = refs.map(ref => idToString(ref.absolute_ref))

    return {
      ...commonAttrs,
      description,
      unnamed,
      selectable,
      objectHandles
    }
  }

  private convertXRecord(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgXRecordObject {
    const libredwg = this.libredwg
    const commonAttrs = this.getCommonObjectAttrs(obj)
    const cloning = libredwg.dwg_dynapi_entity_data<number>(item, 'cloning')
    const data = libredwg.dwg_object_xrecord_get_xdata(item) ?? []

    const objectObj = libredwg.dwg_object_get_tio(obj)
    const xdic = objectObj
      ? libredwg.dwg_object_object_get_xdicobjhandle_object(objectObj)
      : null
    const extensionDictionary =
      xdic && xdic.absolute_ref
        ? idToString(xdic.absolute_ref)
        : undefined

    return {
      ...commonAttrs,
      ...(cloning != null ? { cloning } : {}),
      ...(extensionDictionary ? { extensionDictionary } : {}),
      data
    }
  }

  // ---------------------------------------------------------------------------
  // Associative framework (associative arrays)
  // ---------------------------------------------------------------------------

  private refId(ref: number | null | undefined): string {
    if (!ref) return '0'
    return this.libredwg.dwg_ref_get_id(ref) ?? '0'
  }

  /** Reads `count` handle refs of a `BITCODE_H*` array. */
  private refIds(ptr: number | null | undefined, count: number): string[] {
    if (!ptr || count <= 0) return []
    return this.libredwg
      .dwg_ptr_to_object_ref_array(ptr, count)
      .map(ref => idToString(ref.absolute_ref))
  }

  /** Reads a `Dwg_ASSOCACTION_Deps*` array (dependencies or network actions). */
  private assocHandleRefs(
    ptr: number | null | undefined,
    count: number
  ): DwgAssocHandleRef[] {
    const libredwg = this.libredwg
    const size = libredwg.dwg_dynapi_subclass_size('ASSOCACTION_Deps')
    const refs: DwgAssocHandleRef[] = []
    if (!ptr || size <= 0) return refs
    for (let i = 0; i < count; i++) {
      const p = ptr + i * size
      refs.push({
        handle: this.refId(
          libredwg.dwg_dynapi_subclass_data<number>(
            p,
            'ASSOCACTION_Deps',
            'dep'
          )
        ),
        isOwned: !!libredwg.dwg_dynapi_subclass_data<number>(
          p,
          'ASSOCACTION_Deps',
          'is_owned'
        )
      })
    }
    return refs
  }

  /** Decodes an `AcDbEvalVariant` at `ptr`. */
  private assocVariant(ptr: number): {
    code: number
    value: number | string | null
  } {
    const libredwg = this.libredwg
    const code =
      libredwg.dwg_dynapi_subclass_data<number>(ptr, 'EvalVariant', 'code') ?? 0
    const read = (field: string) =>
      libredwg.dwg_dynapi_subclass_data<number | string>(
        ptr,
        'EvalVariant',
        field
      )
    const inRange = (lo: number, hi: number) => code >= lo && code <= hi
    let value: number | string | null = null
    if (
      inRange(38, 59) ||
      inRange(140, 149) ||
      inRange(460, 469) ||
      inRange(1040, 1042)
    ) {
      value = read('u.bd') as number
    } else if (
      inRange(90, 99) ||
      inRange(420, 429) ||
      inRange(440, 459) ||
      code === 1071
    ) {
      value = (read('u.bl') as number) | 0
    } else if (
      inRange(60, 79) ||
      inRange(170, 179) ||
      inRange(270, 279) ||
      inRange(370, 389) ||
      inRange(400, 409) ||
      code === 1070
    ) {
      value = ((read('u.bs') as number) << 16) >> 16
    } else if (inRange(280, 289)) {
      value = read('u.rc') as number
    } else if (
      inRange(1, 4) ||
      inRange(6, 9) ||
      inRange(100, 102) ||
      inRange(300, 309) ||
      inRange(410, 419) ||
      inRange(430, 439) ||
      inRange(470, 479) ||
      code === 999 ||
      inRange(1000, 1009)
    ) {
      // String values (BITCODE_T in the union) are UTF-16 since R2007 and
      // the dynapi subclass reader cannot tell; leave them undecoded rather
      // than return garbage.
      value = null
    }
    return { code, value }
  }

  private assocValueParams(
    ptr: number | null | undefined,
    count: number
  ): DwgAssocValueParam[] {
    const libredwg = this.libredwg
    const size = libredwg.dwg_dynapi_subclass_size('VALUEPARAM')
    const varSize = libredwg.dwg_dynapi_subclass_size('VALUEPARAM_vars')
    const params: DwgAssocValueParam[] = []
    if (!ptr || size <= 0) return params
    for (let i = 0; i < count; i++) {
      const p = ptr + i * size
      const field = <T>(name: string) =>
        libredwg.dwg_dynapi_subclass_data<T>(p, 'VALUEPARAM', name)
      const numVars = field<number>('num_vars') ?? 0
      const varsPtr = field<number>('vars')
      const values = []
      for (let j = 0; varsPtr && varSize > 0 && j < numVars; j++) {
        const v = varsPtr + j * varSize
        // `value` (Dwg_EvalVariant) is the first member of VALUEPARAM_vars.
        values.push({
          ...this.assocVariant(v),
          variableHandle: this.refId(
            libredwg.dwg_dynapi_subclass_data<number>(
              v,
              'VALUEPARAM_vars',
              'handle'
            )
          )
        })
      }
      params.push({
        classVersion: field<number>('class_version') ?? 0,
        name: field<string>('name') ?? '',
        unitType: field<number>('unit_type') ?? 0,
        values,
        controlledObjectDependencyHandle: this.refId(
          field<number>('controlled_objdep')
        )
      })
    }
    return params
  }

  private convertAssocAction(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgAssocActionObject {
    const libredwg = this.libredwg
    const data = <T>(name: string) =>
      libredwg.dwg_dynapi_entity_data<T>(item, name)
    return {
      ...this.getCommonObjectAttrs(obj),
      classVersion: data<number>('class_version') ?? 0,
      status: data<number>('geometry_status') ?? 0,
      owningNetworkHandle: this.refId(data<number>('owningnetwork')),
      actionBodyHandle: this.refId(data<number>('actionbody')),
      actionIndex: data<number>('action_index') ?? 0,
      maxDependencyIndex: data<number>('max_assoc_dep_index') ?? 0,
      dependencies: this.assocHandleRefs(
        data<number>('deps'),
        data<number>('num_deps') ?? 0
      ),
      ownedParamHandles: this.refIds(
        data<number>('owned_params'),
        data<number>('num_owned_params') ?? 0
      ),
      valueParams: this.assocValueParams(
        data<number>('values'),
        data<number>('num_values') ?? 0
      )
    }
  }

  private convertAssocNetwork(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgAssocNetworkObject {
    const libredwg = this.libredwg
    const data = <T>(name: string) =>
      libredwg.dwg_dynapi_entity_data<T>(item, name)
    return {
      ...this.convertAssocAction(item, obj),
      networkVersion: data<number>('network_version') ?? 0,
      maxActionIndex: data<number>('network_action_index') ?? 0,
      actions: this.assocHandleRefs(
        data<number>('actions'),
        data<number>('num_actions') ?? 0
      ),
      ownedActionHandles: this.refIds(
        data<number>('owned_actions'),
        data<number>('num_owned_actions') ?? 0
      )
    }
  }

  private convertAssocDependency(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgAssocDependencyObject {
    const libredwg = this.libredwg
    const data = <T>(name: string) =>
      libredwg.dwg_dynapi_entity_data<T>(item, name)
    return {
      ...this.getCommonObjectAttrs(obj),
      classVersion: data<number>('class_version') ?? 0,
      status: data<number>('status') ?? 0,
      isReadDependency: !!data<number>('is_read_dep'),
      isWriteDependency: !!data<number>('is_write_dep'),
      isAttachedToObject: !!data<number>('is_attached_to_object'),
      isDelegatingToOwningAction: !!data<number>(
        'is_delegating_to_owning_action'
      ),
      order: (data<number>('order') ?? 0) | 0,
      name: data<number>('has_name') ? (data<string>('name') ?? '') : '',
      dependentOnHandle: this.refId(data<number>('dep_on')),
      prevDependencyHandle: this.refId(data<number>('readdep')),
      nextDependencyHandle: this.refId(data<number>('node')),
      dependencyBodyHandle: this.refId(data<number>('dep_body')),
      dependencyIndex: (data<number>('depbodyid') ?? 0) | 0
    }
  }

  private convertAssocArrayActionBody(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgAssocArrayActionBodyObject {
    const libredwg = this.libredwg
    const data = <T>(name: string) =>
      libredwg.dwg_dynapi_entity_data<T>(item, name)
    const matrix = (ptr: number | null | undefined) =>
      ptr ? libredwg.dwg_ptr_to_double_array(ptr, 16) : []

    const items: DwgAssocArrayItem[] = []
    const count = data<number>('num_arrayitems') ?? 0
    const itemsPtr = data<number>('arrayitems')
    const size = libredwg.dwg_dynapi_subclass_size('ASSOCARRAYITEM')
    for (let i = 0; itemsPtr && size > 0 && i < count; i++) {
      const p = itemsPtr + i * size
      const field = <T>(name: string, base = p) =>
        libredwg.dwg_dynapi_subclass_data<T>(base, 'ASSOCARRAYITEM', name)
      const flags = field<number>('flags') ?? 0
      let m: number[]
      if (flags & 4) {
        m = matrix(field<number>('transmatrix'))
      } else {
        const t = field<DwgPoint3D>('x_dir') ?? { x: 0, y: 0, z: 0 }
        m = [1, 0, 0, t.x, 0, 1, 0, t.y, 0, 0, 1, t.z, 0, 0, 0, 1]
      }
      // itemloc is BITCODE_BL[3]; dynapi returns the first element, so read
      // the next two by shifting the base pointer one / two BLs.
      // flags & 2: relative transform of an individually edited item.
      const relativeMatrix =
        flags & 2 ? matrix(field<number>('rel_transform')) : undefined
      items.push({
        ...(relativeMatrix ? { relativeMatrix } : {}),
        ...(flags & 0x10
          ? { secondaryEntityHandle: this.refId(field<number>('h2')) }
          : {}),
        classVersion: field<number>('class_version') ?? 0,
        itemIndex: field<number>('itemloc') ?? 0,
        rowIndex: field<number>('itemloc', p + 4) ?? 0,
        levelIndex: field<number>('itemloc', p + 8) ?? 0,
        flags,
        matrix: m,
        entityHandle: this.refId(field<number>('h1'))
      })
    }

    return {
      ...this.getCommonObjectAttrs(obj),
      actionBodyVersion: data<number>('aab_version') ?? 0,
      classVersion: data<number>('aaab_version') ?? 0,
      parametersClassName: data<string>('paramblock') ?? '',
      parametersVersion: data<number>('aap_version') ?? 0,
      items,
      arrayTransform: matrix(data<number>('transmatrix'))
    }
  }

  private convertAssocActionParamBase(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgAssocActionParamObject {
    const libredwg = this.libredwg
    const data = <T>(name: string) =>
      libredwg.dwg_dynapi_entity_data<T>(item, name)
    return {
      ...this.getCommonObjectAttrs(obj),
      classVersion: data<number>('is_r2013') ?? 0,
      paramVersion: data<number>('aap_version') ?? 0,
      name: data<string>('name') ?? '',
      singleDependencyVersion: data<number>('asdap_class_version') ?? 0,
      dependencyHandle: this.refId(data<number>('dep'))
    }
  }

  private convertAssocVertexActionParam(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgAssocVertexActionParamObject {
    const libredwg = this.libredwg
    return {
      ...this.convertAssocActionParamBase(item, obj),
      vertexVersion:
        libredwg.dwg_dynapi_entity_data<number>(item, 'class_version') ?? 0,
      point: libredwg.dwg_dynapi_entity_data<DwgPoint3D>(item, 'pt') ?? {
        x: 0,
        y: 0,
        z: 0
      }
    }
  }

  private convertAssocEdgeActionParam(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgAssocEdgeActionParamObject {
    const libredwg = this.libredwg
    const data = <T>(name: string) =>
      libredwg.dwg_dynapi_entity_data<T>(item, name)
    return {
      ...this.convertAssocActionParamBase(item, obj),
      edgeVersion: data<number>('class_version') ?? 0,
      hasCachedCurve: !!data<number>('has_action'),
      curveType: data<number>('action_type') ?? 0
    }
  }

  private getCommonObjectAttrs(obj: Dwg_Object_Ptr): DwgCommonObject {
    const libredwg = this.libredwg
    const object_tio = libredwg.dwg_object_get_tio(obj)
    const ownerhandle =
      libredwg.dwg_object_object_get_ownerhandle_object(object_tio)
    const handle = libredwg.dwg_object_get_handle_object(obj)
    return {
      handle: idToString(handle.value),
      ownerHandle: idToString(ownerhandle.absolute_ref)
    }
  }
}
