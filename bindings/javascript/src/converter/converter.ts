import {
  DwgAppIdEntry,
  DwgBlockRecordTableEntry,
  DwgClass,
  DwgCommonObject,
  DwgCommonTableEntry,
  DwgDatabase,
  DwgDictionaryObject,
  DwgDimStyleTableEntry,
  DwgEntity,
  DwgHeader,
  DwgImageDefObject,
  DwgInsertEntity,
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
  HEADER_VARIABLES
} from '../database'
import { LibreDwgEx } from '../libredwg'
import {
  Dwg_Array_Ptr,
  Dwg_Color,
  Dwg_Data_Ptr,
  Dwg_LTYPE_Dash,
  Dwg_Object_Object_Ptr,
  Dwg_Object_Object_TIO_Ptr,
  Dwg_Object_Ptr,
  Dwg_Object_Ref_Ptr,
  Dwg_Object_Supertype,
  Dwg_Object_Type
} from '../types'
import { dwgColorToMLeaderRawColor } from './dwgColorToMLeaderRawColor'
import { LibreEntityConverter } from './entityConverter'
import { idToString, isModelSpace, isPaperSpace } from './utils'

/**
 * Class used to convert Dwg_Data instance to DwgDatabase instance.
 */
export class LibreDwgConverter {
  private libredwg: LibreDwgEx
  private entityConverter: LibreEntityConverter

  constructor(instance: LibreDwgEx) {
    this.libredwg = instance
    this.entityConverter = new LibreEntityConverter(instance)
  }

  convert(data: Dwg_Data_Ptr) {
    this.entityConverter.clear()
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
        DICTIONARY: [],
        IMAGEDEF: [],
        LAYOUT: [],
        MLEADERSTYLE: [],
        SPATIAL_FILTER: []
      },
      header: {},
      entities: [],
      classes: []
    }
    const libredwg = this.libredwg
    this.convertHeader(data, db.header)
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
            case Dwg_Object_Type.DWG_TYPE_IMAGEDEF:
              db.objects.IMAGEDEF.push(this.convertImageDef(tio, obj))
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

    let bmpPreview = ''
    const uint8ArrayToHexString = (bytes: Uint8Array): string => {
      const hexChars: string[] = new Array(bytes.length)
      for (let i = 0; i < bytes.length; i++) {
        hexChars[i] = bytes[i].toString(16).toUpperCase()
      }
      return hexChars.join('')
    }
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
    const locked = libredwg.dwg_dynapi_entity_data<number>(item, 'plotflockedlag')
    const plotFlag = libredwg.dwg_dynapi_entity_data<number>(item, 'plotflag')
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
        elementTypeFlag: dash.complex_shapecode,
        shapeNumber: dash.shape_flag,
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
