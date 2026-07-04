/**
 * Flex-style auto-layout engine. Given a frame/group carrying an `AutoLayout`
 * config, compute new ABSOLUTE positions for its direct children laid out in a
 * row or column with consistent gap + padding. Pure and side-effect free so it
 * unit-tests cleanly; the executor applies the returned positions through the
 * normal `updateShape` path (so undo/redo and persistence keep working).
 *
 * Children keep their own width/height — only x/y are written. This mirrors how
 * Figma/Penpot auto-layout "hug/fill" without us having to grow children.
 */
import type { AutoLayout, CanvasShape } from './canvas-types'

export type LayoutPosition = { id: string; x: number; y: number }

function laidOutChildren(
  objects: Record<string, CanvasShape>,
  frame: CanvasShape
): CanvasShape[] {
  return frame.children
    .map((id) => objects[id])
    .filter((c): c is CanvasShape => Boolean(c) && c.visible !== false)
}

/**
 * Compute positions for the direct children of `frameId` per its `layout`.
 * Returns an empty list when the shape has no layout or no visible children.
 */
export function computeAutoLayout(
  objects: Record<string, CanvasShape>,
  frameId: string
): LayoutPosition[] {
  const frame = objects[frameId]
  if (!frame?.layout) return []
  const layout = frame.layout
  const children = laidOutChildren(objects, frame)
  if (children.length === 0) return []

  const innerX = frame.x + layout.paddingLeft
  const innerY = frame.y + layout.paddingTop
  const innerW = Math.max(0, frame.width - layout.paddingLeft - layout.paddingRight)
  const innerH = Math.max(0, frame.height - layout.paddingTop - layout.paddingBottom)

  const horizontal = layout.direction === 'horizontal'
  const mainSize = (c: CanvasShape): number => (horizontal ? c.width : c.height)
  const crossSize = (c: CanvasShape): number => (horizontal ? c.height : c.width)
  const mainExtent = horizontal ? innerW : innerH
  const crossExtent = horizontal ? innerH : innerW

  const sumMain = children.reduce((acc, c) => acc + mainSize(c), 0)
  const n = children.length
  const primaryAlign = layout.primaryAlign ?? 'start'
  const counterAlign = layout.counterAlign ?? 'start'

  // Effective gap + leading offset along the main axis.
  let gap = layout.gap
  let cursor = 0
  const totalWithGaps = sumMain + layout.gap * (n - 1)
  if (primaryAlign === 'space-between' && n > 1) {
    gap = (mainExtent - sumMain) / (n - 1)
    cursor = 0
  } else if (primaryAlign === 'center') {
    cursor = (mainExtent - totalWithGaps) / 2
  } else if (primaryAlign === 'end') {
    cursor = mainExtent - totalWithGaps
  }

  const positions: LayoutPosition[] = []
  for (const c of children) {
    // Cross-axis placement of this child within the inner box.
    let cross = 0
    if (counterAlign === 'center') cross = (crossExtent - crossSize(c)) / 2
    else if (counterAlign === 'end') cross = crossExtent - crossSize(c)

    const main = cursor
    const x = horizontal ? innerX + main : innerX + cross
    const y = horizontal ? innerY + cross : innerY + main
    positions.push({ id: c.id, x: round(x), y: round(y) })
    cursor += mainSize(c) + gap
  }
  return positions
}

/**
 * Sensible default layout (vertical stack, 12px gap, 16px padding). The
 * `auto-layout` op merges any caller-supplied fields over this so partial
 * specs still produce a valid layout.
 */
export function defaultAutoLayout(): AutoLayout {
  return {
    direction: 'vertical',
    gap: 12,
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 16,
    paddingLeft: 16,
    primaryAlign: 'start',
    counterAlign: 'start'
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
