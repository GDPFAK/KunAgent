import type { Point, Rect } from '../canvas-types'

export const FREEHAND_SIMPLIFY_TOLERANCE = 1.5
export const FREEHAND_MAX_POINTS = 240

export type NormalizedFreehandPoints = Rect & { points: Point[] }

function clonePoint(point: Point): Point {
  return { x: point.x, y: point.y }
}

function squaredDistanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) {
    return (point.x - start.x) ** 2 + (point.y - start.y) ** 2
  }
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)))
  const x = start.x + dx * t
  const y = start.y + dy * t
  return (point.x - x) ** 2 + (point.y - y) ** 2
}

function removeConsecutiveDuplicates(points: readonly Point[]): Point[] {
  const out: Point[] = []
  for (const point of points) {
    const prev = out[out.length - 1]
    if (!prev || prev.x !== point.x || prev.y !== point.y) out.push(clonePoint(point))
  }
  return out
}

function simplifyRdp(points: readonly Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points.map(clonePoint)
  const toleranceSq = Math.max(0, tolerance) ** 2
  const keep = new Array<boolean>(points.length).fill(false)
  keep[0] = true
  keep[points.length - 1] = true
  const stack: Array<[number, number]> = [[0, points.length - 1]]

  while (stack.length > 0) {
    const [first, last] = stack.pop()!
    let maxDistance = 0
    let maxIndex = -1
    for (let index = first + 1; index < last; index += 1) {
      const distance = squaredDistanceToSegment(points[index], points[first], points[last])
      if (distance > maxDistance) {
        maxDistance = distance
        maxIndex = index
      }
    }
    if (maxIndex !== -1 && maxDistance > toleranceSq) {
      keep[maxIndex] = true
      stack.push([first, maxIndex], [maxIndex, last])
    }
  }

  return points.filter((_, index) => keep[index]).map(clonePoint)
}

function capPoints(points: readonly Point[], maxPoints: number): Point[] {
  const max = Math.max(2, Math.floor(maxPoints))
  if (points.length <= max) return points.map(clonePoint)
  const out: Point[] = []
  let lastIndex = -1
  for (let i = 0; i < max; i += 1) {
    const index = Math.round((i * (points.length - 1)) / (max - 1))
    if (index !== lastIndex) {
      out.push(clonePoint(points[index]))
      lastIndex = index
    }
  }
  return out
}

export function simplifyFreehandPoints(
  points: readonly Point[],
  options: { tolerance?: number; maxPoints?: number } = {}
): Point[] {
  const compact = removeConsecutiveDuplicates(points)
  const simplified = simplifyRdp(compact, options.tolerance ?? FREEHAND_SIMPLIFY_TOLERANCE)
  return capPoints(simplified, options.maxPoints ?? FREEHAND_MAX_POINTS)
}

export function normalizeFreehandPoints(points: readonly Point[]): NormalizedFreehandPoints | null {
  if (points.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of points) {
    if (point.x < minX) minX = point.x
    if (point.y < minY) minY = point.y
    if (point.x > maxX) maxX = point.x
    if (point.y > maxY) maxY = point.y
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    points: points.map((point) => ({ x: point.x - minX, y: point.y - minY }))
  }
}
