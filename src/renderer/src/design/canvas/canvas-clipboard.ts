import {
  filterEditableRootShapeIds,
  isShapeEffectivelyUnlocked,
  isShapeEffectivelyVisible
} from './canvas-editability'
import { useCanvasSelectionStore } from './canvas-selection-store'
import { useCanvasShapeStore } from './canvas-shape-store'
import { createShapeId, type CanvasDocument, type CanvasShape } from './canvas-types'
import { useCanvasUndoStore } from './canvas-undo-store'

const PASTE_OFFSET = 24

export type CanvasClipboardNode = {
  shape: CanvasShape
  children: CanvasClipboardNode[]
}

export type CanvasShapeClipboard = {
  kind: 'copy' | 'cut'
  roots: Array<{
    originalParentId: string | null
    node: CanvasClipboardNode
  }>
}

let shapeClipboard: CanvasShapeClipboard | null = null
let pasteCount = 0

function cloneShape(shape: CanvasShape): CanvasShape {
  return {
    ...shape,
    fills: shape.fills.map((fill) => ({ ...fill })),
    strokes: shape.strokes.map((stroke) => ({ ...stroke })),
    shadows: shape.shadows?.map((shadow) => ({ ...shadow })),
    points: shape.points?.map((point) => ({ ...point })),
    children: [...shape.children],
    tokenBindings: shape.tokenBindings ? { ...shape.tokenBindings } : undefined,
    overrides: shape.overrides ? { ...shape.overrides } : undefined
  }
}

function snapshotNode(doc: CanvasDocument, id: string): CanvasClipboardNode | null {
  const shape = doc.objects[id]
  if (!shape) return null
  const children: CanvasClipboardNode[] = []
  for (const childId of shape.children) {
    const child = snapshotNode(doc, childId)
    if (child) children.push(child)
  }
  return { shape: cloneShape(shape), children }
}

function editableRootSelection(doc: CanvasDocument): string[] {
  const selected = Array.from(useCanvasSelectionStore.getState().selectedIds)
  return filterEditableRootShapeIds(doc, selected)
}

function canPasteIntoParent(doc: CanvasDocument, id: string | null): boolean {
  if (!id) return false
  if (id === doc.rootId) return true
  if (!doc.objects[id]) return false
  return (
    isShapeEffectivelyVisible(doc.objects, id) &&
    isShapeEffectivelyUnlocked(doc.objects, id)
  )
}

function targetParentId(doc: CanvasDocument, originalParentId: string | null): string {
  return canPasteIntoParent(doc, originalParentId) ? originalParentId! : doc.rootId
}

function frameIdForParent(doc: CanvasDocument, parentId: string): string | null {
  if (parentId === doc.rootId) return null
  const parent = doc.objects[parentId]
  if (!parent) return null
  if (parent.type === 'frame') return parentId
  return parent.frameId ?? null
}

function documentHasHtmlArtifactId(doc: CanvasDocument, artifactId: string): boolean {
  return Object.values(doc.objects).some((shape) => shape.htmlArtifactId === artifactId)
}

function addPastedNode(
  node: CanvasClipboardNode,
  parentId: string,
  offset: number,
  preserveHtmlArtifactLinks: boolean
): string | null {
  const id = createShapeId()
  const source = node.shape
  const doc = useCanvasShapeStore.getState().document
  const shape: CanvasShape = {
    ...cloneShape(source),
    id,
    name: `${source.name} copy`,
    parentId,
    frameId: frameIdForParent(doc, parentId),
    x: source.x + offset,
    y: source.y + offset,
    children: []
  }
  if (
    !shape.htmlArtifactId ||
    !preserveHtmlArtifactLinks ||
    documentHasHtmlArtifactId(doc, shape.htmlArtifactId)
  ) {
    delete shape.htmlArtifactId
  }

  useCanvasShapeStore.getState().addShape(shape, parentId)

  for (const child of node.children) {
    addPastedNode(child, id, offset, preserveHtmlArtifactLinks)
  }

  return id
}

export function copyCanvasSelectionToClipboard(): boolean {
  const doc = useCanvasShapeStore.getState().document
  const roots = editableRootSelection(doc)
  if (roots.length === 0) return false

  const payloadRoots = roots.flatMap((id) => {
    const node = snapshotNode(doc, id)
    if (!node) return []
    return [{ originalParentId: doc.objects[id]?.parentId ?? null, node }]
  })
  if (payloadRoots.length === 0) return false

  shapeClipboard = { kind: 'copy', roots: payloadRoots }
  pasteCount = 0
  return true
}

export function cutCanvasSelectionToClipboard(): boolean {
  const doc = useCanvasShapeStore.getState().document
  const roots = editableRootSelection(doc)
  if (roots.length === 0) return false
  if (!copyCanvasSelectionToClipboard()) return false
  if (shapeClipboard) shapeClipboard = { ...shapeClipboard, kind: 'cut' }

  useCanvasUndoStore.getState().withGroup('cut-shapes', () => {
    const store = useCanvasShapeStore.getState()
    for (const id of roots) {
      store.deleteShape(id)
    }
    useCanvasSelectionStore.getState().clearSelection()
  })
  return true
}

export function pasteCanvasShapeClipboard(): string[] {
  if (!shapeClipboard || shapeClipboard.roots.length === 0) return []

  const pastedRootIds: string[] = []
  const selectionBefore = Array.from(useCanvasSelectionStore.getState().selectedIds)
  pasteCount += 1
  const offset = pasteCount * PASTE_OFFSET
  const preserveHtmlArtifactLinks = shapeClipboard.kind === 'cut'

  useCanvasUndoStore.getState().withGroup('paste-shapes', () => {
    const doc = useCanvasShapeStore.getState().document
    for (const root of shapeClipboard?.roots ?? []) {
      const parentId = targetParentId(doc, root.originalParentId)
      const pastedId = addPastedNode(root.node, parentId, offset, preserveHtmlArtifactLinks)
      if (pastedId) pastedRootIds.push(pastedId)
    }
    if (pastedRootIds.length > 0) {
      useCanvasSelectionStore.getState().select(pastedRootIds)
    }
  })

  if (pastedRootIds.length === 0) {
    useCanvasSelectionStore.getState().select(selectionBefore)
  }
  return pastedRootIds
}

export function hasCanvasShapeClipboard(): boolean {
  return Boolean(shapeClipboard && shapeClipboard.roots.length > 0)
}

export function clearCanvasShapeClipboard(): void {
  shapeClipboard = null
  pasteCount = 0
}
