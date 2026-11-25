import { DwgPoint3D } from '../common.js'
import { DwgCommonObject } from './common.js'

/**
 * Reference from an associative action (or network) to a dependency (or an
 * action). `isOwned` is true for a hard-owner pointer (DXF 360) and false for
 * a soft pointer (DXF 330).
 */
export interface DwgAssocHandleRef {
  handle: string
  isOwned: boolean
}

/**
 * One value of an action value parameter (`AcDbEvalVariant`). `code` is the
 * DXF group code of the value (40 real, 90 int32, ...); `value` is `null`
 * when the value kind is not decoded (strings, points, handles).
 */
export interface DwgAssocValue {
  code: number
  value: number | string | null
  /** Handle of an `AcDbAssocVariable` driving the value, or '0'. */
  variableHandle: string
}

/** Named value parameter of an associative action (`AcDbValueParam`). */
export interface DwgAssocValueParam {
  classVersion: number
  name: string
  /** 0 unitless, 1 distance, 2 angle, 4 area, 8 volume. */
  unitType: number
  values: DwgAssocValue[]
  controlledObjectDependencyHandle: string
}

/** Fields shared by ACDBASSOCACTION and ACDBASSOCNETWORK (`AcDbAssocAction`). */
export interface DwgAssocActionObject extends DwgCommonObject {
  classVersion: number
  /** `AcDbAssocStatus` (DXF: second 90 of AcDbAssocAction). */
  status: number
  owningNetworkHandle: string
  actionBodyHandle: string
  actionIndex: number
  maxDependencyIndex: number
  dependencies: DwgAssocHandleRef[]
  ownedParamHandles: string[]
  valueParams: DwgAssocValueParam[]
}

/** ACDBASSOCNETWORK (`AcDbAssocNetwork`). */
export interface DwgAssocNetworkObject extends DwgAssocActionObject {
  networkVersion: number
  maxActionIndex: number
  actions: DwgAssocHandleRef[]
  ownedActionHandles: string[]
}

/** ACDBASSOCDEPENDENCY (`AcDbAssocDependency`). */
export interface DwgAssocDependencyObject extends DwgCommonObject {
  classVersion: number
  status: number
  isReadDependency: boolean
  isWriteDependency: boolean
  isAttachedToObject: boolean
  isDelegatingToOwningAction: boolean
  /** Evaluation order; -2147483648 for an associative array's INSERT. */
  order: number
  name: string
  /** Object this dependency depends on (DXF 330). */
  dependentOnHandle: string
  /** Previous dependency on the same object (DXF 330). */
  prevDependencyHandle: string
  /** Next dependency on the same object (DXF 330). */
  nextDependencyHandle: string
  dependencyBodyHandle: string
  /** Index assigned by the owning action (DXF trailing 90). */
  dependencyIndex: number
}

/** One item of an associative array (`AcDbAssocArrayItem`). */
export interface DwgAssocArrayItem {
  classVersion: number
  itemIndex: number
  rowIndex: number
  levelIndex: number
  flags: number
  /** Row-major 4x4 transform (source block → array block). */
  matrix: number[]
  /**
   * Row-major 4x4 relative transform of an individually edited item
   * (present when `flags & 2`).
   */
  relativeMatrix?: number[]
  /** Second entity handle (present when `flags & 0x10`). */
  secondaryEntityHandle?: string
  /** Item INSERT inside the array block. */
  entityHandle: string
}

/** ACDBASSOCARRAYACTIONBODY (`AcDbAssocArrayActionBody`). */
export interface DwgAssocArrayActionBodyObject extends DwgCommonObject {
  actionBodyVersion: number
  classVersion: number
  /** e.g. `AcDbAssocArrayRectangularParameters`. */
  parametersClassName: string
  parametersVersion: number
  items: DwgAssocArrayItem[]
  /** Row-major 4x4 transform of the array INSERT at the last evaluation. */
  arrayTransform: number[]
}

/** Fields shared by assoc action parameters with one dependency. */
export interface DwgAssocActionParamObject extends DwgCommonObject {
  /** First 90 of AcDbAssocActionParam (1 since R2013). */
  classVersion: number
  /** Second 90 of AcDbAssocActionParam. */
  paramVersion: number
  name: string
  singleDependencyVersion: number
  dependencyHandle: string
}

/** ACDBASSOCVERTEXACTIONPARAM (`AcDbAssocVertexActionParam`). */
export interface DwgAssocVertexActionParamObject
  extends DwgAssocActionParamObject {
  vertexVersion: number
  point: DwgPoint3D
}

/**
 * ACDBASSOCEDGEACTIONPARAM (`AcDbAssocEdgeActionParam`). The cached curve
 * geometry is not decoded.
 */
export interface DwgAssocEdgeActionParamObject
  extends DwgAssocActionParamObject {
  edgeVersion: number
  hasCachedCurve: boolean
  /** AcGe entity id of the cached curve (47 composite, 23 line segment, ...). */
  curveType: number
}
