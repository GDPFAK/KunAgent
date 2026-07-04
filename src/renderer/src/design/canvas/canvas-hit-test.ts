import type { CanvasDocument, CanvasShape, Point, Rect } from './canvas-types'
import { pointInPolygon, shapeGeometry } from './canvas-types'
import { isShapeEditable } from './canvas-editability'

/** Shortest distance from point (px,py) to a line segment (a→b). */
function distanceToSegment(px: number, py: number, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - a.x, py - a.y)
  let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy))
}

function distanceToPolyline(px: number, py: number, points: Point[]): number {
  let min = Infinity
  for (let i = 0; i < points.length - 1; i++) {
    const d = distanceToSegment(px, py, points[i], points[i + 1])
    if (d < min) min = d
  }
  return min
}

function shapeHits(shape: CanvasShape, px: number, py: number): boolean {
  if (!shape.visible || shape.locked) return false
  const geom = shapeGeometry(shape)
  const s = geom.selrect

  // Linear shapes (arrow/line/draw): hit by proximity to the stroke, not the
  // bbox — a thin diagonal or freehand stroke otherwise grabs its whole box.
  const pts = shape.points
  if (pts && pts.length >= 2) {
    const tol = Math.max(8, (shape.strokes[0]?.width ?? 2) + 6)
    if (px < s.x - tol || px > s.x + s.width + tol || py < s.y - tol || py > s.y + s.height + tol) {
      return false
    }
    return distanceToPolyline(px - shape.x, py - shape.y, pts) <= tol
  }

  // selrect early-out (axis-aligned coarse filter)
  if (px < s.x || px > s.x + s.width || py < s.y || py > s.y + s.height) return false
  // For unrotated shapes the selrect IS the shape — the coarse check above was exact.
  if (!shape.rotation) return true
  return pointInPolygon(px, py, geom.points)
}

function hitTestChildren(
  doc: CanvasDocument,
  objects: Record<string, CanvasShape>,
  parentId: string,
  px: number,
  py: number
): string | null {
  const parent = objects[parentId]
  if (!parent) return null

  for (let i = parent.children.length - 1; i >= 0; i--) {
    const childId = parent.children[i]
    const child = objects[childId]
    if (!child || !isShapeEditable(doc, childId)) continue

    if (child.children.length > 0) {
      const deepHit = hitTestChildren(doc, objects, childId, px, py)
      if (deepHit) return deepHit
    }

    if (shapeHits(child, px, py)) return childId
  }

  return null
}

export function hitTest(doc: CanvasDocument, px: number, py: number): string | null {
  return hitTestChildren(doc, doc.objects, doc.rootId, px, py)
}

function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x + a.width >= b.x &&
    a.x <= b.x + b.width &&
    a.y + a.height >= b.y &&
    a.y <= b.y + b.height
  )
}

export function hitTestAll(doc: CanvasDocument, rect: Rect): string[] {
  const result: string[] = []
  const { objects, rootId } = doc

  function walk(parentId: string): void {
    const parent = objects[parentId]
    if (!parent) return
    for (const childId of parent.children) {
      const child = objects[childId]
      if (!child || childId === rootId || !isShapeEditable(doc, childId)) continue
      const geom = shapeGeometry(child)
      if (rectsIntersect(geom.selrect, rect)) {
        result.push(childId)
      }
      if (child.children.length > 0) walk(childId)
    }
  }

  walk(rootId)
  return result
}

export function getSelectionBounds(
  objects: Record<string, CanvasShape>,
  ids: Set<string>
): Rect | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let found = false

  for (const id of ids) {
    const shape = objects[id]
    if (!shape) continue
    found = true
    // Use the rotated bounding box so a multi-select around a rotated rect
    // reports the actual visual extent.
    const sel = shapeGeometry(shape).selrect
    if (sel.x < minX) minX = sel.x
    if (sel.y < minY) minY = sel.y
    if (sel.x + sel.width > maxX) maxX = sel.x + sel.width
    if (sel.y + sel.height > maxY) maxY = sel.y + sel.height
  }

  if (!found) return null
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
