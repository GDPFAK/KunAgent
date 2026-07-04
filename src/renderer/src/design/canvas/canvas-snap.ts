import type { Rect } from './canvas-types'
import type { ResizeHandle } from './canvas-resize'

export type SnapAxis = 'h' | 'v'

export type SnapGuide = {
  axis: SnapAxis
  /** Position in canvas-space along the perpendicular axis (e.g. axis='v' → x). */
  position: number
  /** Source: 'edge' (matched another shape's edge), 'center' (matched another's center), 'grid'. */
  source: 'edge' | 'center' | 'grid'
}

export type SnapResult = {
  /** dx/dy to apply ON TOP of the user-provided delta to fall into snap. */
  dx: number
  dy: number
  guides: SnapGuide[]
}

export type ResizeSnapResult = {
  bounds: Rect
  guides: SnapGuide[]
}

const SNAP_THRESHOLD_PX = 8

/**
 * Find horizontal/vertical snap for the moving bounds against the static set.
 * - h-axis guides come from comparing `moving`'s left/h-center/right with each static's left/h-center/right
 * - v-axis guides come from top/v-center/bottom
 * - When `gridSize` is provided, also try snapping each of the 3 candidates per axis to the grid
 *
 * Returns dx/dy such that `moving.x + dx` and `moving.y + dy` are the snapped position.
 */
export function findSnaps(
  moving: Rect,
  statics: Rect[],
  zoom: number,
  gridSize: number | null = null
): SnapResult {
  const threshold = SNAP_THRESHOLD_PX / Math.max(zoom, 0.01)
  const result: SnapResult = { dx: 0, dy: 0, guides: [] }

  const movingHCandidates = [
    { offset: 0, x: moving.x }, // left
    { offset: moving.width / 2, x: moving.x + moving.width / 2 }, // h-center
    { offset: moving.width, x: moving.x + moving.width } // right
  ]
  const movingVCandidates = [
    { offset: 0, y: moving.y },
    { offset: moving.height / 2, y: moving.y + moving.height / 2 },
    { offset: moving.height, y: moving.y + moving.height }
  ]

  // Vertical guides (constant-x lines) — match moving's left/center/right against statics
  let bestVDx = 0
  let bestVDist = threshold
  const matchedVPositions = new Map<number, 'edge' | 'center' | 'grid'>()

  for (const cand of movingHCandidates) {
    // Against statics
    for (const s of statics) {
      const targets: Array<{ pos: number; source: 'edge' | 'center' }> = [
        { pos: s.x, source: 'edge' },
        { pos: s.x + s.width / 2, source: 'center' },
        { pos: s.x + s.width, source: 'edge' }
      ]
      for (const t of targets) {
        const dx = t.pos - cand.x
        const adx = Math.abs(dx)
        if (adx < bestVDist) {
          bestVDist = adx
          bestVDx = dx
        }
        if (adx <= threshold) {
          matchedVPositions.set(t.pos, t.source)
        }
      }
    }
    // Against grid
    if (gridSize && gridSize > 0) {
      const nearest = Math.round(cand.x / gridSize) * gridSize
      const dx = nearest - cand.x
      const adx = Math.abs(dx)
      if (adx < bestVDist) {
        bestVDist = adx
        bestVDx = dx
      }
      if (adx <= threshold) {
        matchedVPositions.set(nearest, 'grid')
      }
    }
  }

  // Horizontal guides (constant-y lines)
  let bestHDy = 0
  let bestHDist = threshold
  const matchedHPositions = new Map<number, 'edge' | 'center' | 'grid'>()

  for (const cand of movingVCandidates) {
    for (const s of statics) {
      const targets: Array<{ pos: number; source: 'edge' | 'center' }> = [
        { pos: s.y, source: 'edge' },
        { pos: s.y + s.height / 2, source: 'center' },
        { pos: s.y + s.height, source: 'edge' }
      ]
      for (const t of targets) {
        const dy = t.pos - cand.y
        const ady = Math.abs(dy)
        if (ady < bestHDist) {
          bestHDist = ady
          bestHDy = dy
        }
        if (ady <= threshold) {
          matchedHPositions.set(t.pos, t.source)
        }
      }
    }
    if (gridSize && gridSize > 0) {
      const nearest = Math.round(cand.y / gridSize) * gridSize
      const dy = nearest - cand.y
      const ady = Math.abs(dy)
      if (ady < bestHDist) {
        bestHDist = ady
        bestHDy = dy
      }
      if (ady <= threshold) {
        matchedHPositions.set(nearest, 'grid')
      }
    }
  }

  result.dx = bestVDx
  result.dy = bestHDy

  // Emit guides only for the lines that align after applying the snap
  if (bestVDx !== 0 || bestVDist < threshold) {
    for (const [pos, source] of matchedVPositions) {
      // Only keep guides that the snap actually aligns to (within 0.5px)
      const aligns = movingHCandidates.some(
        (c) => Math.abs(c.x + bestVDx - pos) < 0.5
      )
      if (aligns) result.guides.push({ axis: 'v', position: pos, source })
    }
  }
  if (bestHDy !== 0 || bestHDist < threshold) {
    for (const [pos, source] of matchedHPositions) {
      const aligns = movingVCandidates.some(
        (c) => Math.abs(c.y + bestHDy - pos) < 0.5
      )
      if (aligns) result.guides.push({ axis: 'h', position: pos, source })
    }
  }

  return result
}

function targetsForAxis(
  statics: Rect[],
  axis: SnapAxis
): Array<{ pos: number; source: 'edge' | 'center' | 'grid' }> {
  const targets: Array<{ pos: number; source: 'edge' | 'center' | 'grid' }> = []
  for (const s of statics) {
    if (axis === 'v') {
      targets.push(
        { pos: s.x, source: 'edge' },
        { pos: s.x + s.width / 2, source: 'center' },
        { pos: s.x + s.width, source: 'edge' }
      )
    } else {
      targets.push(
        { pos: s.y, source: 'edge' },
        { pos: s.y + s.height / 2, source: 'center' },
        { pos: s.y + s.height, source: 'edge' }
      )
    }
  }
  return targets
}

function nearestGridTarget(pos: number, gridSize: number | null): { pos: number; source: 'grid' } | null {
  if (!gridSize || gridSize <= 0) return null
  return { pos: Math.round(pos / gridSize) * gridSize, source: 'grid' }
}

function bestSnapForPosition(
  pos: number,
  axis: SnapAxis,
  targets: Array<{ pos: number; source: 'edge' | 'center' | 'grid' }>,
  threshold: number
): { delta: number; guide: SnapGuide } | null {
  let best: { delta: number; guide: SnapGuide; dist: number } | null = null
  for (const target of targets) {
    const delta = target.pos - pos
    const dist = Math.abs(delta)
    if (dist > threshold) continue
    if (!best || dist < best.dist) {
      best = {
        delta,
        dist,
        guide: { axis, position: target.pos, source: target.source }
      }
    }
  }
  return best ? { delta: best.delta, guide: best.guide } : null
}

/**
 * Snap a resized selection bbox by moving only the handle-controlled edge(s).
 * Unlike move-snapping, this must not translate the whole rect: east/west
 * handles alter width/x, north/south handles alter height/y.
 */
export function findResizeSnaps(
  bounds: Rect,
  handle: ResizeHandle,
  statics: Rect[],
  zoom: number,
  gridSize: number | null = null
): ResizeSnapResult {
  const threshold = SNAP_THRESHOLD_PX / Math.max(zoom, 0.01)
  const next: Rect = { ...bounds }
  const guides: SnapGuide[] = []

  const hasWest = handle === 'w' || handle === 'nw' || handle === 'sw'
  const hasEast = handle === 'e' || handle === 'ne' || handle === 'se'
  const hasNorth = handle === 'n' || handle === 'nw' || handle === 'ne'
  const hasSouth = handle === 's' || handle === 'sw' || handle === 'se'

  if (hasWest || hasEast) {
    const edge = hasWest ? bounds.x : bounds.x + bounds.width
    const targets = targetsForAxis(statics, 'v')
    const grid = nearestGridTarget(edge, gridSize)
    if (grid) targets.push(grid)
    const snap = bestSnapForPosition(edge, 'v', targets, threshold)
    if (snap) {
      const right = next.x + next.width
      if (hasWest) {
        next.x = Math.min(right - 1, next.x + snap.delta)
        next.width = Math.max(1, right - next.x)
      } else {
        next.width = Math.max(1, next.width + snap.delta)
      }
      guides.push(snap.guide)
    }
  }

  if (hasNorth || hasSouth) {
    const edge = hasNorth ? bounds.y : bounds.y + bounds.height
    const targets = targetsForAxis(statics, 'h')
    const grid = nearestGridTarget(edge, gridSize)
    if (grid) targets.push(grid)
    const snap = bestSnapForPosition(edge, 'h', targets, threshold)
    if (snap) {
      const bottom = next.y + next.height
      if (hasNorth) {
        next.y = Math.min(bottom - 1, next.y + snap.delta)
        next.height = Math.max(1, bottom - next.y)
      } else {
        next.height = Math.max(1, next.height + snap.delta)
      }
      guides.push(snap.guide)
    }
  }

  return { bounds: next, guides }
}
