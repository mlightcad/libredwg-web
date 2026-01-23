import {
  DwgBlockRecordTableEntry,
  DwgClass,
  DwgCommonObject,
  DwgCommonTableEntry,
  DwgDatabase,
  DwgDimStyleTableEntry,
  DwgEntity,
  DwgHeader,
  DwgImageDefObject,
  DwgLayerTableEntry,
  DwgLayoutObject,
  DwgLineTypeElement,
  DwgLTypeTableEntry,
  DwgPoint2D,
  DwgPoint3D,
  DwgSpatialFilterObject,
  DwgStyleTableEntry,
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
  Dwg_Object_Ptr,
  Dwg_Object_Ref_Ptr,
  Dwg_Object_Type
} from '../types'
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
        IMAGEDEF: [],
        LAYOUT: [],
        SPATIAL_FILTER: []
      },
      header: {},
      entities: [],
      classes: []
    }
    const libredwg = this.libredwg
    this.convertHeader(data, db.header)
    this.convertClasses(data, db.classes)
    const num_objects = libredwg.dwg_get_num_objects(data)

    for (let i = 0; i < num_objects; i++) {
      const obj = libredwg.dwg_get_object(data, i)
      if (obj) {
        const tio = libredwg.dwg_object_to_object_tio(obj)
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
        const tio = libredwg.dwg_object_to_object_tio(obj)
        if (tio) {
          const fixedtype = libredwg.dwg_object_get_fixedtype(obj)
          switch (fixedtype) {
            case Dwg_Object_Type.DWG_TYPE_BLOCK_HEADER:
              {
                const btr = this.convertBlockRecord(tio, obj)
                db.tables.BLOCK_RECORD.entries.push(btr)
                // db.entities should contains entities in model space and paper space only
                if (isModelSpace(btr.name) || isPaperSpace(btr.name)) {
                  btr.entities.forEach(entity => db.entities.push(entity))
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
            case Dwg_Object_Type.DWG_TYPE_IMAGEDEF:
              db.objects.IMAGEDEF.push(this.convertImageDef(tio, obj))
              break
            case Dwg_Object_Type.DWG_TYPE_LAYOUT:
              db.objects.LAYOUT.push(this.convertLayout(tio, obj))
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
    return db
  }

  getConversionStats() {
    return {
      unknownEntityCount: this.entityConverter.unknownEntityCount
    }
  }

  private convertHeader(data: Dwg_Data_Ptr, header: DwgHeader) {
    const libredwg = this.libredwg
    HEADER_VARIABLES.forEach(name => {
      let var_name = name
      if (name == 'DIMBLK' || name == 'DIMBLK1' || name == 'DIMBLK2') {
        var_name = var_name + '_T'
      }
      let value = libredwg.dwg_dynapi_header_value(data, var_name).data as
        | number
        | string

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
        value = !!value ? libredwg.dwg_ref_get_object_name(value as number) : ''
      } else if (name == 'DRAGVS') {
        value = !!value ? libredwg.dwg_ref_get_absref(value as number) : 2
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
    const num_owned = libredwg.dwg_dynapi_entity_value(item, 'num_owned')
      .data as number

    const flags = libredwg.dwg_dynapi_entity_value(item, 'flag').data as number
    const description = libredwg.dwg_dynapi_entity_value(item, 'description')
      .data as string
    const basePoint = libredwg.dwg_dynapi_entity_value(item, 'base_pt')
      .data as DwgPoint3D
    const insertionUnits = libredwg.dwg_dynapi_entity_value(
      item,
      'insert_units'
    ).data as number
    const explodability = libredwg.dwg_dynapi_entity_value(item, 'explodable')
      .data as number
    const scalability = libredwg.dwg_dynapi_entity_value(item, 'block_scaling')
      .data as number
    const layout_ptr = libredwg.dwg_dynapi_entity_value(item, 'layout')
      .data as number
    const layout = idToString(libredwg.dwg_ref_get_absref(layout_ptr))

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
      const entities_ptr = libredwg.dwg_dynapi_entity_value(item, 'entities')
        .data as number
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
    const DIMTOL = libredwg.dwg_dynapi_entity_value(item, 'DIMTOL')
      .data as number
    const DIMLIM = libredwg.dwg_dynapi_entity_value(item, 'DIMLIM')
      .data as number
    const DIMTIH = libredwg.dwg_dynapi_entity_value(item, 'DIMTIH')
      .data as number
    const DIMTOH = libredwg.dwg_dynapi_entity_value(item, 'DIMTOH')
      .data as number
    const DIMSE1 = libredwg.dwg_dynapi_entity_value(item, 'DIMSE1')
      .data as number
    const DIMSE2 = libredwg.dwg_dynapi_entity_value(item, 'DIMSE2')
      .data as number
    const DIMALT = libredwg.dwg_dynapi_entity_value(item, 'DIMALT')
      .data as number
    const DIMTOFL = libredwg.dwg_dynapi_entity_value(item, 'DIMTOFL')
      .data as number
    const DIMSAH = libredwg.dwg_dynapi_entity_value(item, 'DIMSAH')
      .data as number
    const DIMTIX = libredwg.dwg_dynapi_entity_value(item, 'DIMTIX')
      .data as number
    const DIMSOXD = libredwg.dwg_dynapi_entity_value(item, 'DIMSOXD')
      .data as number
    const DIMALTD = libredwg.dwg_dynapi_entity_value(item, 'DIMALTD')
      .data as number
    const DIMZIN = libredwg.dwg_dynapi_entity_value(item, 'DIMZIN')
      .data as number
    const DIMSD1 = libredwg.dwg_dynapi_entity_value(item, 'DIMSD1')
      .data as number
    const DIMSD2 = libredwg.dwg_dynapi_entity_value(item, 'DIMSD2')
      .data as number
    const DIMTOLJ = libredwg.dwg_dynapi_entity_value(item, 'DIMTOLJ')
      .data as number
    const DIMJUST = libredwg.dwg_dynapi_entity_value(item, 'DIMJUST')
      .data as number
    const DIMFIT = libredwg.dwg_dynapi_entity_value(item, 'DIMFIT')
      .data as number
    const DIMUPT = libredwg.dwg_dynapi_entity_value(item, 'DIMUPT')
      .data as number
    const DIMTZIN = libredwg.dwg_dynapi_entity_value(item, 'DIMTZIN')
      .data as number
    const DIMALTZ = libredwg.dwg_dynapi_entity_value(item, 'DIMALTZ')
      .data as number
    const DIMALTTZ = libredwg.dwg_dynapi_entity_value(item, 'DIMALTTZ')
      .data as number
    const DIMTAD = libredwg.dwg_dynapi_entity_value(item, 'DIMTAD')
      .data as number
    const DIMUNIT = libredwg.dwg_dynapi_entity_value(item, 'DIMUNIT')
      .data as number
    const DIMAUNIT = libredwg.dwg_dynapi_entity_value(item, 'DIMAUNIT')
      .data as number
    const DIMDEC = libredwg.dwg_dynapi_entity_value(item, 'DIMDEC')
      .data as number
    const DIMTDEC = libredwg.dwg_dynapi_entity_value(item, 'DIMTDEC')
      .data as number
    const DIMALTU = libredwg.dwg_dynapi_entity_value(item, 'DIMALTU')
      .data as number
    const DIMALTTD = libredwg.dwg_dynapi_entity_value(item, 'DIMALTTD')
      .data as number
    const DIMSCALE = libredwg.dwg_dynapi_entity_value(item, 'DIMSCALE')
      .data as number
    const DIMASZ = libredwg.dwg_dynapi_entity_value(item, 'DIMASZ')
      .data as number
    const DIMEXO = libredwg.dwg_dynapi_entity_value(item, 'DIMEXO')
      .data as number
    const DIMDLI = libredwg.dwg_dynapi_entity_value(item, 'DIMDLI')
      .data as number
    const DIMEXE = libredwg.dwg_dynapi_entity_value(item, 'DIMEXE')
      .data as number
    const DIMRND = libredwg.dwg_dynapi_entity_value(item, 'DIMRND')
      .data as number
    const DIMDLE = libredwg.dwg_dynapi_entity_value(item, 'DIMDLE')
      .data as number
    const DIMTP = libredwg.dwg_dynapi_entity_value(item, 'DIMTP').data as number
    const DIMTM = libredwg.dwg_dynapi_entity_value(item, 'DIMTM').data as number
    const DIMFXL = libredwg.dwg_dynapi_entity_value(item, 'DIMFXL')
      .data as number
    const DIMJOGANG = libredwg.dwg_dynapi_entity_value(item, 'DIMJOGANG')
      .data as number
    const DIMTFILL = libredwg.dwg_dynapi_entity_value(item, 'DIMTFILL')
      .data as number
    const DIMTFILLCLR = libredwg.dwg_dynapi_entity_value(item, 'DIMTFILLCLR')
      .data as number
    const DIMAZIN = libredwg.dwg_dynapi_entity_value(item, 'DIMAZIN')
      .data as number
    const DIMARCSYM = libredwg.dwg_dynapi_entity_value(item, 'DIMARCSYM')
      .data as number
    const DIMTXT = libredwg.dwg_dynapi_entity_value(item, 'DIMTXT')
      .data as number
    const DIMCEN = libredwg.dwg_dynapi_entity_value(item, 'DIMCEN')
      .data as number
    const DIMTSZ = libredwg.dwg_dynapi_entity_value(item, 'DIMTSZ')
      .data as number
    const DIMALTF = libredwg.dwg_dynapi_entity_value(item, 'DIMALTF')
      .data as number
    const DIMLFAC = libredwg.dwg_dynapi_entity_value(item, 'DIMLFAC')
      .data as number
    const DIMTVP = libredwg.dwg_dynapi_entity_value(item, 'DIMTVP')
      .data as number
    const DIMTFAC = libredwg.dwg_dynapi_entity_value(item, 'DIMTFAC')
      .data as number
    const DIMGAP = libredwg.dwg_dynapi_entity_value(item, 'DIMGAP')
      .data as number
    const DIMPOST = libredwg.dwg_dynapi_entity_value(item, 'DIMPOST')
      .data as string
    const DIMAPOST = libredwg.dwg_dynapi_entity_value(item, 'DIMAPOST')
      .data as string
    const DIMBLK_T = libredwg.dwg_dynapi_entity_value(item, 'DIMBLK_T')
      .data as string
    const DIMBLK1_T = libredwg.dwg_dynapi_entity_value(item, 'DIMBLK1_T')
      .data as string
    const DIMBLK2_T = libredwg.dwg_dynapi_entity_value(item, 'DIMBLK2_T')
      .data as string
    const DIMALTRND = libredwg.dwg_dynapi_entity_value(item, 'DIMALTRND')
      .data as number
    const DIMCLRD_N = libredwg.dwg_dynapi_entity_value(item, 'DIMCLRD_N')
      .data as number
    const DIMCLRE_N = libredwg.dwg_dynapi_entity_value(item, 'DIMCLRE_N')
      .data as number
    const DIMCLRT_N = libredwg.dwg_dynapi_entity_value(item, 'DIMCLRT_N')
      .data as number
    const DIMCLRD = libredwg.dwg_dynapi_entity_value(item, 'DIMCLRD')
      .data as number
    const DIMCLRE = libredwg.dwg_dynapi_entity_value(item, 'DIMCLRE')
      .data as number
    const DIMCLRT = libredwg.dwg_dynapi_entity_value(item, 'DIMCLRT')
      .data as number
    const DIMADEC = libredwg.dwg_dynapi_entity_value(item, 'DIMADEC')
      .data as number
    const DIMFRAC = libredwg.dwg_dynapi_entity_value(item, 'DIMFRAC')
      .data as number
    const DIMLUNIT = libredwg.dwg_dynapi_entity_value(item, 'DIMLUNIT')
      .data as number
    const DIMDSEP = libredwg.dwg_dynapi_entity_value(item, 'DIMDSEP')
      .data as number
    const DIMTMOVE = libredwg.dwg_dynapi_entity_value(item, 'DIMTMOVE')
      .data as number
    const DIMATFIT = libredwg.dwg_dynapi_entity_value(item, 'DIMATFIT')
      .data as number
    const DIMFXLON = libredwg.dwg_dynapi_entity_value(item, 'DIMFXLON')
      .data as number
    const DIMTXTDIRECTION = libredwg.dwg_dynapi_entity_value(
      item,
      'DIMTXTDIRECTION'
    ).data as number
    const DIMALTMZF = libredwg.dwg_dynapi_entity_value(item, 'DIMALTMZF')
      .data as number
    const DIMALTMZS = libredwg.dwg_dynapi_entity_value(item, 'DIMALTMZS')
      .data as string
    const DIMMZF = libredwg.dwg_dynapi_entity_value(item, 'DIMMZF')
      .data as number
    const DIMMZS = libredwg.dwg_dynapi_entity_value(item, 'DIMMZS')
      .data as string
    const DIMLWD = libredwg.dwg_dynapi_entity_value(item, 'DIMLWD')
      .data as number
    const DIMLWE = libredwg.dwg_dynapi_entity_value(item, 'DIMLWE')
      .data as number
    const DIMTXSTY_Ptr = libredwg.dwg_dynapi_entity_value(item, 'DIMTXSTY')
      .data as number
    const DIMTXSTY = libredwg.dwg_ref_get_absref(DIMTXSTY_Ptr)
    const DIMLDRBLK_Ptr = libredwg.dwg_dynapi_entity_value(item, 'DIMLDRBLK')
      .data as number
    const DIMLDRBLK = libredwg.dwg_ref_get_absref(DIMLDRBLK_Ptr)

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
    const flag = libredwg.dwg_dynapi_entity_value(item, 'flag').data as number
    const frozen = libredwg.dwg_dynapi_entity_value(item, 'frozen')
      .data as number
    const off = libredwg.dwg_dynapi_entity_value(item, 'off').data as number
    const frozenInNew = libredwg.dwg_dynapi_entity_value(item, 'frozen_in_new')
      .data as number
    const locked = libredwg.dwg_dynapi_entity_value(item, 'plotflockedlag')
      .data as number
    const plotFlag = libredwg.dwg_dynapi_entity_value(item, 'plotflag')
      .data as number
    const linewt = libredwg.dwg_dynapi_entity_value(item, 'linewt')
      .data as number
    const color = libredwg.dwg_dynapi_entity_value(item, 'color')
      .data as Dwg_Color

    // - 0xc0 for ByLayer (also c3 and rgb of 0x100)
    // - 0xc1 for ByBlock (also c3 and rgb of 0)
    // - 0xc2 for entities (default), with names with an additional name flag RC
    // - 0xc3 for truecolor
    // - 0xc5 for foreground color
    // - 0xc8 for none (also c3 and rgb of 0x101)
    const method = color.method
    let colorIndex = 256
    let rgbColor = 0xffffff
    // It looks like that libredwg always returns 256 for property 'index' in Dwg_Color
    if (method === 0xc3 || ((color.rgb >>> 24) & 0xff) === 0xc3) {
      colorIndex = color.rgb & 0x000000ff
    } else if (method == 0xc2 || ((color.rgb >>> 24) & 0xff) === 0xc2) {
      rgbColor = color.rgb & 0x00ffffff
    }

    return {
      ...commonAttrs,
      standardFlag: flag,
      colorIndex: colorIndex,
      color: rgbColor,
      colorName: color.name,
      transparency: color.alpha,
      lineType: '',
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
    const flag = libredwg.dwg_dynapi_entity_value(item, 'flag').data as number
    const description = libredwg.dwg_dynapi_entity_value(item, 'description')
      .data as string
    const numDashes = libredwg.dwg_dynapi_entity_value(item, 'numdashes')
      .data as number
    const patternLen = libredwg.dwg_dynapi_entity_value(item, 'pattern_len')
      .data as number
    const dashes = libredwg.dwg_dynapi_entity_value(item, 'dashes')
      .data as Dwg_Array_Ptr
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
    const standardFlag = libredwg.dwg_dynapi_entity_value(item, 'flag')
      .data as number
    const widthFactor = libredwg.dwg_dynapi_entity_value(item, 'width_factor')
      .data as number
    const obliqueAngle = libredwg.dwg_dynapi_entity_value(item, 'oblique_angle')
      .data as number
    const textGenerationFlag = libredwg.dwg_dynapi_entity_value(
      item,
      'generation'
    ).data as number
    const lastHeight = libredwg.dwg_dynapi_entity_value(item, 'last_height')
      .data as number
    const font = libredwg.dwg_dynapi_entity_value(item, 'font_file')
      .data as string
    const bigFont = libredwg.dwg_dynapi_entity_value(item, 'bigfont_file')
      .data as string

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
    const standardFlag = libredwg.dwg_dynapi_entity_value(item, 'flag')
      .data as number
    const viewHeight = libredwg.dwg_dynapi_entity_value(item, 'VIEWSIZE')
      .data as number
    // BITCODE_BD view_width;   // in DWG r13+, needed to calc. aspect_ratio
    // BITCODE_BD aspect_ratio; // DXF 41 = view_width / VIEWSIZE
    const center = libredwg.dwg_dynapi_entity_value(item, 'VIEWCTR')
      .data as DwgPoint2D
    const viewTarget = libredwg.dwg_dynapi_entity_value(item, 'view_target')
      .data as DwgPoint3D
    const viewDirectionFromTarget = libredwg.dwg_dynapi_entity_value(
      item,
      'VIEWDIR'
    ).data as DwgPoint3D
    const viewTwistAngle = libredwg.dwg_dynapi_entity_value(item, 'view_twist')
      .data as number
    const lensLength = libredwg.dwg_dynapi_entity_value(item, 'lens_length')
      .data as number
    const frontClippingPlane = libredwg.dwg_dynapi_entity_value(
      item,
      'front_clip_z'
    ).data as number
    const backClippingPlane = libredwg.dwg_dynapi_entity_value(
      item,
      'back_clip_z'
    ).data as number
    const viewMode = libredwg.dwg_dynapi_entity_value(item, 'VIEWMODE')
      .data as number
    const renderMode = libredwg.dwg_dynapi_entity_value(item, 'render_mode')
      .data as number
    const isDefaultLightingOn =
      (libredwg.dwg_dynapi_entity_value(item, 'use_default_lights')
        .data as number) != 0
    const defaultLightningType = libredwg.dwg_dynapi_entity_value(
      item,
      'default_lightning_type'
    ).data as number
    const brightness = libredwg.dwg_dynapi_entity_value(item, 'brightness')
      .data as number
    const contrast = libredwg.dwg_dynapi_entity_value(item, 'contrast')
      .data as number
    const ambient_color = libredwg.dwg_dynapi_entity_value(
      item,
      'ambient_color'
    ).data as Dwg_Color

    // ViewportTableRecord
    const lowerLeftCorner = libredwg.dwg_dynapi_entity_value(item, 'lower_left')
      .data as DwgPoint2D
    const upperRightCorner = libredwg.dwg_dynapi_entity_value(
      item,
      'upper_right'
    ).data as DwgPoint2D
    // TODO: Not sure whether 'circleSides' is equal to 'circle_zoom'
    const circleSides = libredwg.dwg_dynapi_entity_value(item, 'circle_zoom')
      .data as number
    const ucsIconSetting = libredwg.dwg_dynapi_entity_value(item, 'UCSICON')
      .data as number
    // TODO: Not sure whether 'gridSpacing' is equal to 'GRIDUNIT'
    const gridSpacing = libredwg.dwg_dynapi_entity_value(item, 'GRIDUNIT')
      .data as DwgPoint2D
    const snapRotationAngle = libredwg.dwg_dynapi_entity_value(item, 'SNAPANG')
      .data as number
    const snapBasePoint = libredwg.dwg_dynapi_entity_value(item, 'SNAPBASE')
      .data as DwgPoint2D
    // TODO: Not sure whether 'snapSpacing' is equal to 'SNAPUNIT'
    const snapSpacing = libredwg.dwg_dynapi_entity_value(item, 'SNAPUNIT')
      .data as DwgPoint2D
    const ucsOrigin = libredwg.dwg_dynapi_entity_value(item, 'ucsorg')
      .data as DwgPoint3D
    const ucsXAxis = libredwg.dwg_dynapi_entity_value(item, 'ucsxdir')
      .data as DwgPoint3D
    const ucsYAxis = libredwg.dwg_dynapi_entity_value(item, 'ucsydir')
      .data as DwgPoint3D
    const elevation = libredwg.dwg_dynapi_entity_value(item, 'ucs_elevation')
      .data as number
    const majorGridLines = libredwg.dwg_dynapi_entity_value(item, 'grid_major')
      .data as number
    const background = libredwg.dwg_dynapi_entity_value(item, 'background')
      .data as Dwg_Object_Ref_Ptr
    const backgroundObjectId = background
      ? idToString(libredwg.dwg_ref_get_absref(background))
      : undefined
    const visualstyle = libredwg.dwg_dynapi_entity_value(item, 'visualstyle')
      .data as Dwg_Object_Ref_Ptr
    const visualStyleObjectId = visualstyle
      ? idToString(libredwg.dwg_ref_get_absref(visualstyle))
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
      name: libredwg.dwg_dynapi_entity_value(tio, 'name').data as string
    }
  }

  private convertImageDef(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgImageDefObject {
    const libredwg = this.libredwg
    const commonAttrs = this.getCommonObjectAttrs(obj)
    // const classVersion = libredwg.dwg_dynapi_entity_value(item, 'class_version').data as number
    const size = libredwg.dwg_dynapi_entity_value(item, 'image_size')
      .data as DwgPoint2D
    const fileName = libredwg.dwg_dynapi_entity_value(item, 'file_path')
      .data as string
    const isLoaded = libredwg.dwg_dynapi_entity_value(item, 'is_loaded')
      .data as number
    const sizeOfOnePixel = libredwg.dwg_dynapi_entity_value(item, 'pixel_size')
      .data as DwgPoint2D
    const resolutionUnits = libredwg.dwg_dynapi_entity_value(item, 'resunits')
      .data as number

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
    const layoutName = libredwg.dwg_dynapi_entity_value(item, 'layout_name')
      .data as string
    const tabOrder = libredwg.dwg_dynapi_entity_value(item, 'tab_order')
      .data as number
    const controlFlag = libredwg.dwg_dynapi_entity_value(item, 'layout_flags')
      .data as number
    const insertionPoint = libredwg.dwg_dynapi_entity_value(item, 'INSBASE')
      .data as DwgPoint3D
    const minLimit = libredwg.dwg_dynapi_entity_value(item, 'LIMMIN')
      .data as DwgPoint2D
    const maxLimit = libredwg.dwg_dynapi_entity_value(item, 'LIMMAX')
      .data as DwgPoint2D
    const ucsOrigin = libredwg.dwg_dynapi_entity_value(item, 'UCSORG')
      .data as DwgPoint3D
    const ucsXAxis = libredwg.dwg_dynapi_entity_value(item, 'UCSXDIR')
      .data as DwgPoint3D
    const ucsYAxis = libredwg.dwg_dynapi_entity_value(item, 'UCSYDIR')
      .data as DwgPoint3D
    const orthographicType = libredwg.dwg_dynapi_entity_value(
      item,
      'UCSORTHOVIEW'
    ).data as number
    const minExtent = libredwg.dwg_dynapi_entity_value(item, 'EXTMIN')
      .data as DwgPoint3D
    const maxExtent = libredwg.dwg_dynapi_entity_value(item, 'EXTMAX')
      .data as DwgPoint3D
    const elevation = libredwg.dwg_dynapi_entity_value(item, 'ucs_elevation')
      .data as number

    const block_header_ref = libredwg.dwg_dynapi_entity_value(
      item,
      'block_header'
    ).data as number
    const paperSpaceTableId = idToString(
      libredwg.dwg_ref_get_absref(block_header_ref)
    )

    const active_viewport_ref = libredwg.dwg_dynapi_entity_value(
      item,
      'active_viewport'
    ).data as number
    const viewportId = idToString(
      libredwg.dwg_ref_get_absref(active_viewport_ref)
    )

    const named_ucs_ref = libredwg.dwg_dynapi_entity_value(item, 'named_ucs')
      .data as number
    const namedUcsId = !!named_ucs_ref
      ? idToString(libredwg.dwg_ref_get_absref(named_ucs_ref))
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

  private convertSpatialFilter(
    item: Dwg_Object_Object_Ptr,
    obj: Dwg_Object_Ptr
  ): DwgSpatialFilterObject {
    const libredwg = this.libredwg
    const commonAttrs = this.getCommonObjectAttrs(obj)

    const origin = libredwg.dwg_dynapi_entity_value(item, 'origin')
      .data as DwgPoint3D
    const numberOfPointsOnClipBoundary = libredwg.dwg_dynapi_entity_value(
      item,
      'num_clip_verts'
    ).data as number
    const clip_verts_ptr = libredwg.dwg_dynapi_entity_value(item, 'clip_verts')
      .data as number
    const vertices = libredwg.dwg_ptr_to_point2d_array(
      clip_verts_ptr,
      numberOfPointsOnClipBoundary
    )
    const extrusionDirection = libredwg.dwg_dynapi_entity_value(
      item,
      'extrusion'
    ).data as DwgPoint3D
    const clipBoundaryVisible = libredwg.dwg_dynapi_entity_value(
      item,
      'display_boundary_on'
    ).data as number
    const frontClippingPlaneFlag = libredwg.dwg_dynapi_entity_value(
      item,
      'front_clip_on'
    ).data as number
    const frontClippingPlaneDistance = libredwg.dwg_dynapi_entity_value(
      item,
      'front_clip_z'
    ).data as number
    const backClippingPlaneFlag = libredwg.dwg_dynapi_entity_value(
      item,
      'back_clip_on'
    ).data as number
    const backClippingPlaneDistance = libredwg.dwg_dynapi_entity_value(
      item,
      'back_clip_z'
    ).data as number
    const transform_ptr = libredwg.dwg_dynapi_entity_value(item, 'transform')
      .data as number
    const matrix = libredwg.dwg_ptr_to_double_array(transform_ptr, 12)
    const inverse_transform_ptr = libredwg.dwg_dynapi_entity_value(
      item,
      'inverse_transform'
    ).data as number
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
