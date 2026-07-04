import type { CanvasDocument, CanvasShape } from './canvas-types'

export type CanvasLayerTreeRow = {
  id: string
  depth: number
  hasChildren: boolean
  collapsed: boolean
}

export function isLayerTreeContainer(shape: CanvasShape | undefined): boolean {
  return Boolean(
    shape &&
      (shape.type === 'frame' || shape.type === 'group') &&
      shape.children.length > 0
  )
}

export function flattenCanvasLayerRows(
  doc: CanvasDocument,
  collapsedIds: ReadonlySet<string>
): CanvasLayerTreeRow[] {
  const root = doc.objects[doc.rootId]
  if (!root) return []
  const rows: CanvasLayerTreeRow[] = []
  const seen = new Set<string>()

  const visit = (id: string, depth: number): void => {
    if (seen.has(id)) return
    seen.add(id)
    const shape = doc.objects[id]
    if (!shape) return
    const hasChildren = isLayerTreeContainer(shape)
    const collapsed = hasChildren && collapsedIds.has(id)
    rows.push({ id, depth, hasChildren, collapsed })
    if (!hasChildren || collapsed) return
    for (const childId of [...shape.children].reverse()) {
      visit(childId, depth + 1)
    }
  }

  for (const childId of [...root.children].reverse()) {
    visit(childId, 0)
  }
  return rows
}
