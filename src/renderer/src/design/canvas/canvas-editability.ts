import type { CanvasDocument, CanvasShape } from './canvas-types'

function walkAncestors(
  objects: Record<string, CanvasShape>,
  id: string,
  visit: (shape: CanvasShape) => boolean
): boolean {
  let current = objects[id]
  const seen = new Set<string>()
  while (current) {
    if (seen.has(current.id)) return false
    seen.add(current.id)
    if (!visit(current)) return false
    if (!current.parentId) return true
    current = objects[current.parentId]
  }
  return false
}

export function isShapeEffectivelyVisible(
  objects: Record<string, CanvasShape>,
  id: string
): boolean {
  return walkAncestors(objects, id, (shape) => shape.visible !== false)
}

export function isShapeEffectivelyUnlocked(
  objects: Record<string, CanvasShape>,
  id: string
): boolean {
  return walkAncestors(objects, id, (shape) => shape.locked !== true)
}

export function isShapeEditable(doc: CanvasDocument, id: string): boolean {
  if (id === doc.rootId) return false
  if (!doc.objects[id]) return false
  return isShapeEffectivelyVisible(doc.objects, id) && isShapeEffectivelyUnlocked(doc.objects, id)
}

export function filterEditableShapeIds(doc: CanvasDocument, ids: Iterable<string>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    if (isShapeEditable(doc, id)) out.push(id)
  }
  return out
}

export function filterEditableRootShapeIds(doc: CanvasDocument, ids: Iterable<string>): string[] {
  const editable = filterEditableShapeIds(doc, ids)
  const selected = new Set(editable)
  return editable.filter((id) => {
    let parentId = doc.objects[id]?.parentId ?? null
    while (parentId) {
      if (selected.has(parentId)) return false
      parentId = doc.objects[parentId]?.parentId ?? null
    }
    return true
  })
}
