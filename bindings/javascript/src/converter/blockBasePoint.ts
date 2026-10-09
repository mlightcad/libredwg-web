import type {
  Dwg3dFaceEntity,
  DwgArcEntity,
  DwgAttribEntity,
  DwgAttdefEntity,
  DwgCircleEntity,
  DwgEllipseEntity,
  DwgEntity,
  DwgHatchEntity,
  DwgInsertEntity,
  DwgLineEntity,
  DwgLWPolylineEntity,
  DwgMTextEntity,
  DwgPoint2D,
  DwgPoint3D,
  DwgPointEntity,
  DwgPolyline2dEntity,
  DwgPolyline3dEntity,
  DwgSolidEntity,
  DwgSplineEntity,
  DwgTextEntity
} from '../database'

const ORIGIN_EPS = 1e-9
/** Geometry this far from the origin is treated as "not authored at 0,0". */
const MIN_ORIGIN_GAP = 1e5
/** Origin must also sit several bbox-diagonals away, so compact near-origin blocks stay at 0,0. */
const MIN_GAP_TO_SIZE = 4

export const isOriginPoint = (
  point: DwgPoint2D | DwgPoint3D | null | undefined
): boolean => {
  if (!point) {
    return true
  }
  const z = 'z' in point ? (point.z ?? 0) : 0
  return (
    Math.abs(point.x) <= ORIGIN_EPS &&
    Math.abs(point.y) <= ORIGIN_EPS &&
    Math.abs(z) <= ORIGIN_EPS
  )
}

const distanceFromOriginToAabb = (
  min: DwgPoint2D,
  max: DwgPoint2D
): number => {
  const dx = min.x > 0 ? min.x : max.x < 0 ? -max.x : 0
  const dy = min.y > 0 ? min.y : max.y < 0 ? -max.y : 0
  return Math.hypot(dx, dy)
}

const addPoint = (
  points: DwgPoint3D[],
  point: { x?: number; y?: number; z?: number } | null | undefined
) => {
  if (
    point &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y)
  ) {
    points.push({
      x: point.x as number,
      y: point.y as number,
      z: Number.isFinite(point.z) ? (point.z as number) : 0
    })
  }
}

const collectEntityPoints = (entity: DwgEntity, points: DwgPoint3D[]) => {
  switch (entity.type) {
    case 'LINE': {
      const line = entity as DwgLineEntity
      addPoint(points, line.startPoint)
      addPoint(points, line.endPoint)
      break
    }
    case 'POINT':
      addPoint(points, (entity as DwgPointEntity).position)
      break
    case 'CIRCLE': {
      const circle = entity as DwgCircleEntity
      addPoint(points, circle.center)
      if (circle.center && Number.isFinite(circle.radius)) {
        addPoint(points, {
          x: circle.center.x - circle.radius,
          y: circle.center.y - circle.radius,
          z: circle.center.z
        })
        addPoint(points, {
          x: circle.center.x + circle.radius,
          y: circle.center.y + circle.radius,
          z: circle.center.z
        })
      }
      break
    }
    case 'ARC':
      addPoint(points, (entity as DwgArcEntity).center)
      break
    case 'ELLIPSE':
      addPoint(points, (entity as DwgEllipseEntity).center)
      break
    case 'INSERT':
      addPoint(points, (entity as DwgInsertEntity).insertionPoint)
      break
    case 'TEXT':
      addPoint(points, (entity as DwgTextEntity).startPoint)
      break
    case 'ATTRIB':
      addPoint(points, (entity as DwgAttribEntity).text?.startPoint)
      break
    case 'ATTDEF':
      addPoint(points, (entity as DwgAttdefEntity).text?.startPoint)
      break
    case 'MTEXT':
      addPoint(points, (entity as DwgMTextEntity).insertionPoint)
      break
    case 'LWPOLYLINE':
      for (const vertex of (entity as DwgLWPolylineEntity).vertices ?? []) {
        addPoint(points, vertex)
      }
      break
    case 'POLYLINE':
    case 'POLYLINE2D':
      for (const vertex of (entity as DwgPolyline2dEntity).vertices ?? []) {
        addPoint(points, vertex)
      }
      break
    case 'POLYLINE3D':
      for (const vertex of (entity as DwgPolyline3dEntity).vertices ?? []) {
        addPoint(points, vertex)
      }
      break
    case 'SPLINE': {
      const spline = entity as DwgSplineEntity
      for (const vertex of spline.fitPoints ?? []) {
        addPoint(points, vertex)
      }
      for (const vertex of spline.controlPoints ?? []) {
        addPoint(points, vertex)
      }
      break
    }
    case 'SOLID':
    case 'TRACE': {
      const solid = entity as DwgSolidEntity
      addPoint(points, solid.corner1)
      addPoint(points, solid.corner2)
      addPoint(points, solid.corner3)
      addPoint(points, solid.corner4)
      break
    }
    case '3DFACE': {
      const face = entity as Dwg3dFaceEntity
      addPoint(points, face.corner1)
      addPoint(points, face.corner2)
      addPoint(points, face.corner3)
      addPoint(points, face.corner4)
      break
    }
    case 'HATCH': {
      const hatch = entity as DwgHatchEntity
      for (const path of hatch.boundaryPaths ?? []) {
        if ('vertices' in path) {
          for (const vertex of path.vertices ?? []) {
            addPoint(points, vertex)
          }
        }
        if ('edges' in path) {
          for (const edge of path.edges ?? []) {
            if ('start' in edge) {
              addPoint(points, edge.start)
              addPoint(points, edge.end)
            }
            if ('center' in edge) {
              addPoint(points, edge.center)
            }
            if ('controlPoints' in edge) {
              for (const vertex of edge.controlPoints ?? []) {
                addPoint(points, vertex)
              }
            }
          }
        }
      }
      break
    }
    default:
      break
  }
}

/**
 * When a BLOCK reports origin as its base point but its geometry lives far
 * away, recover the authored origin as the geometry bbox minimum. AutoCAD
 * stores that origin on BLOCK_HEADER.base_pt; some DWGs leave it at (0,0)
 * while still expecting INSERT to rotate about the geometry (GH #26).
 */
export const inferBlockBasePointFromEntities = (
  entities: DwgEntity[]
): DwgPoint3D | null => {
  const points: DwgPoint3D[] = []
  for (const entity of entities) {
    collectEntityPoints(entity, points)
  }
  if (!points.length) {
    return null
  }

  const min = { x: Infinity, y: Infinity, z: Infinity }
  const max = { x: -Infinity, y: -Infinity, z: -Infinity }
  for (const point of points) {
    min.x = Math.min(min.x, point.x)
    min.y = Math.min(min.y, point.y)
    min.z = Math.min(min.z, point.z)
    max.x = Math.max(max.x, point.x)
    max.y = Math.max(max.y, point.y)
    max.z = Math.max(max.z, point.z)
  }

  const gap = distanceFromOriginToAabb(min, max)
  const size = Math.hypot(max.x - min.x, max.y - min.y)
  if (gap > MIN_ORIGIN_GAP && gap > MIN_GAP_TO_SIZE * Math.max(size, 1)) {
    return min
  }
  return null
}

export const resolveBlockBasePoint = (opts: {
  headerBase?: DwgPoint2D | DwgPoint3D | null
  blockEntityBase?: DwgPoint2D | DwgPoint3D | null
  entities: DwgEntity[]
  blockName?: string
}): DwgPoint3D => {
  const to3d = (
    point: DwgPoint2D | DwgPoint3D | null | undefined
  ): DwgPoint3D => ({
    x: point?.x ?? 0,
    y: point?.y ?? 0,
    z: point && 'z' in point && point.z != null ? point.z : 0
  })

  if (!isOriginPoint(opts.headerBase)) {
    return to3d(opts.headerBase)
  }
  if (!isOriginPoint(opts.blockEntityBase)) {
    return to3d(opts.blockEntityBase)
  }
  const name = opts.blockName?.toUpperCase() ?? ''
  if (name === '*MODEL_SPACE' || name.startsWith('*PAPER_SPACE')) {
    return { x: 0, y: 0, z: 0 }
  }
  return inferBlockBasePointFromEntities(opts.entities) ?? { x: 0, y: 0, z: 0 }
}
