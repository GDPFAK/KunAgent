/**
 * Constraint engine: when a frame is resized, reposition/resize its direct
 * children according to their `constraints` (left / right / left-right / center /
 * scale on each axis) — the same model Figma/Penpot use for responsive frames.
 *
 * Pure and side-effect free: given a child's box, the frame's old box and its
 * new box, return the child's new box. The executor applies the result through
 * the normal `updateShape` path. Children without constraints are left untouched
 * by the caller (this returns null for them).
 */
import type { CanvasShape, HConstraint, Rect, VConstraint } from './canvas-types'

export type ConstraintBox = { x: number; y: number; width: number; height: number }

function resolveAxis(
  mode: HConstraint | VConstraint,
  childStart: number,
  childSize: number,
  oldStart: number,
  oldSize: number,
  newStart: number,
  newSize: number
): { start: number; size: number } {
  const leadGap = childStart - oldStart
  const trailGap = oldStart + oldSize - (childStart + childSize)
  switch (mode) {
    case 'left':
    case 'top':
      return { start: newStart + leadGap, size: childSize }
    case 'right':
    case 'bottom':
      return { start: newStart + newSize - trailGap - childSize, size: childSize }
    case 'left-right':
    case 'top-bottom':
      return { start: newStart + leadGap, size: Math.max(1, newSize - leadGap - trailGap) }
    case 'center': {
      const childCenter = childStart + childSize / 2
      const oldCenter = oldStart + oldSize / 2
      const newCenter = newStart + newSize / 2
      return { start: newCenter + (childCenter - oldCenter) - childSize / 2, size: childSize }
    }
    case 'scale': {
      const ratio = oldSize === 0 ? 1 : newSize / oldSize
      return { start: newStart + leadGap * ratio, size: childSize * ratio }
    }
    default:
      return { start: childStart, size: childSize }
  }
}

/**
 * New box for a child given the frame's resize. `h` defaults to `left`, `v` to
 * `top` (the classic "stick to top-left" behaviour) when not specified.
 */
export function constrainedBox(
  child: ConstraintBox & { constraints?: CanvasShape['constraints'] },
  oldFrame: Rect,
  newFrame: Rect
): ConstraintBox {
  const h = child.constraints?.h ?? 'left'
  const v = child.constraints?.v ?? 'top'
  const hx = resolveAxis(h, child.x, child.width, oldFrame.x, oldFrame.width, newFrame.x, newFrame.width)
  const vy = resolveAxis(v, child.y, child.height, oldFrame.y, oldFrame.height, newFrame.y, newFrame.height)
  return {
    x: round(hx.start),
    y: round(vy.start),
    width: round(hx.size),
    height: round(vy.size)
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
