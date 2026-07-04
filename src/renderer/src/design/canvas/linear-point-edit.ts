import type { CanvasShape, Point } from './canvas-types'

export type LinearPointPatch = {
  x: number
  y: number
  width: number
  height: number
  points: Point[]
}

export function snapshotLinearPoints(shape: CanvasShape): LinearPointPatch {
  return {
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
    points: (shape.points ?? []).map((p) => ({ x: p.x, y: p.y }))
  }
}

export function absoluteLinearPoints(shape: CanvasShape): Point[] {
  return (shape.points ?? []).map((p) => ({ x: shape.x + p.x, y: shape.y + p.y }))
}

/** Recompute axis-aligned bbox + points relative to that bbox, given absolute coords. */
export function normalizeAbsoluteLinearPoints(abs: readonly Point[]): LinearPointPatch | null {
  if (abs.length < 2) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of abs) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    points: abs.map((p) => ({ x: p.x - minX, y: p.y - minY }))
  }
}

export function removeLinearPoint(shape: CanvasShape, index: number): LinearPointPatch | null {
  const abs = absoluteLinearPoints(shape)
  if (abs.length <= 2 || index < 0 || index >= abs.length) return null
  return normalizeAbsoluteLinearPoints(abs.filter((_, i) => i !== index))
}
