/**
 * Token-economic canvas snapshot for the AI. Excludes per-shape rendering noise
 * (fills/strokes/transform matrices) and uses parent NAMES instead of opaque ids
 * so the AI can reason about layer structure in human terms.
 *
 * The id is still included so the AI can target shapes precisely in ShapeOps.
 */
import type { CanvasDocument, CanvasShape } from './canvas-types'

export type CanvasSnapshotShape = {
  id: string
  name: string
  type: CanvasShape['type']
  x: number
  y: number
  w: number
  h: number
  rotation?: number
  parentName: string | null
  textContent?: string
}

export type CanvasSnapshot = {
  shapeCount: number
  shapes: CanvasSnapshotShape[]
}

export function snapshotCanvas(doc: CanvasDocument): CanvasSnapshot {
  const { objects, rootId } = doc
  const shapes: CanvasSnapshotShape[] = []
  const seen = new Set<string>()

  function walk(parentId: string, parentName: string | null): void {
    const parent = objects[parentId]
    if (!parent) return
    for (const childId of parent.children) {
      if (seen.has(childId)) continue
      seen.add(childId)
      const s = objects[childId]
      if (!s) continue
      shapes.push({
        id: s.id,
        name: s.name,
        type: s.type,
        x: round(s.x),
        y: round(s.y),
        w: round(s.width),
        h: round(s.height),
        ...(s.rotation ? { rotation: round(s.rotation) } : {}),
        parentName,
        ...(s.textContent ? { textContent: s.textContent.slice(0, 120) } : {})
      })
      if (s.children.length > 0) walk(s.id, s.name)
    }
  }

  walk(rootId, null)
  return { shapeCount: shapes.length, shapes }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

export function snapshotToCompactJson(snapshot: CanvasSnapshot): string {
  return JSON.stringify(snapshot, null, 2)
}
