import {
  Dwg3dFaceEntity,
  DwgAlignedDimensionEntity,
  DwgAngularDimensionEntity,
  DwgArcEdge,
  DwgArcEntity,
  DwgAttachmentPoint,
  DwgAttdefEntity,
  DwgAttribEntity,
  DwgBoundaryPath,
  DwgBoundaryPathEdge,
  DwgBoundaryPathEdgeType,
  DwgCircleEntity,
  DwgClassLookup,
  DwgDatabase,
  DwgDimensionEntityCommon,
  DwgDimensionTextLineSpacing,
  DwgDimensionType,
  DwgEdgeBoundaryPath,
  DwgEllipseEdge,
  DwgEllipseEntity,
  DwgEmbeddedMText,
  DwgEntity,
  DwgHatchAssociativity,
  DwgHatchEntity,
  DwgHatchGradientColorFlag,
  DwgHatchGradientFlag,
  DwgHatchPatternType,
  DwgHatchSolidFill,
  DwgHatchStyle,
  DwgImageClippingBoundaryType,
  DwgImageEntity,
  DwgImageFlags,
  DwgInsertEntity,
  DwgLeaderEntity,
  DwgLineEdge,
  DwgLineEntity,
  DwgLWPolylineEntity,
  DwgLWPolylineVertex,
  DwgMLineEntity,
  DwgMLineVertex,
  DwgMTextDrawingDirection,
  DwgMTextEntity,
  DwgMultiLeaderBlockAttribute,
  DwgMultiLeaderBlockContent,
  DwgMultiLeaderBreak,
  DwgMultiLeaderEntity,
  DwgMultiLeaderIndexedHandle,
  DwgMultiLeaderLeaderLine,
  DwgMultiLeaderLeaderSection,
  DwgOle2FrameEntity,
  DwgOleFrameEntity,
  DwgOrdinateDimensionEntity,
  DwgPoint2D,
  DwgPoint3D,
  DwgPointEntity,
  DwgPolyline2dEntity,
  DwgPolyline3dEntity,
  DwgPolylineBoundaryPath,
  DwgProxyEntity,
  DwgProxyOriginalDataFormat,
  DwgRadialDiameterDimensionEntity,
  DwgRayEntity,
  DwgSectionEntity,
  DwgShapeEntity,
  DwgSolidEntity,
  DwgSplineEdge,
  DwgSplineEntity,
  DwgTableCell,
  DwgTableEntity,
  DwgTextBase,
  DwgTextEntity,
  DwgTextHorizontalAlign,
  DwgTextVerticalAlign,
  DwgToleranceEntity,
  DwgVertex2dEntity,
  DwgVertex3dEntity,
  DwgViewportEntity,
  DwgWipeoutEntity,
  DwgXlineEntity
} from '../database'
import { LibreDwgEx } from '../libredwg'
import {
  Dwg_Color,
  Dwg_Entity_PROXY_ENTITY_Ptr,
  Dwg_Hatch_Edge_Type,
  Dwg_HATCH_Path,
  Dwg_Object_Entity_Ptr,
  Dwg_Object_Ptr,
  Dwg_Object_Type,
  Dwg_TABLE_Cell
} from '../types'
import { dwgColorToMLeaderRawColor } from './dwgColorToMLeaderRawColor'
import { idToString, uint8ArrayToHexString } from './utils'

type DwgCommonAttributes = Omit<DwgEntity, 'type'>
type DwgDimensionCommonAttributes = Omit<
  DwgDimensionEntityCommon,
  | 'handle'
  | 'ownerBlockRecordSoftId'
  | 'layer'
  | 'subclassMarker'
  | 'transparencyType'
>

export class LibreEntityConverter {
  libredwg: LibreDwgEx
  layers: Map<string, string> = new Map()
  ltypes: Map<string, string> = new Map()
  classes: DwgClassLookup[] = []
  unknownEntityCount: number

  constructor(instance: LibreDwgEx) {
    this.libredwg = instance
    this.unknownEntityCount = 0
  }

  prepare(db: DwgDatabase, force: boolean = false) {
    if (force || this.layers.size == 0) {
      this.layers.clear()
      db.tables.LAYER.entries.forEach(layer => {
        this.layers.set(layer.handle, layer.name)
      })
    }

    if (force || this.ltypes.size == 0) {
      this.ltypes.clear()
      db.tables.LTYPE.entries.forEach(ltype => {
        this.ltypes.set(ltype.handle, ltype.name)
      })
    }
    this.classes = db.classes
    this.unknownEntityCount = 0
  }

  setClasses(classes: DwgClassLookup[]) {
    this.classes = classes
  }

  clear() {
    this.layers.clear()
    this.ltypes.clear()
    this.classes = []
    this.unknownEntityCount = 0
  }

  convert(object_ptr: Dwg_Object_Ptr): DwgEntity | undefined {
    const libredwg = this.libredwg

    // Get values of the common attributes of one entity
    const entity = libredwg.dwg_object_to_entity(object_ptr)
    const entity_tio = libredwg.dwg_object_to_entity_tio(object_ptr)
    if (entity && entity_tio) {
      // Get values of the common attributes of one entity
      const commonAttrs = this.getCommonAttrs(entity)
      const fixedtype = libredwg.dwg_object_get_fixedtype(object_ptr)
      if (fixedtype == Dwg_Object_Type.DWG_TYPE_3DFACE) {
        return this.convert3dFace(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_ARC) {
        return this.convertArc(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_ATTDEF) {
        return this.convertAttdef(entity_tio, commonAttrs)
        // libredwg stores ATTRIB as children of one INSERT entity.
        // It does not exist in iterator of dwg data.
        // } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_ATTRIB) {
        //   return this.convertAttrib(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_CIRCLE) {
        return this.convertCircle(entity_tio, commonAttrs)
      } else if (
        fixedtype == Dwg_Object_Type.DWG_TYPE_DIMENSION_ALIGNED ||
        fixedtype == Dwg_Object_Type.DWG_TYPE_DIMENSION_LINEAR
      ) {
        return this.convertAlignedDimension(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_DIMENSION_ANG3PT) {
        return this.convert3PointAngularDimension(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_DIMENSION_DIAMETER) {
        return this.convertDiameterDimension(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_DIMENSION_ORDINATE) {
        return this.convertOrdinateDimension(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_DIMENSION_RADIUS) {
        return this.convertRadiusDimension(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_ELLIPSE) {
        return this.convertEllise(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_HATCH) {
        return this.convertHatch(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_IMAGE) {
        return this.convertImage(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_INSERT) {
        return this.convertInsert(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_LEADER) {
        return this.convertLeader(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_LINE) {
        return this.convertLine(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_LWPOLYLINE) {
        return this.convertLWPolyline(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_MLINE) {
        return this.convertMLine(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_MULTILEADER) {
        return this.convertMultiLeader(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_MTEXT) {
        return this.convertMText(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_OLE2FRAME) {
        return this.convertOle2Frame(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_OLEFRAME) {
        return this.convertOleFrame(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_POINT) {
        return this.convertPoint(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_POLYLINE_2D) {
        return this.convertPolyline2d(entity_tio, commonAttrs, object_ptr)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_POLYLINE_3D) {
        return this.convertPolyline3d(entity_tio, commonAttrs, object_ptr)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_PROXY_ENTITY) {
        return this.convertProxyEntity(entity_tio, commonAttrs, object_ptr)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_RAY) {
        return this.convertRay(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_SECTIONOBJECT) {
        return this.convertSection(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_SHAPE) {
        return this.convertShape(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_SOLID) {
        return this.convertSolid(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_SPLINE) {
        return this.convertSpline(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_TABLE) {
        return this.convertTable(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_TEXT) {
        return this.convertText(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_TOLERANCE) {
        return this.convertTolerance(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_VIEWPORT) {
        return this.convertViewport(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_WIPEOUT) {
        return this.convertWipeout(entity_tio, commonAttrs)
      } else if (fixedtype == Dwg_Object_Type.DWG_TYPE_XLINE) {
        return this.convertXline(entity_tio, commonAttrs)
      } else if (fixedtype === Dwg_Object_Type.DWG_TYPE_UNKNOWN_ENT) {
        this.unknownEntityCount++
      }
    }
    return undefined
  }

  private convert3dFace(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): Dwg3dFaceEntity {
    const libredwg = this.libredwg
    const corner1 = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'corner1')
    const corner2 = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'corner2')
    const corner3 = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'corner3')
    const corner4 = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'corner4')
    const flag = libredwg.dwg_dynapi_entity_data<number>(entity, 'invis_flags')

    return {
      type: '3DFACE',
      ...commonAttrs,
      corner1: corner1,
      corner2: corner2,
      corner3: corner3,
      corner4: corner4,
      flag: flag
    }
  }

  private convertArc(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgArcEntity {
    const libredwg = this.libredwg
    const center = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'center')
    const radius = libredwg.dwg_dynapi_entity_data<number>(entity, 'radius')
    const thickness = libredwg.dwg_dynapi_entity_data<number>(entity, 'thickness')
    const extrusionDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'extrusion')
    const startAngle = libredwg.dwg_dynapi_entity_data<number>(entity, 'start_angle')
    const endAngle = libredwg.dwg_dynapi_entity_data<number>(entity, 'end_angle')

    return {
      type: 'ARC',
      ...commonAttrs,
      thickness: thickness,
      center: center,
      radius: radius,
      startAngle: startAngle,
      endAngle: endAngle,
      extrusionDirection: extrusionDirection
    }
  }

  private convertEmbeddedMText(
    entity: Dwg_Object_Entity_Ptr,
    subclassName: string
  ): DwgEmbeddedMText {
    const libredwg = this.libredwg
    const attachmentPoint = libredwg.dwg_dynapi_subclass_data<number>(entity, subclassName, 'attachment')
    const insertionPoint = libredwg.dwg_dynapi_subclass_data<DwgPoint3D>(entity, subclassName, 'ins_pt')
    const direction = libredwg.dwg_dynapi_subclass_data<DwgPoint3D>(entity, subclassName, 'x_axis_dir')
    const rectHeight = libredwg.dwg_dynapi_subclass_data<number>(entity, subclassName, 'rect_height')
    const rectWidth = libredwg.dwg_dynapi_subclass_data<number>(entity, subclassName, 'rect_width')
    const extentsHeight = libredwg.dwg_dynapi_subclass_data<number>(entity, subclassName, 'extents_height')
    const extentsWidth = libredwg.dwg_dynapi_subclass_data<number>(entity, subclassName, 'extents_width')
    // const columnType = libredwg.dwg_dynapi_subclass_value(entity, subclassName, 'column_type')
    //   .data as number
    // const columnWidth = libredwg.dwg_dynapi_subclass_value(entity, subclassName, 'column_width')
    //   .data as number
    // const columnGutter = libredwg.dwg_dynapi_subclass_value(entity, subclassName, 'gutter')
    //   .data as number
    // const columnAutoHeight = libredwg.dwg_dynapi_subclass_value(
    //     entity,
    //     subclassName,
    //     'auto_height'
    //   ).data as number
    // const columnFlowReversed = libredwg.dwg_dynapi_subclass_value(
    //     entity,
    //     subclassName,
    //     'flow_reversed'
    //   ).data as number
    // const columnHeightCount = libredwg.dwg_dynapi_subclass_value(
    //   entity,
    //   subclassName,
    //   'num_column_heights'
    // ).data as number
    // const columnHeights_ptr = libredwg.dwg_dynapi_subclass_value(
    //   entity,
    //   subclassName,
    //   'column_heights'
    // ).data as number
    // const columnHeights = libredwg.dwg_ptr_to_double_array(
    //   columnHeights_ptr,
    //   columnHeightCount
    // )

    return {
      insertionPoint: insertionPoint,
      rectHeight: rectHeight,
      rectWidth: rectWidth,
      extentsHeight: extentsHeight,
      extentsWidth: extentsWidth,
      attachmentPoint: attachmentPoint as DwgAttachmentPoint,
      direction: direction
      // columnType: columnType,
      // columnFlowReversed: columnFlowReversed,
      // columnAutoHeight: columnAutoHeight,
      // columnWidth: columnWidth,
      // columnGutter: columnGutter,
      // columnHeightCount: columnHeightCount,
      // columnHeights: columnHeights
    }
  }

  private convertAttdef(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgAttdefEntity {
    const libredwg = this.libredwg

    // Because the field name of text string in Dwg_Entity_ATTDEF is 'default_value'
    // instead of 'text_value'. So we need to get its value again using the correct
    // field name.
    const textValue = libredwg.dwg_dynapi_entity_data<string>(entity, 'default_value')
    const text = this.convertTextBase(entity)
    text.text = textValue

    const prompt = libredwg.dwg_dynapi_entity_data<string>(entity, 'prompt')
    const tag = libredwg.dwg_dynapi_entity_data<string>(entity, 'tag')
    const flags = libredwg.dwg_dynapi_entity_data<number>(entity, 'flags')
    const fieldLength = libredwg.dwg_dynapi_entity_data<number>(entity, 'field_length')
    const lockPositionFlag = libredwg.dwg_dynapi_entity_data<number>(entity, 'lock_position_flag')
    const duplicateRecordCloningFlag = libredwg.dwg_dynapi_entity_data<number>(entity, 'keep_duplicate_records')
    const isReallyLocked = libredwg.dwg_dynapi_entity_data<number>(entity, 'is_really_locked')
    // TODO: double check whether 'mtext_type' is 'mtextFlag'
    const mtextFlag = libredwg.dwg_dynapi_entity_data<number>(entity, 'mtext_type')
    const alignmentPoint = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(entity, 'alignment_pt')

    return {
      type: 'ATTDEF',
      ...commonAttrs,
      text: this.convertTextBase(entity),
      prompt: prompt,
      tag: tag,
      flags: flags,
      fieldLength: fieldLength,
      lockPositionFlag: lockPositionFlag > 0,
      duplicateRecordCloningFlag: duplicateRecordCloningFlag > 0,
      mtextFlag: mtextFlag,
      isReallyLocked: isReallyLocked > 0,
      alignmentPoint: alignmentPoint,
      annotationScale: 1, // TODO: Set the correct value
      attrTag: '', // TODO: Set the correct value
      mtext: this.convertEmbeddedMText(entity, 'ATTDEF_mtext')
    }
  }

  private convertAttrib(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgAttribEntity {
    const libredwg = this.libredwg

    const text = this.convertTextBase(entity)
    const tag = libredwg.dwg_dynapi_entity_data<string>(entity, 'tag')
    const flags = libredwg.dwg_dynapi_entity_data<number>(entity, 'flags')
    const fieldLength = libredwg.dwg_dynapi_entity_data<number>(entity, 'field_length')
    const lockPositionFlag = libredwg.dwg_dynapi_entity_data<number>(entity, 'lock_position_flag')
    const duplicateRecordCloningFlag = libredwg.dwg_dynapi_entity_data<number>(entity, 'keep_duplicate_records')
    // TODO: double check whether 'mtext_type' is 'mtextFlag'
    const mtextFlag = libredwg.dwg_dynapi_entity_data<number>(entity, 'mtext_type')
    const isReallyLocked = libredwg.dwg_dynapi_entity_data<number>(entity, 'is_really_locked')
    const alignmentPoint = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(entity, 'alignment_pt')

    return {
      type: 'ATTRIB',
      ...commonAttrs,
      text: text,
      tag: tag,
      flags: flags,
      fieldLength: fieldLength,
      lockPositionFlag: !!lockPositionFlag,
      duplicateRecordCloningFlag: !!duplicateRecordCloningFlag,
      mtextFlag: mtextFlag,
      isReallyLocked: !!isReallyLocked,
      numberOfSecondaryAttrs: 0, // TODO: libredwg doesn't support it yet.
      secondaryAttrsHardId: '0', // TODO: libredwg doesn't support it yet.
      alignmentPoint: { ...alignmentPoint, z: 0 },
      annotationScale: 1, // TODO: Set the correct value
      attrTag: '', // TODO: Set the correct value
      mtext: this.convertEmbeddedMText(entity, 'ATTDEF_mtext')
    }
  }

  private convertCircle(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgCircleEntity {
    const libredwg = this.libredwg
    const center = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'center')
    const radius = libredwg.dwg_dynapi_entity_data<number>(entity, 'radius')
    const thickness = libredwg.dwg_dynapi_entity_data<number>(entity, 'thickness')
    const extrusionDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'extrusion')

    return {
      type: 'CIRCLE',
      ...commonAttrs,
      thickness: thickness,
      center: center,
      radius: radius,
      extrusionDirection: extrusionDirection
    }
  }

  private convertAlignedDimension(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgAlignedDimensionEntity {
    const libredwg = this.libredwg
    const dimensionCommonAttrs = this.getDimensionCommonAttrs(entity)
    // TODO: Not sure whether 'clone_ins_pt' is same as 'insertionPoint'
    const insertionPoint = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(entity, 'clone_ins_pt')
    const subDefinitionPoint1 = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'xline1_pt')
    const subDefinitionPoint2 = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'xline2_pt')
    const rotationAngle = libredwg.dwg_dynapi_entity_data<number | undefined>(entity, 'ins_rotation')
    const obliqueAngle = libredwg.dwg_dynapi_entity_data<number>(entity, 'oblique_angle')

    return {
      subclassMarker: 'AcDbAlignedDimension',
      ...commonAttrs,
      ...dimensionCommonAttrs,
      insertionPoint: insertionPoint,
      subDefinitionPoint1: subDefinitionPoint1,
      subDefinitionPoint2: subDefinitionPoint2,
      rotationAngle: rotationAngle == null ? 0 : rotationAngle,
      obliqueAngle: obliqueAngle
    }
  }

  private convert3PointAngularDimension(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgAngularDimensionEntity {
    const libredwg = this.libredwg
    const dimensionCommonAttrs = this.getDimensionCommonAttrs(entity)
    const subDefinitionPoint1 = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'xline1_pt')
    const subDefinitionPoint2 = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'xline2_pt')
    const centerPoint = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'center_pt')
    const arcPoint = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'xline2end_pt')

    return {
      subclassMarker: 'AcDb3PointAngularDimension',
      ...commonAttrs,
      ...dimensionCommonAttrs,
      subDefinitionPoint1: subDefinitionPoint1,
      subDefinitionPoint2: subDefinitionPoint2,
      centerPoint: centerPoint,
      arcPoint: arcPoint
    }
  }

  private convertDiameterDimension(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgRadialDiameterDimensionEntity {
    const libredwg = this.libredwg
    const dimensionCommonAttrs = this.getDimensionCommonAttrs(entity)
    // TODO: Not sure whether 'first_arc_pt' is same as 'centerPoint'
    const centerPoint = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'first_arc_pt')
    const leaderLength = libredwg.dwg_dynapi_entity_data<number>(entity, 'leader_len')

    return {
      subclassMarker: 'AcDbDiametricDimension',
      ...commonAttrs,
      ...dimensionCommonAttrs,
      centerPoint: centerPoint,
      leaderLength: leaderLength
    }
  }

  private convertOrdinateDimension(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgOrdinateDimensionEntity {
    const libredwg = this.libredwg
    const dimensionCommonAttrs = this.getDimensionCommonAttrs(entity)
    // TODO: Not sure whether 'feature_location_pt' is same as 'subDefinitionPoint1'
    const subDefinitionPoint1 = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'feature_location_pt')
    // TODO: Not sure whether 'leader_endpt' is same as 'subDefinitionPoint2'
    const subDefinitionPoint2 = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'leader_endpt')

    return {
      subclassMarker: 'AcDbOrdinateDimension',
      ...commonAttrs,
      ...dimensionCommonAttrs,
      subDefinitionPoint1: subDefinitionPoint1,
      subDefinitionPoint2: subDefinitionPoint2
    }
  }

  private convertRadiusDimension(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgRadialDiameterDimensionEntity {
    const libredwg = this.libredwg
    const dimensionCommonAttrs = this.getDimensionCommonAttrs(entity)
    // TODO: Not sure whether 'first_arc_pt' is same as 'centerPoint'
    const centerPoint = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'first_arc_pt')
    const leaderLength = libredwg.dwg_dynapi_entity_data<number>(entity, 'leader_len')

    return {
      subclassMarker: 'AcDbRadialDimension',
      ...commonAttrs,
      ...dimensionCommonAttrs,
      centerPoint: centerPoint,
      leaderLength: leaderLength
    }
  }

  private convertEllise(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgEllipseEntity {
    const libredwg = this.libredwg
    const center = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'center')
    const majorAxisEndPoint = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'sm_axis')
    const extrusionDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'extrusion')
    const axisRatio = libredwg.dwg_dynapi_entity_data<number>(entity, 'axis_ratio')
    const startAngle = libredwg.dwg_dynapi_entity_data<number>(entity, 'start_angle')
    const endAngle = libredwg.dwg_dynapi_entity_data<number>(entity, 'end_angle')

    return {
      type: 'ELLIPSE',
      ...commonAttrs,
      center: center,
      majorAxisEndPoint: majorAxisEndPoint,
      extrusionDirection: extrusionDirection,
      axisRatio: axisRatio,
      startAngle: startAngle,
      endAngle: endAngle
    }
  }

  private convertHatch(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgHatchEntity  {
    const libredwg = this.libredwg
    const extrusionDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'extrusion')
    const patternName = libredwg.dwg_dynapi_entity_data<string>(entity, 'name')
    const isSolidFill = libredwg.dwg_dynapi_entity_data<number>(entity, 'is_solid_fill')
    const isAssociative = libredwg.dwg_dynapi_entity_data<number>(entity, 'is_associative')
    const numberOfBoundaryPaths = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_paths')
    const paths_ptr = libredwg.dwg_dynapi_entity_data<number>(entity, 'paths')
    const boundaryPaths = libredwg.dwg_ptr_to_hatch_path_array(
      paths_ptr,
      numberOfBoundaryPaths
    )
    const patternStyle = libredwg.dwg_dynapi_entity_data<number>(entity, 'style')
    const patternType = libredwg.dwg_dynapi_entity_data<number>(entity, 'pattern_type')
    const patternAngle = libredwg.dwg_dynapi_entity_data<number>(entity, 'angle')
    const patternScale = libredwg.dwg_dynapi_entity_data<number>(entity, 'scale_spacing')
    const numberOfDefinitionLines = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_deflines')
    const definitionLines_ptr = libredwg.dwg_dynapi_entity_data<number>(entity, 'deflines')
    const definitionLines = libredwg.dwg_ptr_to_hatch_defline_array(
      definitionLines_ptr,
      numberOfDefinitionLines
    )
    const pixelSize = libredwg.dwg_dynapi_entity_data<number>(entity, 'pixel_size')
    const numberOfSeedPoints = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_seeds')
    const seedPoints_ptr = libredwg.dwg_dynapi_entity_data<number>(entity, 'seeds')
    const seedPoints = libredwg.dwg_ptr_to_point2d_array(
      seedPoints_ptr,
      numberOfSeedPoints
    )

    const result = {
      ...commonAttrs,
      // elevationPoint: DwgPoint3D
      extrusionDirection: extrusionDirection,
      patternName: patternName,
      solidFill: isSolidFill
        ? DwgHatchSolidFill.SolidFill
        : DwgHatchSolidFill.PatternFill,
      // patternFillColor: number
      associativity: isAssociative
        ? DwgHatchAssociativity.Associative
        : DwgHatchAssociativity.NonAssociative,
      numberOfBoundaryPaths: numberOfBoundaryPaths,
      boundaryPaths: this.convertHatchBoundaryPaths(boundaryPaths),
      hatchStyle: patternStyle as DwgHatchStyle,
      patternType: patternType as DwgHatchPatternType,
      patternAngle: patternAngle,
      patternScale: patternScale,
      numberOfDefinitionLines: numberOfDefinitionLines,
      definitionLines: definitionLines.map(value => {
        return {
          angle: value.angle,
          base: value.pt0,
          offset: value.offset,
          numberOfDashLengths: value.dashes.length,
          dashLengths: value.dashes
        }
      }),
      pixelSize: pixelSize,
      numberOfSeedPoints: numberOfSeedPoints,
      // offsetVector?: DwgPoint3D
      seedPoints: seedPoints
      // gradientFlag?: DwgHatchGradientFlag
    }

    const gradientFlag = libredwg.dwg_dynapi_entity_data<number>(entity, 'is_gradient_fill')
    if (gradientFlag > 0) {
      const gradientName = libredwg.dwg_dynapi_entity_data<string>(entity, 'gradient_name')
      const gradientRotation = libredwg.dwg_dynapi_entity_data<number>(entity, 'gradient_angle')
      const gradientDefinition = libredwg.dwg_dynapi_entity_data<number>(entity, 'gradient_shift')
      const colorTint = libredwg.dwg_dynapi_entity_data<number>(entity, 'gradient_tint')
      const gradientColorFlag = libredwg.dwg_dynapi_entity_data<number>(entity, 'single_color_gradient')
      // const numberOfColors = libredwg.dwg_dynapi_entity_value(entity, 'num_colors')
      //   .data as number
      const gradientColors_ptr = libredwg.dwg_dynapi_entity_data<number>(entity, 'colors')
      const gradientColors = libredwg.dwg_ptr_to_hatch_gradient_color_array(gradientColors_ptr, (gradientColorFlag == 1) ? 1 : 2)

      return {
        type: 'HATCH',
        ...result,
        gradientFlag: DwgHatchGradientFlag.Gradient,
        gradientColorFlag: gradientColorFlag == 1 ? DwgHatchGradientColorFlag.OneColor : DwgHatchGradientColorFlag.TwoColor,
        gradientName,
        gradientRotation,
        gradientDefinition,
        colorTint,
        gradientColors
      }
    } else {
      return {
        type: 'HATCH',
        ...result
      }
    }
  }

  private convertHatchBoundaryPaths(paths: Dwg_HATCH_Path[]) {
    const converted: DwgBoundaryPath[] = paths
      .filter(path => path.num_segs_or_paths > 0)
      .map(path => {
        const commonAttrs = {
          boundaryPathTypeFlag: path.flag
        }

        // Check whether it is a polyline
        if (path.flag & 0x02) {
          return {
            ...commonAttrs,
            hasBulge: path.bulges_present,
            isClosed: path.closed,
            numberOfVertices: path.num_segs_or_paths,
            vertices: path.polyline_paths.map(vertex => {
              return {
                x: vertex.point.x,
                y: vertex.point.y,
                bulge: vertex.bulge
              }
            })
          } as DwgPolylineBoundaryPath
        } else {
          const edges = path.segs.map(seg => {
            if (seg.curve_type == Dwg_Hatch_Edge_Type.Line) {
              return {
                type: DwgBoundaryPathEdgeType.Line,
                start: seg.first_endpoint,
                end: seg.second_endpoint
              } as DwgLineEdge
            } else if (seg.curve_type == Dwg_Hatch_Edge_Type.CircularArc) {
              return {
                type: DwgBoundaryPathEdgeType.Circular,
                center: seg.center,
                radius: seg.radius,
                startAngle: seg.start_angle,
                endAngle: seg.end_angle,
                isCCW: seg.is_ccw
              } as DwgArcEdge
            } else if (seg.curve_type == Dwg_Hatch_Edge_Type.EllipticArc) {
              return {
                type: DwgBoundaryPathEdgeType.Elliptic,
                center: seg.center,
                end: seg.endpoint,
                lengthOfMinorAxis: seg.minor_major_ratio,
                startAngle: seg.start_angle,
                endAngle: seg.end_angle,
                isCCW: seg.is_ccw
              } as DwgEllipseEdge
            } else if (seg.curve_type == Dwg_Hatch_Edge_Type.Spline) {
              return {
                type: DwgBoundaryPathEdgeType.Spline,
                degree: seg.degree,
                isRational: seg.is_rational,
                isPeriodic: seg.is_periodic,
                numberOfKnots: seg.num_knots,
                numberOfControlPoints: seg.num_control_points,
                knots: seg.knots,
                controlPoints: seg.control_points,
                numberOfFitData: seg.num_fitpts,
                fitDatum: seg.fitpts,
                startTangent: seg.start_tangent,
                endTangent: seg.end_tangent
              } as DwgSplineEdge
            }
          })
          return {
            ...commonAttrs,
            numberOfEdges: path.num_segs_or_paths,
            edges: edges
          } as DwgEdgeBoundaryPath<DwgBoundaryPathEdge>
        }
      })
    return converted
  }

  private convertImage(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgImageEntity {
    const libredwg = this.libredwg
    const version = libredwg.dwg_dynapi_entity_data<number>(entity, 'class_version')
    const position = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'pt0')
    const uPixel = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'uvec')
    const vPixel = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'vvec')
    const imageSize = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(entity, 'image_size')
    const flags = libredwg.dwg_dynapi_entity_data<number>(entity, 'display_props')
    const clipping = libredwg.dwg_dynapi_entity_data<number>(entity, 'clipping')
    const brightness = libredwg.dwg_dynapi_entity_data<number>(entity, 'brightness')
    const contrast = libredwg.dwg_dynapi_entity_data<number>(entity, 'contrast')
    const fade = libredwg.dwg_dynapi_entity_data<number>(entity, 'fade')
    const clipMode = libredwg.dwg_dynapi_entity_data<number>(entity, 'clip_mode')
    const clippingBoundaryType = libredwg.dwg_dynapi_entity_data<number>(entity, 'clip_boundary_type')
    const countBoundaryPoints = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_clip_verts')
    const clip_verts = libredwg.dwg_dynapi_entity_data<number>(entity, 'clip_verts')
    const clippingBoundaryPath = libredwg.dwg_ptr_to_point3d_array(
      clip_verts,
      countBoundaryPoints
    )

    const imagedef_ref = libredwg.dwg_dynapi_entity_data<number>(entity, 'imagedef')
    const imageDefHandle = (libredwg.dwg_ref_get_id(imagedef_ref) ?? '')
    const imagedefreactor_ref = libredwg.dwg_dynapi_entity_data<number>(entity, 'imagedefreactor')
    const imageDefReactorHandle = (libredwg.dwg_ref_get_id(imagedefreactor_ref) ?? '')

    return {
      type: 'IMAGE',
      ...commonAttrs,
      version: version,
      position: position,
      uPixel: uPixel,
      vPixel: vPixel,
      imageSize: imageSize,
      imageDefHandle: imageDefHandle,
      flags: flags as DwgImageFlags,
      clipping: clipping,
      brightness: brightness,
      contrast: contrast,
      fade: fade,
      imageDefReactorHandle: imageDefReactorHandle,
      clippingBoundaryType:
        clippingBoundaryType as DwgImageClippingBoundaryType,
      countBoundaryPoints: countBoundaryPoints,
      clippingBoundaryPath: clippingBoundaryPath,
      clipMode: clipMode
    }
  }

  private convertInsert(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgInsertEntity {
    const libredwg = this.libredwg

    // Get block name
    let name = ''
    const block_header_ref = libredwg.dwg_dynapi_entity_data<number>(entity, 'block_header')
    if (block_header_ref) {
      const block_header_obj = libredwg.dwg_ref_get_object(block_header_ref)
      if (block_header_obj) {
        const block_header_tio =
          libredwg.dwg_object_to_object_tio(block_header_obj)
        if (block_header_tio) {
          name =
            libredwg.dwg_entity_block_header_get_block(block_header_tio).name
        }
      }
    }
    if (!name) {
      /* pre-R2.0 */
      name = libredwg.dwg_dynapi_entity_data<string>(entity, 'block_name')
    }

    const insertionPoint = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'ins_pt')
    const scale = libredwg.dwg_dynapi_entity_data<DwgPoint3D | null>(entity, 'scale')
    const rotation = libredwg.dwg_dynapi_entity_data<number>(entity, 'rotation')
    const columnCount = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_cols')
    const rowCount = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_rows')
    const columnSpacing = libredwg.dwg_dynapi_entity_data<number>(entity, 'col_spacing')
    const rowSpacing = libredwg.dwg_dynapi_entity_data<number>(entity, 'row_spacing')
    const extrusionDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'extrusion')

    const attrib_ptr_array = libredwg.dwg_entity_insert_get_attribs(entity)
    const attribs: DwgAttribEntity[] = []
    attrib_ptr_array.forEach(object_ptr => {
      const entity = libredwg.dwg_object_to_entity(object_ptr)
      const entity_tio = libredwg.dwg_object_to_entity_tio(object_ptr)
      if (entity && entity_tio) {
        // Get values of the common attributes of ATTRIB entity
        const commonAttrs = this.getCommonAttrs(entity)
        const fixedtype = libredwg.dwg_object_get_fixedtype(object_ptr)
        if (fixedtype == Dwg_Object_Type.DWG_TYPE_ATTRIB) {
          attribs.push(this.convertAttrib(entity_tio, commonAttrs))
        }
      }
    })

    // TODO: convert block attributes
    return {
      type: 'INSERT',
      ...commonAttrs,
      name: name,
      insertionPoint: insertionPoint,
      xScale: scale ? scale.x : 1,
      yScale: scale ? scale.y : 1,
      zScale: scale ? scale.z : 1,
      rotation: rotation,
      columnCount: columnCount,
      rowCount: rowCount,
      columnSpacing: columnSpacing,
      rowSpacing: rowSpacing,
      extrusionDirection: extrusionDirection,
      attribs: attribs
    }
  }

  private convertLeader(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgLeaderEntity {
    const libredwg = this.libredwg
    const styleName = libredwg.dwg_entity_mtext_get_style_name(entity)
    const isArrowheadEnabled = libredwg.dwg_dynapi_entity_data<number>(entity, 'arrowhead_type')
    const isSpline = libredwg.dwg_dynapi_entity_data<number>(entity, 'path_type')
    const leaderCreationFlag = libredwg.dwg_dynapi_entity_data<number>(entity, 'annot_type')
    const isHooklineSameDirection = libredwg.dwg_dynapi_entity_data<number>(entity, 'hookline_dir')
    const isHooklineExists = libredwg.dwg_dynapi_entity_data<number>(entity, 'hookline_on')
    const textHeight = libredwg.dwg_dynapi_entity_data<number>(entity, 'box_height')
    const textWidth = libredwg.dwg_dynapi_entity_data<number>(entity, 'box_width')
    const numberOfVertices = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_points')
    const vertices_ptr = libredwg.dwg_dynapi_entity_data<number>(entity, 'points')
    const vertices =
      numberOfVertices > 0
        ? libredwg.dwg_ptr_to_point3d_array(vertices_ptr, numberOfVertices)
        : []
    const byBlockColor = libredwg.dwg_dynapi_entity_data<number>(entity, 'byblock_color')
    const normal = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'extrusion')
    const horizontalDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'x_direction')
    const offsetFromBlock = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'inspt_offset')
    const offsetFromAnnotation = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'endptproj')

    return {
      type: 'LEADER',
      ...commonAttrs,
      styleName: styleName,
      isArrowheadEnabled: isArrowheadEnabled > 0,
      isSpline: isSpline > 0,
      leaderCreationFlag: leaderCreationFlag,
      isHooklineSameDirection: isHooklineSameDirection > 0,
      isHooklineExists: isHooklineExists > 0,
      textHeight: textHeight,
      textWidth: textWidth,
      numberOfVertices: numberOfVertices,
      vertices: vertices,
      byBlockColor: byBlockColor,
      normal: normal,
      horizontalDirection: horizontalDirection,
      offsetFromBlock: offsetFromBlock,
      offsetFromAnnotation: offsetFromAnnotation
    }
  }

  private convertLine(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgLineEntity {
    const libredwg = this.libredwg
    const startPoint = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'start')
    const endPoint = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'end')
    const thickness = libredwg.dwg_dynapi_entity_data<number>(entity, 'thickness')
    const extrusionDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'extrusion')

    return {
      type: 'LINE',
      ...commonAttrs,
      thickness: thickness,
      startPoint: startPoint,
      endPoint: endPoint,
      extrusionDirection: extrusionDirection
    }
  }

  private convertLWPolyline(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgLWPolylineEntity {
    const libredwg = this.libredwg
    const numberOfVertices = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_points')
    const flag = libredwg.dwg_dynapi_entity_data<number>(entity, 'flag')
    const constantWidth = libredwg.dwg_dynapi_entity_data<number>(entity, 'const_width')
    const elevation = libredwg.dwg_dynapi_entity_data<number>(entity, 'elevation')
    const thickness = libredwg.dwg_dynapi_entity_data<number>(entity, 'thickness')
    const extrusionDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'extrusion')

    const vertices: DwgLWPolylineVertex[] = []
    const num_points = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_points')
    const points_ptr = libredwg.dwg_dynapi_entity_data<number>(entity, 'points')
    const points = libredwg.dwg_ptr_to_point2d_array(points_ptr, num_points)
    const num_bulges = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_bulges')
    const bulges_ptr = libredwg.dwg_dynapi_entity_data<number>(entity, 'bulges')
    const bulges = libredwg.dwg_ptr_to_double_array(bulges_ptr, num_bulges)
    points.forEach((point, index) => {
      vertices.push({
        id: index,
        x: point.x,
        y: point.y,
        bulge: bulges.length > index ? bulges[index] : 0
      })
    })

    return {
      type: 'LWPOLYLINE',
      ...commonAttrs,
      numberOfVertices: numberOfVertices,
      flag: flag,
      constantWidth: constantWidth,
      elevation: elevation,
      thickness: thickness,
      extrusionDirection: extrusionDirection,
      vertices: vertices
    }
  }

  private convertMLine(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgMLineEntity {
    const libredwg = this.libredwg
    const scale = libredwg.dwg_dynapi_entity_data<number>(entity, 'scale')
    const flags = libredwg.dwg_dynapi_entity_data<number>(entity, 'flags')
    const justification = libredwg.dwg_dynapi_entity_data<number>(entity, 'justification')
    const startPoint = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'base_point')
    const extrusionDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'extrusion')
    const numberOfLines = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_lines')
    const numberOfVertices = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_verts')
    const verts_ptr = libredwg.dwg_dynapi_entity_data<number>(entity, 'verts')
    const verts = libredwg.dwg_ptr_to_mline_vertex_array(
      verts_ptr,
      numberOfVertices
    )

    const vertices: DwgMLineVertex[] = []
    verts.forEach(vert => {
      vertices.push({
        vertex: vert.vertex,
        vertexDirection: vert.vertex_direction,
        miterDirection: vert.miter_direction,
        numberOfLines: vert.num_lines,
        lines: vert.lines.map(line => {
          return {
            numberOfSegmentParams: line.num_segparms,
            segmentParams: line.segparms,
            numberOfAreaFillParams: line.num_areafillparms,
            areaFillParams: line.areafillparms
          }
        })
      })
    })

    return {
      type: 'MLINE',
      ...commonAttrs,
      scale: scale,
      flags: flags,
      justification: justification,
      startPoint: startPoint,
      extrusionDirection: extrusionDirection,
      numberOfLines: numberOfLines,
      numberOfVertices: numberOfVertices,
      vertices: vertices,
      mlineStyle: '' // TODO: Set the correct value
    }
  }

  private convertMultiLeader(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgMultiLeaderEntity {
    const libredwg = this.libredwg
    const entityVal = <T>(field: string) => libredwg.dwg_dynapi_entity_data<T>(entity, field)
    const subclassVal = <T>(ptr: number, subclass: string, field: string) => libredwg.dwg_dynapi_subclass_data<T>(ptr, subclass, field)
    const refToId = (ref: number) => libredwg.dwg_ref_get_id(ref)
    const asBool = (value: number) => value > 0
    const mleaderColor = (color: Dwg_Color | undefined) =>
      color != null ? dwgColorToMLeaderRawColor(color) : undefined

    const version = entityVal<number>('class_version')
    const leaderStyleId = refToId(entityVal<number>('mleaderstyle'))
    const propertyOverrideFlag = entityVal<number>('flags')
    const leaderLineType = entityVal<number>('type')
    const leaderLineColor = mleaderColor(entityVal<Dwg_Color>('line_color'))
    const leaderLineTypeId = refToId(entityVal<number>('line_ltype'))
    const leaderLineWeight = entityVal<number>('line_linewt')
    const landingEnabled = asBool(entityVal<number>('has_landing'))
    const doglegEnabled = asBool(entityVal<number>('has_dogleg'))
    const doglegLength = entityVal<number>('landing_dist')
    const arrowheadId = refToId(entityVal<number>('arrow_handle'))
    const arrowheadSize = entityVal<number>('arrow_size')
    const contentType = entityVal<number>('style_content')
    const textStyleId = refToId(entityVal<number>('text_style'))
    const textLeftAttachmentType = entityVal<number>('text_left')
    const textRightAttachmentType = entityVal<number>('text_right')
    const textAngleType = entityVal<number>('text_angletype')
    const textAlignmentType = entityVal<number>('text_alignment')
    const textColor = mleaderColor(entityVal<Dwg_Color>('text_color'))
    const textFrameEnabled = asBool(entityVal<number>('has_text_frame'))
    const blockContentId = refToId(entityVal<number>('block_style'))
    const blockContentColor = mleaderColor(entityVal<Dwg_Color>('block_color'))
    const blockContentScale = entityVal<DwgPoint3D>('block_scale')
    const blockContentRotation = entityVal<number>('block_rotation')
    const blockContentConnectionType = entityVal<number>('style_attachment')
    const annotativeScaleEnabled = asBool(entityVal<number>('is_annotative'))
    const textDirectionNegative = asBool(entityVal<number>('is_neg_textdir'))
    const textAlignInIPE = entityVal<number>('ipe_alignment')
    let textAttachmentPoint = entityVal<number>('justification')
    const textAttachmentDirection = entityVal<number>('attach_dir')
    const bottomTextAttachmentDirection = entityVal<number>('attach_bottom')
    const topTextAttachmentDirection = entityVal<number>('attach_top')
    const contentScale = entityVal<number>('scale_factor')

    const numArrowheads = entityVal<number>('num_arrowheads')
    const arrowheadsPtr = entityVal<number>('arrowheads')
    const arrowHeadSize = libredwg.dwg_dynapi_subclass_size('LEADER_ArrowHead')
    const arrowheadOverrides: DwgMultiLeaderIndexedHandle[] = []
    for (let i = 0; i < numArrowheads; i++) {
      const arrowheadPtr = arrowheadsPtr + i * arrowHeadSize
      arrowheadOverrides.push({
        index: subclassVal<number>(arrowheadPtr, 'LEADER_ArrowHead', 'is_default'),
        handle: refToId(
          subclassVal<number>(arrowheadPtr, 'LEADER_ArrowHead', 'arrowhead')
        ) ?? ''
      })
    }

    const numBlocklabels = entityVal<number>('num_blocklabels')
    const blocklabelsPtr = entityVal<number>('blocklabels')
    const blockLabelSize = libredwg.dwg_dynapi_subclass_size('LEADER_BlockLabel')
    const blockAttributes: DwgMultiLeaderBlockAttribute[] = []
    for (let i = 0; i < numBlocklabels; i++) {
      const blocklabelPtr = blocklabelsPtr + i * blockLabelSize
      blockAttributes.push({
        id: refToId(
          subclassVal<number>(blocklabelPtr, 'LEADER_BlockLabel', 'attdef')
        ),
        index: subclassVal<number>(
          blocklabelPtr,
          'LEADER_BlockLabel',
          'ui_index'
        ),
        width: subclassVal<number>(blocklabelPtr, 'LEADER_BlockLabel', 'width'),
        text: subclassVal<string>(
          blocklabelPtr,
          'LEADER_BlockLabel',
          'label_text'
        )
      })
    }

    const ctxPtr =
      entity + libredwg.dwg_dynapi_entity_field_offset(entity, 'ctx')
    const contentPtr =
      ctxPtr +
      libredwg.dwg_dynapi_subclass_field_offset(
        'MLEADER_AnnotContext',
        'content'
      )
    const contentScaleFactor = subclassVal<number>(
      ctxPtr,
      'MLEADER_AnnotContext',
      'scale_factor'
    )
    const contentBasePosition = subclassVal<DwgPoint3D>(
      ctxPtr,
      'MLEADER_AnnotContext',
      'content_base'
    )
    const landingGap = subclassVal<number>(
      ctxPtr,
      'MLEADER_AnnotContext',
      'landing_gap'
    )
    const textAttachment = subclassVal<number>(
      ctxPtr,
      'MLEADER_AnnotContext',
      'attach_dir'
    )
    const contextTextHeight = subclassVal<number>(
      ctxPtr,
      'MLEADER_AnnotContext',
      'text_height'
    )
    const contextArrowSize = subclassVal<number>(
      ctxPtr,
      'MLEADER_AnnotContext',
      'arrow_size'
    )
    const contextTextLeft = subclassVal<number>(
      ctxPtr,
      'MLEADER_AnnotContext',
      'text_left'
    )
    const contextTextRight = subclassVal<number>(
      ctxPtr,
      'MLEADER_AnnotContext',
      'text_right'
    )
    const contextTextAngleType = subclassVal<number>(
      ctxPtr,
      'MLEADER_AnnotContext',
      'text_angletype'
    )
    const contextTextAlignment = subclassVal<number>(
      ctxPtr,
      'MLEADER_AnnotContext',
      'text_alignment'
    )
    const hasMText = asBool(
      subclassVal<number>(ctxPtr, 'MLEADER_AnnotContext', 'has_content_txt')
    )
    const hasBlock = asBool(
      subclassVal<number>(ctxPtr, 'MLEADER_AnnotContext', 'has_content_blk')
    )
    const planeOrigin = subclassVal<DwgPoint3D>(
      ctxPtr,
      'MLEADER_AnnotContext',
      'base'
    )
    const planeXAxisDirection = subclassVal<DwgPoint3D>(
      ctxPtr,
      'MLEADER_AnnotContext',
      'base_dir'
    )
    const planeYAxisDirection = subclassVal<DwgPoint3D>(
      ctxPtr,
      'MLEADER_AnnotContext',
      'base_vert'
    )
    const planeNormalReversed = asBool(
      subclassVal<number>(ctxPtr, 'MLEADER_AnnotContext', 'is_normal_reversed')
    )

    let textFlowDirection: number | undefined
    let normal: DwgPoint3D | undefined
    let textRotation: number | undefined
    let textWidth: number | undefined
    let textLineSpacingFactor: number | undefined
    let textLineSpacingStyle: number | undefined
    let textAnchor: DwgPoint3D | undefined
    let textDirection: DwgPoint3D | undefined
    let textBackgroundColor: number | undefined
    let textBackgroundScaleFactor: number | undefined
    let textBackgroundTransparency: number | undefined
    let textBackgroundColorOn: boolean | undefined
    let textFillOn: boolean | undefined
    let textColumnType: number | undefined
    let textUseAutoHeight: boolean | undefined
    let textColumnWidth: number | undefined
    let textColumnGutterWidth: number | undefined
    let textColumnFlowReversed: boolean | undefined
    let textColumnHeight: number | undefined
    let textUseWordBreak: boolean | undefined
    let textContent: string | undefined

    if (hasMText) {
      const textAlignment = subclassVal<number>(
        contentPtr,
        'MLEADER_Content_MText',
        'alignment'
      )
      if (textAlignment != null && textAlignment !== 0) {
        textAttachmentPoint = textAlignment
      }
      normal = subclassVal<DwgPoint3D>(
        contentPtr,
        'MLEADER_Content_MText',
        'normal'
      )
      textAnchor = subclassVal<DwgPoint3D>(
        contentPtr,
        'MLEADER_Content_MText',
        'location'
      )
      textRotation = subclassVal<number>(
        contentPtr,
        'MLEADER_Content_MText',
        'rotation'
      )
      textDirection = subclassVal<DwgPoint3D>(
        contentPtr,
        'MLEADER_Content_MText',
        'direction'
      )
      textWidth = subclassVal<number>(contentPtr, 'MLEADER_Content_MText', 'width')
      textLineSpacingFactor = subclassVal<number>(
        contentPtr,
        'MLEADER_Content_MText',
        'line_spacing_factor'
      )
      textLineSpacingStyle = subclassVal<number>(
        contentPtr,
        'MLEADER_Content_MText',
        'line_spacing_style'
      )
      textFlowDirection = subclassVal<number>(
        contentPtr,
        'MLEADER_Content_MText',
        'flow'
      )
      textBackgroundColor = mleaderColor(
        subclassVal<Dwg_Color>(
          contentPtr,
          'MLEADER_Content_MText',
          'bg_color'
        )
      )
      textBackgroundScaleFactor = subclassVal<number>(
        contentPtr,
        'MLEADER_Content_MText',
        'bg_scale'
      )
      textBackgroundTransparency = subclassVal<number>(
        contentPtr,
        'MLEADER_Content_MText',
        'bg_transparency'
      )
      textFillOn = asBool(
        subclassVal<number>(contentPtr, 'MLEADER_Content_MText', 'is_bg_fill')
      )
      textBackgroundColorOn = asBool(
        subclassVal<number>(
          contentPtr,
          'MLEADER_Content_MText',
          'is_bg_mask_fill'
        )
      )
      textColumnType = subclassVal<number>(
        contentPtr,
        'MLEADER_Content_MText',
        'col_type'
      )
      textUseAutoHeight = asBool(
        subclassVal<number>(
          contentPtr,
          'MLEADER_Content_MText',
          'is_height_auto'
        )
      )
      textColumnWidth = subclassVal<number>(
        contentPtr,
        'MLEADER_Content_MText',
        'col_width'
      )
      textColumnGutterWidth = subclassVal<number>(
        contentPtr,
        'MLEADER_Content_MText',
        'col_gutter'
      )
      textColumnFlowReversed = asBool(
        subclassVal<number>(
          contentPtr,
          'MLEADER_Content_MText',
          'is_col_flow_reversed'
        )
      )
      const numColSizes = subclassVal<number>(
        contentPtr,
        'MLEADER_Content_MText',
        'num_col_sizes'
      )
      const colSizesPtr = subclassVal<number>(
        contentPtr,
        'MLEADER_Content_MText',
        'col_sizes'
      )
      if (numColSizes > 0) {
        textColumnHeight = libredwg.dwg_ptr_to_double_array(
          colSizesPtr,
          numColSizes
        )[0]
      }
      textUseWordBreak = asBool(
        subclassVal<number>(contentPtr, 'MLEADER_Content_MText', 'word_break')
      )
      textContent = subclassVal<string>(
        contentPtr,
        'MLEADER_Content_MText',
        'default_text'
      )
    }

    let blockContent: DwgMultiLeaderBlockContent | undefined
    if (hasBlock) {
      const transformPtr = subclassVal<number>(
        contentPtr,
        'MLEADER_Content_Block',
        'transform'
      )
      blockContent = {
        blockContentId: refToId(
          subclassVal<number>(contentPtr, 'MLEADER_Content_Block', 'block_table')
        ),
        normal: subclassVal<DwgPoint3D>(
          contentPtr,
          'MLEADER_Content_Block',
          'normal'
        ),
        position: subclassVal<DwgPoint3D>(
          contentPtr,
          'MLEADER_Content_Block',
          'location'
        ),
        scale: subclassVal<DwgPoint3D>(
          contentPtr,
          'MLEADER_Content_Block',
          'scale'
        ),
        rotation: subclassVal<number>(
          contentPtr,
          'MLEADER_Content_Block',
          'rotation'
        ),
        color: mleaderColor(
          subclassVal<Dwg_Color>(
            contentPtr,
            'MLEADER_Content_Block',
            'color'
          )
        ),
        transformationMatrix: transformPtr
          ? libredwg.dwg_ptr_to_double_array(transformPtr, 16)
          : undefined
      }
    }

    const numLeaders = subclassVal<number>(
      ctxPtr,
      'MLEADER_AnnotContext',
      'num_leaders'
    )
    const leadersPtr = subclassVal<number>(
      ctxPtr,
      'MLEADER_AnnotContext',
      'leaders'
    )
    const leaderNodeSize = libredwg.dwg_dynapi_subclass_size('LEADER_Node')
    const leaderLineSize = libredwg.dwg_dynapi_subclass_size('LEADER_Line')
    const leaderBreakSize = libredwg.dwg_dynapi_subclass_size('LEADER_Break')
    const leaderSections: DwgMultiLeaderLeaderSection[] = []
    for (let i = 0; i < numLeaders; i++) {
      const nodePtr = leadersPtr + i * leaderNodeSize
      const lastLeaderLinePointSet = asBool(
        subclassVal<number>(nodePtr, 'LEADER_Node', 'has_lastleaderlinepoint')
      )
      const doglegVectorSet = asBool(
        subclassVal<number>(nodePtr, 'LEADER_Node', 'has_dogleg')
      )
      const numBreaks = subclassVal<number>(nodePtr, 'LEADER_Node', 'num_breaks')
      const breaksPtr = subclassVal<number>(nodePtr, 'LEADER_Node', 'breaks')
      const nodeBreaks: DwgMultiLeaderBreak[] = []
      for (let j = 0; j < numBreaks; j++) {
        const breakPtr = breaksPtr + j * leaderBreakSize
        nodeBreaks.push({
          start: subclassVal<DwgPoint3D>(breakPtr, 'LEADER_Break', 'start'),
          end: subclassVal<DwgPoint3D>(breakPtr, 'LEADER_Break', 'end')
        })
      }

      const numLines = subclassVal<number>(nodePtr, 'LEADER_Node', 'num_lines')
      const linesPtr = subclassVal<number>(nodePtr, 'LEADER_Node', 'lines')
      const leaderLines: DwgMultiLeaderLeaderLine[] = []
      for (let j = 0; j < numLines; j++) {
        const linePtr = linesPtr + j * leaderLineSize
        const numPoints = subclassVal<number>(
          linePtr,
          'LEADER_Line',
          'num_points'
        )
        const pointsPtr = subclassVal<number>(linePtr, 'LEADER_Line', 'points')
        const vertices =
          numPoints > 0
            ? libredwg.dwg_ptr_to_point3d_array(pointsPtr, numPoints)
            : []
        const lineNumBreaks = subclassVal<number>(
          linePtr,
          'LEADER_Line',
          'num_breaks'
        )
        const lineBreaksPtr = subclassVal<number>(
          linePtr,
          'LEADER_Line',
          'breaks'
        )
        const lineBreaks: DwgMultiLeaderBreak[] = []
        for (let k = 0; k < lineNumBreaks; k++) {
          const breakPtr = lineBreaksPtr + k * leaderBreakSize
          lineBreaks.push({
            start: subclassVal<DwgPoint3D>(breakPtr, 'LEADER_Break', 'start'),
            end: subclassVal<DwgPoint3D>(breakPtr, 'LEADER_Break', 'end')
          })
        }
        leaderLines.push({
          vertices,
          leaderLineIndex: subclassVal<number>(
            linePtr,
            'LEADER_Line',
            'line_index'
          ),
          breaks: lineBreaks.length > 0 ? lineBreaks : undefined
        })
      }

      leaderSections.push({
        lastLeaderLinePoint: lastLeaderLinePointSet
          ? subclassVal<DwgPoint3D>(
              nodePtr,
              'LEADER_Node',
              'lastleaderlinepoint'
            )
          : undefined,
        lastLeaderLinePointSet,
        doglegVector: doglegVectorSet
          ? subclassVal<DwgPoint3D>(nodePtr, 'LEADER_Node', 'dogleg_vector')
          : undefined,
        doglegVectorSet,
        doglegLength: subclassVal<number>(nodePtr, 'LEADER_Node', 'dogleg_length'),
        breaks: nodeBreaks.length > 0 ? nodeBreaks : undefined,
        leaderBranchIndex: subclassVal<number>(
          nodePtr,
          'LEADER_Node',
          'branch_index'
        ),
        leaderLines
      })
    }

    return {
      type: 'MULTILEADER',
      ...commonAttrs,
      subclassMarker: 'AcDbMLeader',
      version,
      leaderStyleId,
      propertyOverrideFlag,
      leaderLineType,
      leaderLineColor,
      leaderLineTypeId,
      leaderLineWeight,
      landingEnabled,
      doglegEnabled,
      doglegLength,
      arrowheadId,
      arrowheadSize: arrowheadSize || contextArrowSize,
      contentType,
      textStyleId,
      textLeftAttachmentType: textLeftAttachmentType || contextTextLeft,
      textRightAttachmentType: textRightAttachmentType || contextTextRight,
      textAngleType: textAngleType || contextTextAngleType,
      textAlignmentType: textAlignmentType || contextTextAlignment,
      textColor,
      textFrameEnabled,
      landingGap,
      textAttachment,
      textFlowDirection,
      blockContentId,
      blockContentColor,
      blockContentScale,
      blockContentRotation,
      blockContentConnectionType,
      annotativeScaleEnabled,
      arrowheadOverrides:
        arrowheadOverrides.length > 0 ? arrowheadOverrides : undefined,
      blockAttributes: blockAttributes.length > 0 ? blockAttributes : undefined,
      textDirectionNegative,
      textAlignInIPE,
      textAttachmentPoint,
      textAttachmentDirection,
      bottomTextAttachmentDirection,
      topTextAttachmentDirection,
      contentScale: contentScale || contentScaleFactor,
      contentBasePosition,
      normal,
      textHeight: contextTextHeight,
      textRotation,
      textWidth,
      textLineSpacingFactor,
      textLineSpacingStyle,
      textAnchor,
      textDirection,
      textBackgroundColor,
      textBackgroundScaleFactor,
      textBackgroundTransparency,
      textBackgroundColorOn,
      textFillOn,
      textColumnType,
      textUseAutoHeight,
      textColumnWidth,
      textColumnGutterWidth,
      textColumnFlowReversed,
      textColumnHeight,
      textUseWordBreak,
      textContent,
      hasMText,
      hasBlock,
      blockContent,
      planeOrigin,
      planeXAxisDirection,
      planeYAxisDirection,
      planeNormalReversed,
      leaderSections: leaderSections.length > 0 ? leaderSections : undefined
    }
  }

  private convertOle2Frame(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgOle2FrameEntity {
    const libredwg = this.libredwg
    const oleVersion = libredwg.dwg_dynapi_entity_data<number>(entity, 'oleversion')
    const oleClient = libredwg.dwg_dynapi_entity_data<string>(entity, 'oleclient')
    const dataSize = libredwg.dwg_dynapi_entity_data<number>(entity, 'data_size')
    const leftUpPoint = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'pt1')
    const rightDownPoint = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'pt2')
    const lockAspect = libredwg.dwg_dynapi_entity_data<number>(entity, 'lock_aspect')
    const oleObjectType = libredwg.dwg_dynapi_entity_data<number>(entity, 'type')
    const tileModeDescriptor = libredwg.dwg_dynapi_entity_data<number>(entity, 'mode')
    const binaryData = libredwg.dwg_dynapi_entity_data<string>(entity, 'data')
    return {
      type: 'OLE2FRAME',
      ...commonAttrs,
      oleVersion: oleVersion,
      oleClient: oleClient,
      dataSize: dataSize,
      leftUpPoint: leftUpPoint,
      rightDownPoint: rightDownPoint,
      lockAspect: lockAspect,
      oleObjectType: oleObjectType,
      tileModeDescriptor: tileModeDescriptor,
      binaryData: binaryData
    }
  }

  private convertOleFrame(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgOleFrameEntity {
    const libredwg = this.libredwg
    const flag = libredwg.dwg_dynapi_entity_data<number>(entity, 'flag')
    const mode = libredwg.dwg_dynapi_entity_data<number>(entity, 'mode')
    const dataSize = libredwg.dwg_dynapi_entity_data<number>(entity, 'data_size')
    const binaryData = libredwg.dwg_dynapi_entity_data<string>(entity, 'data')
    return {
      type: 'OLEFRAME',
      ...commonAttrs,
      flag: flag,
      mode: mode,
      dataSize: dataSize,
      binaryData: binaryData
    }
  }

  private convertMText(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgMTextEntity {
    const libredwg = this.libredwg
    const insertionPoint = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'ins_pt')
    const textHeight = libredwg.dwg_dynapi_entity_data<number>(entity, 'text_height')
    const rectHeight = libredwg.dwg_dynapi_entity_data<number>(entity, 'rect_height')
    const rectWidth = libredwg.dwg_dynapi_entity_data<number>(entity, 'rect_width')
    const extentsWidth = libredwg.dwg_dynapi_entity_data<number>(entity, 'extents_width')
    const extentsHeight = libredwg.dwg_dynapi_entity_data<number>(entity, 'extents_height')
    const attachmentPoint = libredwg.dwg_dynapi_entity_data<number>(entity, 'attachment')
    const drawingDirection = libredwg.dwg_dynapi_entity_data<number>(entity, 'flow_dir')
    const text = libredwg.dwg_dynapi_entity_data<string>(entity, 'text')
    const styleName = libredwg.dwg_entity_mtext_get_style_name(entity)
    const extrusionDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'extrusion')
    const direction = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'x_axis_dir')
    const lineSpacingStyle = libredwg.dwg_dynapi_entity_data<number>(entity, 'linespace_style')
    const lineSpacing = libredwg.dwg_dynapi_entity_data<number>(entity, 'linespace_factor')
    const backgroundFill = libredwg.dwg_dynapi_entity_data<number>(entity, 'bg_fill_flag')
    const fillBoxScale = libredwg.dwg_dynapi_entity_data<number>(entity, 'bg_fill_scale')
    const backgroundFillColor = libredwg.dwg_dynapi_entity_data<Dwg_Color>(entity, 'bg_fill_color')
    const backgroundFillTransparency = libredwg.dwg_dynapi_entity_data<number>(entity, 'bg_fill_trans')

    const columnType = libredwg.dwg_dynapi_entity_data<number>(entity, 'column_type')
    const columnFlowReversed = libredwg.dwg_dynapi_entity_data<number>(entity, 'flow_reversed')
    const columnAutoHeight = libredwg.dwg_dynapi_entity_data<number>(entity, 'auto_height')
    const columnWidth = libredwg.dwg_dynapi_entity_data<number>(entity, 'column_width')
    const columnGutter = libredwg.dwg_dynapi_entity_data<number>(entity, 'gutter')
    const columnHeightCount = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_column_heights')
    const columnHeights_ptr = libredwg.dwg_dynapi_entity_data<number>(entity, 'column_heights')
    const columnHeights = libredwg.dwg_ptr_to_double_array(
      columnHeights_ptr,
      columnHeightCount
    )

    return {
      type: 'MTEXT',
      ...commonAttrs,
      insertionPoint: insertionPoint,
      textHeight: textHeight,
      rectHeight: rectHeight,
      rectWidth: rectWidth,
      extentsHeight: extentsHeight,
      extentsWidth: extentsWidth,
      attachmentPoint: attachmentPoint as DwgAttachmentPoint,
      drawingDirection: drawingDirection as DwgMTextDrawingDirection,
      text: text,
      styleName: styleName,
      extrusionDirection: extrusionDirection,
      direction: direction,
      rotation: 0, // TODO: Didn't find the corresponding field in libredwg
      lineSpacingStyle: lineSpacingStyle,
      lineSpacing: lineSpacing,
      backgroundFill: backgroundFill,
      // backgroundColor: backgroundColor.rgb, // TODO: Double check whether it should be color index
      fillBoxScale: fillBoxScale,
      backgroundFillColor: backgroundFillColor.rgb, // TODO: Double check whether it should be color index
      backgroundFillTransparency: backgroundFillTransparency,
      columnType: columnType,
      // columnCount: columnCount,
      columnFlowReversed: columnFlowReversed,
      columnAutoHeight: columnAutoHeight,
      columnWidth: columnWidth,
      columnGutter: columnGutter,
      columnHeightCount: columnHeightCount,
      columnHeights: columnHeights
    }
  }

  private convertPoint(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgPointEntity {
    const libredwg = this.libredwg
    const x = libredwg.dwg_dynapi_entity_data<number>(entity, 'x')
    const y = libredwg.dwg_dynapi_entity_data<number>(entity, 'y')
    const z = libredwg.dwg_dynapi_entity_data<number>(entity, 'z')
    const thickness = libredwg.dwg_dynapi_entity_data<number>(entity, 'thickness')
    const extrusionDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'extrusion')
    const angle = libredwg.dwg_dynapi_entity_data<number>(entity, 'x_ang')

    return {
      type: 'POINT',
      ...commonAttrs,
      position: { x, y, z },
      thickness: thickness,
      extrusionDirection: extrusionDirection,
      angle: angle
    }
  }

  private convertPolyline2d(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes,
    object: Dwg_Object_Ptr
  ): DwgPolyline2dEntity {
    const libredwg = this.libredwg
    const flag = libredwg.dwg_dynapi_entity_data<number>(entity, 'flag')
    const smoothType = libredwg.dwg_dynapi_entity_data<number>(entity, 'curve_type')
    const startWidth = libredwg.dwg_dynapi_entity_data<number>(entity, 'start_width')
    const endWidth = libredwg.dwg_dynapi_entity_data<number>(entity, 'end_width')
    const elevation = libredwg.dwg_dynapi_entity_data<number>(entity, 'elevation')
    const thickness = libredwg.dwg_dynapi_entity_data<number>(entity, 'thickness')
    const extrusionDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'extrusion')

    const vertices = libredwg.dwg_entity_polyline_2d_get_vertices(object)
    return {
      type: 'POLYLINE2D',
      ...commonAttrs,
      flag: flag,
      smoothType: smoothType,
      startWidth: startWidth,
      endWidth: endWidth,
      elevation: elevation,
      thickness: thickness,
      extrusionDirection: extrusionDirection,
      vertices: vertices.map(vertex => {
        return {
          x: vertex.point.x,
          y: vertex.point.y,
          z: vertex.point.z,
          startWidth: vertex.start_width,
          endWidth: vertex.end_width,
          bulge: vertex.bulge,
          flag: vertex.flag,
          tangentDirection: vertex.tangent_dir
        } as unknown as DwgVertex2dEntity
      }),
      meshMVertexCount: 0,
      meshNVertexCount: 0,
      surfaceMDensity: 0,
      surfaceNDensity: 0
    }
  }

  private convertPolyline3d(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes,
    object: Dwg_Object_Ptr
  ): DwgPolyline3dEntity {
    const libredwg = this.libredwg
    const flag = libredwg.dwg_dynapi_entity_data<number>(entity, 'flag')
    const smoothType = libredwg.dwg_dynapi_entity_data<number>(entity, 'curve_type')
    const startWidth = libredwg.dwg_dynapi_entity_data<number>(entity, 'start_width')
    const endWidth = libredwg.dwg_dynapi_entity_data<number>(entity, 'end_width')
    const extrusionDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'extrusion')

    const vertices = libredwg.dwg_entity_polyline_3d_get_vertices(object)
    return {
      type: 'POLYLINE3D',
      ...commonAttrs,
      flag: flag,
      smoothType: smoothType,
      startWidth: startWidth,
      endWidth: endWidth,
      extrusionDirection: extrusionDirection,
      vertices: vertices.map(vertex => {
        return {
          x: vertex.point.x,
          y: vertex.point.y,
          z: vertex.point.z,
          flag: vertex.flag
        } as unknown as DwgVertex3dEntity
      })
    }
  }

  private convertProxyEntity(
    entity: Dwg_Entity_PROXY_ENTITY_Ptr,
    commonAttrs: DwgCommonAttributes,
    objectPtr: Dwg_Object_Ptr
  ): DwgProxyEntity {
    const libredwg = this.libredwg
    const proxyEntityClassId = libredwg.dwg_dynapi_entity_data<number>(entity, 'proxy_id')
    const applicationEntityClassId = libredwg.dwg_dynapi_entity_data<number>(entity, 'class_id')
    const entityDataSize = libredwg.dwg_dynapi_entity_data<number>(entity, 'data_numbits')
    const objectDrawingFormat = libredwg.dwg_dynapi_entity_data<number>(entity, 'version')
    const fromDxf = libredwg.dwg_dynapi_entity_data<number>(entity, 'from_dxf')
    const numObjIds = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_objids')

    const graphicsBytes = libredwg.dwg_entity_get_preview(objectPtr)
    const graphicsDataSize = graphicsBytes?.length ?? 0
    const entityBytes =
      libredwg.dwg_entity_proxy_entity_get_entity_data(entity)
    const graphicsData = graphicsBytes
      ? uint8ArrayToHexString(graphicsBytes)
      : undefined
    const entityData = entityBytes
      ? uint8ArrayToHexString(entityBytes)
      : undefined

    let linkedObjectIds: string[] | undefined
    if (numObjIds > 0) {
      const objidsPtr = libredwg.dwg_dynapi_entity_data<number>(entity, 'objids')
      if (objidsPtr) {
        const objids = libredwg.dwg_ptr_to_object_ref_array(
          objidsPtr,
          numObjIds
        )
        linkedObjectIds = objids.map(ref => idToString(ref.absolute_ref))
      }
    }

    const originalDxfName = this.getOriginalDxfName(applicationEntityClassId)

    const result: DwgProxyEntity = {
      type: 'ACAD_PROXY_ENTITY',
      subclassMarker: 'AcDbProxyEntity',
      ...commonAttrs,
      proxyEntityClassId: proxyEntityClassId || 498,
      applicationEntityClassId
    }

    if (originalDxfName) {
      result.originalDxfName = originalDxfName
    }
    if (graphicsDataSize > 0) {
      result.graphicsDataSize = graphicsDataSize
    }
    if (graphicsData) {
      result.graphicsData = graphicsData
    }
    if (entityDataSize > 0) {
      result.entityDataSize = entityDataSize
    }
    if (entityData) {
      result.entityData = entityData
    }
    if (linkedObjectIds && linkedObjectIds.length > 0) {
      result.linkedObjectIds = linkedObjectIds
    }
    if (objectDrawingFormat) {
      result.objectDrawingFormat = objectDrawingFormat
    }
    if (fromDxf === 0 || fromDxf === 1) {
      result.originalDataFormat =
        fromDxf as DwgProxyOriginalDataFormat
    }

    return result
  }

  private getOriginalDxfName(classId: number): string | undefined {
    if (this.classes.length === 0 || classId < 0) {
      return undefined
    }
    const index = classId >= 500 ? classId - 500 : classId
    if (index >= 0 && index < this.classes.length) {
      return this.classes[index].dxfName
    }
    return undefined
  }

  private convertRay(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgRayEntity {
    const libredwg = this.libredwg
    const firstPoint = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'point')
    const unitDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'vector')
    return {
      type: 'RAY',
      ...commonAttrs,
      firstPoint: firstPoint,
      unitDirection: unitDirection
    }
  }

  private convertSection(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgSectionEntity {
    const libredwg = this.libredwg
    const state = libredwg.dwg_dynapi_entity_data<number>(entity, 'state')
    const flags = libredwg.dwg_dynapi_entity_data<number>(entity, 'flag')
    const name = libredwg.dwg_dynapi_entity_data<string>(entity, 'name')
    const verticalDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'vert_dir')
    const topHeight = libredwg.dwg_dynapi_entity_data<number>(entity, 'top_height')
    const bottomHeight = libredwg.dwg_dynapi_entity_data<number>(entity, 'bottom_height')
    const indicatorTransparency = libredwg.dwg_dynapi_entity_data<number>(entity, 'indicator_alpha')
    const indicatorColor = libredwg.dwg_dynapi_entity_data<Dwg_Color>(entity, 'indicator_color')
    const numberOfVertices = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_verts')
    const vertices_ptr = libredwg.dwg_dynapi_entity_data<number>(entity, 'verts')
    const vertices =
      numberOfVertices > 0
        ? libredwg.dwg_ptr_to_point3d_array(vertices_ptr, numberOfVertices)
        : []
    const numberOfBackLineVertices = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_blverts')
    const backLineVertices_ptr = libredwg.dwg_dynapi_entity_data<number>(entity, 'blverts')
    const backLineVertices =
      numberOfBackLineVertices > 0
        ? libredwg.dwg_ptr_to_point3d_array(
            backLineVertices_ptr,
            numberOfBackLineVertices
          )
        : []
    const geometrySettingHandle = libredwg.dwg_dynapi_entity_data<number>(entity, 'geometrySettingHardId')
    const geometrySettingHardId =
      libredwg.dwg_ref_get_handle_absolute_ref(geometrySettingHandle) ?? 0n
    return {
      type: 'SECTION',
      ...commonAttrs,
      state: state,
      flags: flags,
      name: name,
      verticalDirection: verticalDirection,
      topHeight: topHeight,
      bottomHeight: bottomHeight,
      indicatorTransparency: indicatorTransparency,
      indicatorColor: indicatorColor.rgb,
      numberOfVertices: numberOfVertices,
      vertices: vertices,
      numberOfBackLineVertices: numberOfBackLineVertices,
      backLineVertices: backLineVertices,
      geometrySettingHardId: geometrySettingHardId
    }
  }

  private convertShape(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgShapeEntity {
    const libredwg = this.libredwg
    const insertionPoint = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'ins_pt')
    const size = libredwg.dwg_dynapi_entity_data<number>(entity, 'scale')
    const rotation = libredwg.dwg_dynapi_entity_data<number>(entity, 'rotation')
    const xScale = libredwg.dwg_dynapi_entity_data<number>(entity, 'width_factor')
    const obliqueAngle = libredwg.dwg_dynapi_entity_data<number>(entity, 'oblique_angle')
    const thickness = libredwg.dwg_dynapi_entity_data<number>(entity, 'thickness')
    const extrusionDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'extrusion')
    const shapeNumber = libredwg.dwg_dynapi_entity_data<number>(entity, 'style_id')
    const styleName = libredwg.dwg_entity_text_get_style_name(entity)

    return {
      type: 'SHAPE',
      subclassMarker: 'AcDbShape',
      ...commonAttrs,
      thickness: thickness,
      insertionPoint: insertionPoint,
      size: size,
      shapeNumber: shapeNumber,
      styleName: styleName,
      rotation: rotation,
      xScale: xScale,
      obliqueAngle: obliqueAngle,
      extrusionDirection: extrusionDirection
    }
  }

  private convertSolid(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgSolidEntity {
    const libredwg = this.libredwg
    const corner1 = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(entity, 'corner1')
    const corner2 = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(entity, 'corner2')
    const corner3 = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(entity, 'corner3')
    const corner4 = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(entity, 'corner4')
    const thickness = libredwg.dwg_dynapi_entity_data<number>(entity, 'thickness')
    const extrusionDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'extrusion')

    return {
      type: 'SOLID',
      ...commonAttrs,
      corner1: corner1,
      corner2: corner2,
      corner3: corner3,
      corner4: corner4,
      thickness: thickness,
      extrusionDirection: extrusionDirection
    }
  }

  private convertSpline(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgSplineEntity {
    const libredwg = this.libredwg
    const flag = libredwg.dwg_dynapi_entity_data<number>(entity, 'splineflags')
    const degree = libredwg.dwg_dynapi_entity_data<number>(entity, 'degree')

    // Convert knots
    const knotTolerance = libredwg.dwg_dynapi_entity_data<number>(entity, 'knot_tol')
    const numberOfKnots = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_knots')
    const knots_ptr = libredwg.dwg_dynapi_entity_data<number>(entity, 'knots')
    const knots = libredwg.dwg_ptr_to_double_array(knots_ptr, numberOfKnots)

    // Convert fit points
    const fitTolerance = libredwg.dwg_dynapi_entity_data<number>(entity, 'fit_tol')
    const numberOfFitPoints = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_fit_pts')
    const fit_pts_ptr = libredwg.dwg_dynapi_entity_data<number>(entity, 'fit_pts')
    const fitPoints = libredwg.dwg_ptr_to_point3d_array(
      fit_pts_ptr,
      numberOfFitPoints
    )

    // Convert control points
    const weighted = libredwg.dwg_dynapi_entity_data<number>(entity, 'weighted')
    const controlTolerance = libredwg.dwg_dynapi_entity_data<number>(entity, 'ctrl_tol')
    const numberOfControlPoints = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_ctrl_pts')
    const ctrl_pts_ptr = libredwg.dwg_dynapi_entity_data<number>(entity, 'ctrl_pts')
    const controlPoints = libredwg.dwg_ptr_to_point4d_array(
      ctrl_pts_ptr,
      numberOfControlPoints
    )

    const startTangent = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'beg_tan_vec')
    const endTangent = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'end_tan_vec')

    return {
      type: 'SPLINE',
      ...commonAttrs,
      // normal?: DwgPoint3D
      flag: flag,
      degree: degree,
      numberOfKnots: numberOfKnots,
      numberOfControlPoints: numberOfControlPoints,
      numberOfFitPoints: numberOfFitPoints,
      knotTolerance: knotTolerance,
      controlTolerance: controlTolerance,
      fitTolerance: fitTolerance,
      startTangent: startTangent,
      endTangent: endTangent,
      knots: knots,
      weights: weighted ? controlPoints.map(value => value.w) : undefined,
      controlPoints: controlPoints.map(value => {
        return {
          x: value.x,
          y: value.y,
          z: value.z
        }
      }),
      fitPoints: fitPoints
    }
  }

  private convertTable(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgTableEntity {
    const libredwg = this.libredwg
    const name = libredwg.dwg_dynapi_subclass_data<string>(entity, 'ldata', 'name')
    const startPoint = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'ins_pt')
    const directionVector = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'horiz_direction')
    const tableValue = libredwg.dwg_dynapi_entity_data<number>(entity, 'flag_for_table_value')
    const rowCount = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_rows')
    const columnCount = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_cols')
    const row_heights_ptr = libredwg.dwg_dynapi_entity_data<number>(entity, 'row_heights')
    const rowHeightArr = libredwg.dwg_ptr_to_double_array(
      row_heights_ptr,
      rowCount
    )
    const col_widths_ptr = libredwg.dwg_dynapi_entity_data<number>(entity, 'col_widths')
    const columnWidthArr = libredwg.dwg_ptr_to_double_array(
      col_widths_ptr,
      columnCount
    )
    const table_style_ref = libredwg.dwg_dynapi_entity_data<number>(entity, 'tablestyle')
    const tableStyleId = (libredwg.dwg_ref_get_id(table_style_ref) ?? '')
    const block_header_ref = libredwg.dwg_dynapi_entity_data<number>(entity, 'block_header')
    const blockRecordHandle = (libredwg.dwg_ref_get_id(block_header_ref) ?? '')
    const overrideFlag = libredwg.dwg_dynapi_entity_data<number>(entity, 'table_flag_override')
    const borderColorOverrideFlag = libredwg.dwg_dynapi_entity_data<number>(entity, 'border_color_overrides_flag')
    const borderLineWeightOverrideFlag = libredwg.dwg_dynapi_entity_data<number>(entity, 'border_lineweight_overrides_flag')
    const borderVisibilityOverrideFlag = libredwg.dwg_dynapi_entity_data<number>(entity, 'border_visibility_overrides_flag')
    const num_cells = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_cells')
    const cells_ptr = libredwg.dwg_dynapi_entity_data<number>(entity, 'cells')
    const cells = libredwg.dwg_ptr_to_table_cell_array(cells_ptr, num_cells)

    return {
      type: 'ACAD_TABLE',
      ...commonAttrs,
      name: name,
      startPoint: startPoint,
      directionVector: directionVector,
      // attachmentPoint: DwgAttachmentPoint
      tableValue: tableValue,
      rowCount: rowCount,
      columnCount: columnCount,
      overrideFlag: overrideFlag,
      borderColorOverrideFlag: borderColorOverrideFlag,
      borderLineWeightOverrideFlag: borderLineWeightOverrideFlag,
      borderVisibilityOverrideFlag: borderVisibilityOverrideFlag,
      rowHeightArr: rowHeightArr,
      columnWidthArr: columnWidthArr,
      tableStyleId: tableStyleId,
      blockRecordHandle: blockRecordHandle,
      cells: this.convertTableCells(cells),
      bmpPreview: ''
    }
  }

  private convertTableCells(cells: Dwg_TABLE_Cell[]): DwgTableCell[] {
    return cells.map(cell => ({
      text: cell.text_value,
      attachmentPoint: cell.cell_alignment as DwgAttachmentPoint,
      textStyle: cell.text_style
        ? String(cell.text_style)
        : undefined,
      rotation: cell.rotation,
      cellType: cell.type,
      flagValue: cell.flags,
      mergedValue: cell.is_merged_value,
      autoFit: cell.is_autofit_flag,
      topBorderVisibility: !!cell.top_visibility,
      bottomBorderVisibility: !!cell.bottom_visibility,
      leftBorderVisibility: !!cell.left_visibility,
      rightBorderVisibility: !!cell.right_visibility,
      overrideFlag: cell.cell_flag_override,
      virtualEdgeFlag: cell.virtual_edge_flag,
      blockTableRecordId: cell.block_handle
        ? String(cell.block_handle.absolute_ref ?? '')
        : undefined,
      blockScale: cell.block_scale,
      blockAttrNum: cell.attr_defs?.length ?? 0,
      attrDefineId: cell.attr_defs?.map(value =>
        String(value.attdef?.absolute_ref ?? '')
      ),
      textHeight: cell.text_height ?? 0,
      extendedCellFlags: cell.additional_data_flag
    }))
  }

  private convertTextBase(entity: Dwg_Object_Entity_Ptr): DwgTextBase {
    const libredwg = this.libredwg
    const text = libredwg.dwg_dynapi_entity_data<string>(entity, 'text_value')
    const thickness = libredwg.dwg_dynapi_entity_data<number>(entity, 'thickness')
    const startPoint = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(entity, 'ins_pt')
    const endPoint = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(entity, 'alignment_pt')
    const rotation = libredwg.dwg_dynapi_entity_data<number>(entity, 'rotation')
    const textHeight = libredwg.dwg_dynapi_entity_data<number>(entity, 'height')
    const xScale = libredwg.dwg_dynapi_entity_data<number>(entity, 'width_factor')
    const obliqueAngle = libredwg.dwg_dynapi_entity_data<number>(entity, 'oblique_angle')
    const styleName = libredwg.dwg_entity_text_get_style_name(entity)
    const generationFlag = libredwg.dwg_dynapi_entity_data<number>(entity, 'generation')
    const halign = libredwg.dwg_dynapi_entity_data<number>(entity, 'horiz_alignment')
    const valign = libredwg.dwg_dynapi_entity_data<number>(entity, 'vert_alignment')
    const extrusionDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'extrusion')

    return {
      text: text,
      thickness: thickness,
      startPoint: startPoint,
      endPoint: endPoint,
      textHeight: textHeight,
      rotation: rotation,
      xScale: xScale,
      obliqueAngle: obliqueAngle,
      styleName: styleName,
      generationFlag: generationFlag,
      halign: halign as DwgTextHorizontalAlign,
      valign: valign as DwgTextVerticalAlign,
      extrusionDirection: extrusionDirection
    }
  }

  private convertText(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgTextEntity {
    return {
      type: 'TEXT',
      ...commonAttrs,
      ...this.convertTextBase(entity)
    }
  }

  private convertTolerance(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgToleranceEntity {
    const libredwg = this.libredwg
    const insertionPoint = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'ins_pt')
    const text = libredwg.dwg_dynapi_entity_data<string>(entity, 'text_value')
    const xAxisDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'x_direction')
    const extrusionDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'extrusion')
    const dimStyleName = libredwg.dwg_entity_get_dimstyle_name(entity)

    return {
      type: 'TOLERANCE',
      ...commonAttrs,
      styleName: dimStyleName,
      insertionPoint: insertionPoint,
      text: text,
      extrusionDirection: extrusionDirection,
      xAxisDirection: xAxisDirection
    }
  }

  private convertViewport(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgViewportEntity {
    const libredwg = this.libredwg
    const viewportCenter = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'center')
    const width = libredwg.dwg_dynapi_entity_data<number>(entity, 'width')
    const height = libredwg.dwg_dynapi_entity_data<number>(entity, 'height')
    const status = libredwg.dwg_dynapi_entity_data<number>(entity, 'on_off')
    const displayCenter = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(entity, 'VIEWCTR')
    const snapBase = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(entity, 'SNAPBASE')
    const snapSpacing = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(entity, 'SNAPUNIT')
    const gridSpacing = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(entity, 'GRIDUNIT')
    const viewDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'VIEWDIR')
    const targetPoint = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'view_target')
    const perspectiveLensLength = libredwg.dwg_dynapi_entity_data<number>(entity, 'lens_length')
    const frontClipZ = libredwg.dwg_dynapi_entity_data<number>(entity, 'front_clip_z')
    const backClipZ = libredwg.dwg_dynapi_entity_data<number>(entity, 'back_clip_z')
    // TODO: I am not sure whether view size in libredwg represents view height
    const viewHeight = libredwg.dwg_dynapi_entity_data<number>(entity, 'VIEWSIZE')
    const snapAngle = libredwg.dwg_dynapi_entity_data<number>(entity, 'SNAPANG')
    const viewTwistAngle = libredwg.dwg_dynapi_entity_data<number>(entity, 'twist_angle')
    const circleZoomPercent = libredwg.dwg_dynapi_entity_data<number>(entity, 'circle_zoom')
    // TODO: convert frozenLayerIds and clippingBoundaryId
    const statusBitFlags = libredwg.dwg_dynapi_entity_data<number>(entity, 'status_flag')
    const sheetName = libredwg.dwg_dynapi_entity_data<string>(entity, 'style_sheet')
    const renderMode = libredwg.dwg_dynapi_entity_data<number>(entity, 'render_mode')
    // TODO: Not sure whether UCSVP in libredwg represents ucsPerViewport
    const ucsPerViewport = libredwg.dwg_dynapi_entity_data<number>(entity, 'UCSVP')
    const ucsOrigin = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'ucsorg')
    const ucsXAxis = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'ucsxdir')
    const ucsYAxis = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'ucsydir')
    const named_ucs_ref = libredwg.dwg_dynapi_entity_data<number>(entity, 'named_ucs')
    const ucsId = libredwg.dwg_ref_get_id(named_ucs_ref)
    const base_ucs_ref = libredwg.dwg_dynapi_entity_data<number>(entity, 'base_ucs')
    const ucsBaseId = libredwg.dwg_ref_get_id(base_ucs_ref)
    // TODO: Not sure whether UCSORTHOVIEW represents orthographicType
    const orthographicType = libredwg.dwg_dynapi_entity_data<number>(entity, 'UCSORTHOVIEW')
    const elevation = libredwg.dwg_dynapi_entity_data<number>(entity, 'ucs_elevation')
    const shadePlotMode = libredwg.dwg_dynapi_entity_data<number>(entity, 'shadeplot_mode')
    const isDefaultLighting = libredwg.dwg_dynapi_entity_data<number>(entity, 'use_default_lights')
    const defaultLightingType = libredwg.dwg_dynapi_entity_data<number>(entity, 'default_lighting_type')
    const brightness = libredwg.dwg_dynapi_entity_data<number>(entity, 'brightness')
    const contrast = libredwg.dwg_dynapi_entity_data<number>(entity, 'contrast')

    const majorGridFrequency = libredwg.dwg_dynapi_entity_data<number>(entity, 'grid_major')
    const background_ref = libredwg.dwg_dynapi_entity_data<number>(entity, 'background')
    const backgroundId = libredwg.dwg_ref_get_id(background_ref)
    const shadeplot_ref = libredwg.dwg_dynapi_entity_data<number>(entity, 'shadeplot')
    const shadePlotId = libredwg.dwg_ref_get_id(shadeplot_ref)
    const visualstyle_ref = libredwg.dwg_dynapi_entity_data<number>(entity, 'visualstyle')
    const visualStyleId = libredwg.dwg_ref_get_id(visualstyle_ref)

    // TODO: convert ambientLightColor
    const sun_ref = libredwg.dwg_dynapi_entity_data<number>(entity, 'sun')
    const sunId = libredwg.dwg_ref_get_id(sun_ref)

    return {
      type: 'VIEWPORT',
      ...commonAttrs,
      viewportCenter: viewportCenter,
      width: width,
      height: height,
      status: status,
      viewportId: 0, // Will be set later in LibreDwgConverter.convert
      displayCenter: displayCenter,
      snapBase: snapBase,
      snapSpacing: snapSpacing,
      gridSpacing: gridSpacing,
      viewDirection: viewDirection,
      targetPoint: targetPoint,
      perspectiveLensLength: perspectiveLensLength,
      frontClipZ: frontClipZ,
      backClipZ: backClipZ,
      viewHeight: viewHeight,
      snapAngle: snapAngle,
      viewTwistAngle: viewTwistAngle,
      circleZoomPercent: circleZoomPercent,
      statusBitFlags: statusBitFlags,
      sheetName: sheetName,
      renderMode: renderMode,
      ucsPerViewport: ucsPerViewport,
      ucsOrigin: ucsOrigin,
      ucsXAxis: ucsXAxis,
      ucsYAxis: ucsYAxis,
      ucsId: ucsId ?? '',
      ucsBaseId: ucsBaseId ?? '',
      orthographicType: orthographicType,
      elevation: elevation,
      shadePlotMode: shadePlotMode,
      majorGridFrequency: majorGridFrequency,
      backgroundId: backgroundId ?? '',
      shadePlotId: shadePlotId ?? '',
      visualStyleId: visualStyleId ?? '',
      isDefaultLighting: !!isDefaultLighting,
      defaultLightingType: defaultLightingType,
      brightness: brightness,
      contrast: contrast,
      sunId: sunId ?? ''
    }
  }

  private convertWipeout(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgWipeoutEntity {
    const libredwg = this.libredwg
    const version = libredwg.dwg_dynapi_entity_data<number>(entity, 'class_version')
    const position = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'pt0')
    const uPixel = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'uvec')
    const vPixel = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'vvec')
    const imageSize = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(entity, 'image_size')
    const flags = libredwg.dwg_dynapi_entity_data<number>(entity, 'display_props')
    const clipping = libredwg.dwg_dynapi_entity_data<number>(entity, 'clipping')
    const brightness = libredwg.dwg_dynapi_entity_data<number>(entity, 'brightness')
    const contrast = libredwg.dwg_dynapi_entity_data<number>(entity, 'contrast')
    const fade = libredwg.dwg_dynapi_entity_data<number>(entity, 'fade')
    const clipMode = libredwg.dwg_dynapi_entity_data<number>(entity, 'clip_mode')
    const clippingBoundaryType = libredwg.dwg_dynapi_entity_data<number>(entity, 'clip_boundary_type')
    const countBoundaryPoints = libredwg.dwg_dynapi_entity_data<number>(entity, 'num_clip_verts')
    const clip_verts = libredwg.dwg_dynapi_entity_data<number>(entity, 'clip_verts')
    const clippingBoundaryPath = libredwg.dwg_ptr_to_point2d_array(
      clip_verts,
      countBoundaryPoints
    )

    const imagedef_ref = libredwg.dwg_dynapi_entity_data<number>(entity, 'imagedef')
    const imageDefHandle = libredwg.dwg_ref_get_absref(imagedef_ref) ?? 0
    const imagedefreactor_ref = libredwg.dwg_dynapi_entity_data<number>(entity, 'imagedefreactor')
    const imageDefReactorHandle =
      libredwg.dwg_ref_get_absref(imagedefreactor_ref) ?? 0

    return {
      type: 'WIPEOUT',
      ...commonAttrs,
      version: version,
      position: position,
      uPixel: uPixel,
      vPixel: vPixel,
      imageSize: imageSize,
      imageDefHandle: imageDefHandle,
      flags: flags as DwgImageFlags,
      clipping: clipping,
      brightness: brightness,
      contrast: contrast,
      fade: fade,
      imageDefReactorHandle: imageDefReactorHandle,
      clippingBoundaryType:
        clippingBoundaryType as DwgImageClippingBoundaryType,
      countBoundaryPoints: countBoundaryPoints,
      clippingBoundaryPath: clippingBoundaryPath,
      clipMode: clipMode
    }
  }

  private convertXline(
    entity: Dwg_Object_Entity_Ptr,
    commonAttrs: DwgCommonAttributes
  ): DwgXlineEntity {
    const libredwg = this.libredwg
    const firstPoint = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'point')
    const unitDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'vector')
    return {
      type: 'XLINE',
      ...commonAttrs,
      firstPoint: firstPoint,
      unitDirection: unitDirection
    }
  }

  private getDimensionCommonAttrs(
    entity: Dwg_Object_Entity_Ptr
  ): DwgDimensionCommonAttributes {
    const libredwg = this.libredwg
    const version = libredwg.dwg_dynapi_entity_data<number>(entity, 'class_version')
    const name = libredwg.dwg_entity_get_block_name(entity, 'block')
    const definitionPoint = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'def_pt')
    const textPoint = libredwg.dwg_dynapi_entity_data<DwgPoint2D>(entity, 'text_midpt')
    const attachmentPoint = libredwg.dwg_dynapi_entity_data<number>(entity, 'attachmentPoint')
    const dimensionType = libredwg.dwg_dynapi_entity_data<number>(entity, 'flag')
    const textLineSpacingStyle = libredwg.dwg_dynapi_entity_data<number>(entity, 'lspace_factor')
    const textLineSpacingFactor = libredwg.dwg_dynapi_entity_data<number>(entity, 'lspace_factor')
    const measurement = libredwg.dwg_dynapi_entity_data<number>(entity, 'act_measurement')
    const text = libredwg.dwg_dynapi_entity_data<string>(entity, 'user_text')
    const textRotation = libredwg.dwg_dynapi_entity_data<number>(entity, 'text_rotation')
    // TODO: Not sure whether 'ins_rotation' is 'ocsRotation'.
    const ocsRotation = libredwg.dwg_dynapi_entity_data<number>(entity, 'ins_rotation')
    const extrusionDirection = libredwg.dwg_dynapi_entity_data<DwgPoint3D>(entity, 'extrusion')
    const styleName = libredwg.dwg_entity_get_dimstyle_name(entity)

    return {
      type: 'DIMENSION',
      version: version,
      name: name,
      definitionPoint: definitionPoint,
      textPoint: textPoint,
      dimensionType: dimensionType as DwgDimensionType,
      attachmentPoint: attachmentPoint as DwgAttachmentPoint,
      textLineSpacingStyle: textLineSpacingStyle as DwgDimensionTextLineSpacing,
      textLineSpacingFactor: textLineSpacingFactor || 1,
      measurement: measurement,
      text: text,
      textRotation: textRotation,
      ocsRotation: ocsRotation,
      extrusionDirection: extrusionDirection,
      styleName: styleName
    }
  }

  private getCommonAttrs(entity: Dwg_Object_Entity_Ptr): DwgCommonAttributes {
    const libredwg = this.libredwg
    const color = libredwg.dwg_object_entity_get_color_object(entity)
    // - 0xc0 for ByLayer (also c3 and rgb of 0x100)
    // - 0xc1 for ByBlock (also c3 and rgb of 0)
    // - 0xc2 for entities (default), with names with an additional name flag RC
    // - 0xc3 for truecolor
    // - 0xc5 for foreground color
    // - 0xc8 for none (also c3 and rgb of 0x101)
    const method = color.method
    const colorIndex = color.index
    let rgbColor = undefined
    if (method == 0xc2 || ((color.rgb >>> 24) & 0xff) === 0xc2) {
      rgbColor = color.rgb & 0x00ffffff
    }

    const layer = this.getLayerName(entity)
    const handle = libredwg.dwg_object_entity_get_handle_object(entity)
    const ownerhandle =
      libredwg.dwg_object_entity_get_ownerhandle_object(entity)
    const ownerDictionaryHardId =
      libredwg.dwg_object_entity_get_xdicobjhandle_object(entity)
    const lineType = this.getLtypeName(entity)
    const lineweight = libredwg.dwg_object_entity_get_line_weight(entity)
    const lineTypeScale = libredwg.dwg_object_entity_get_ltype_scale(entity)
    const isVisible = !libredwg.dwg_object_entity_get_invisible(entity)
    const xdata = libredwg.dwg_object_entity_get_xdata(entity)

    return {
      handle: idToString(handle.value),
      ownerDictionaryHardId: idToString(ownerDictionaryHardId.absolute_ref),
      ownerBlockRecordSoftId: idToString(ownerhandle.absolute_ref),
      layer: layer,
      color: rgbColor,
      colorIndex: colorIndex,
      colorName: color.name,
      lineType: lineType,
      lineweight: lineweight,
      lineTypeScale: lineTypeScale,
      isVisible: isVisible,
      transparency: color.alpha,
      transparencyType: color.alpha_type,
      xdata: xdata
    }
  }

  private getLayerName(entity: Dwg_Object_Entity_Ptr) {
    const libredwg = this.libredwg
    const layer = libredwg.dwg_object_entity_get_layer_object_ref(entity)
    const name = this.layers.get(idToString(layer.handleref.value))
    return name ?? '0'
  }

  private getLtypeName(entity: Dwg_Object_Entity_Ptr) {
    const libredwg = this.libredwg
    const ltype = libredwg.dwg_object_entity_get_ltype_object_ref(entity)
    const name = this.ltypes.get(idToString(ltype.handleref.value))
    return name ?? ''
  }
}
