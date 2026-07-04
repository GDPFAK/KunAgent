import { useCanvasSelectionStore } from '../canvas-selection-store'
import { useCanvasShapeStore } from '../canvas-shape-store'
import { useCanvasUndoStore, type ShapePatch } from '../canvas-undo-store'
import type { CanvasShape } from '../canvas-types'

export type CreatedShapeUndo = {
  shapeId: string
  parentId: string
  childrenBefore: string[]
  selectionBefore: string[]
}

export function addShapeForCreation(shape: CanvasShape, parentId?: string): CreatedShapeUndo | null {
  const store = useCanvasShapeStore.getState()
  const doc = store.document
  const resolvedParentId = parentId ?? doc.rootId
  const parent = doc.objects[resolvedParentId]
  if (!parent) return null

  const state: CreatedShapeUndo = {
    shapeId: shape.id,
    parentId: resolvedParentId,
    childrenBefore: [...parent.children],
    selectionBefore: Array.from(useCanvasSelectionStore.getState().selectedIds)
  }
  store.addShape(shape, parentId, { skipUndo: true })
  return state
}

export function commitCreatedShapeUndo(
  state: CreatedShapeUndo | null,
  label = 'create-shape'
): void {
  if (!state) return
  const doc = useCanvasShapeStore.getState().document
  const shape = doc.objects[state.shapeId]
  const parent = doc.objects[state.parentId]
  if (!shape || !parent) return

  const patches: ShapePatch[] = [
    { id: state.shapeId, before: {}, after: { ...shape } },
    {
      id: state.parentId,
      before: { children: state.childrenBefore },
      after: { children: parent.children }
    }
  ]
  useCanvasUndoStore.getState().pushChange({
    patches,
    label,
    selectionBefore: state.selectionBefore
  })
}

export function discardCreatedShape(state: CreatedShapeUndo | null): void {
  if (!state) return
  useCanvasShapeStore.getState().deleteShape(state.shapeId, { skipUndo: true })
  const selection = useCanvasSelectionStore.getState()
  if (selection.selectedIds.has(state.shapeId)) {
    selection.select(state.selectionBefore)
  }
}
