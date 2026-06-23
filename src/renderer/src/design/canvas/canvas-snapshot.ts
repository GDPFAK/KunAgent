/**
 * Token-economic canvas snapshot for the AI. Excludes per-shape rendering noise
 * (fills/strokes/transform matrices) and uses parent NAMES instead of opaque ids
 * so the AI can reason about layer structure in human terms.
 *
 * The id is still included so the AI can target shapes precisely in ShapeOps.
 */
import { isImplicitImageSlot } from './canvas-types'
import type { CanvasDocument, CanvasShape, Point } from './canvas-types'

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
  htmlArtifactId?: string
  /** True when this shape is in the user's current selection (what "this"/"here" refers to). */
  selected?: boolean
  /**
   * True when this shape is an AI image slot the agent should fill on request —
   * either explicitly marked (`aiImageHolder`) or an empty box the user has
   * currently selected (auto-detected, so no manual marking is needed).
   */
  aiImageHolder?: boolean
  /**
   * Workspace-relative path of the picture already in this image shape
   * (e.g. `.deepseekgui-images/img-….png`). Present only on `image` shapes
   * that have been filled — empty image holders omit it. The agent passes
   * this path back into `generate_image` as `reference_image_paths` when the
   * user asks to edit/restyle/redo the existing picture.
   */
  imageUrl?: string

  /** Linear shapes only: vertices in ABSOLUTE canvas coords. */
  points?: Point[]
}

export type CanvasSnapshot = {
  shapeCount: number
  shapes: CanvasSnapshotShape[]
}

export function snapshotCanvas(
  doc: CanvasDocument,
  selectedIds?: ReadonlySet<string>
): CanvasSnapshot {
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
      const selected = selectedIds?.has(s.id) ?? false
      // A selected empty box is an implicit slot — the user shouldn't have to
      // mark it for the agent to fill it on request. A selected image whose
      // imageUrl is a data: URL is also effectively unreferenceable (the
      // snapshot drops data: URLs to avoid base64 blowing the prompt), so we
      // flag it as a holder too — otherwise the model would see neither
      // imageUrl nor aiImageHolder and have no rule to follow.
      const isUnreferenceableImage =
        s.type === 'image' && typeof s.imageUrl === 'string' && s.imageUrl.startsWith('data:')
      const isHolder =
        Boolean(s.aiImageHolder) || (selected && (isImplicitImageSlot(s) || isUnreferenceableImage))
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
        ...(s.textContent ? { textContent: s.textContent.slice(0, 120) } : {}),
        ...(s.htmlArtifactId ? { htmlArtifactId: s.htmlArtifactId } : {}),
        ...(s.imageUrl && !s.imageUrl.startsWith('data:') ? { imageUrl: s.imageUrl } : {}),
        ...(selected ? { selected: true } : {}),
        ...(isHolder ? { aiImageHolder: true } : {}),
        ...(s.points && s.points.length > 0
          ? { points: s.points.map((p) => ({ x: round(s.x + p.x), y: round(s.y + p.y) })) }
          : {})
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
