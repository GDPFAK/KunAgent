import { useCanvasViewportStore } from './canvas-viewport-store'
import { useCanvasShapeStore } from './canvas-shape-store'
import { useCanvasSelectionStore } from './canvas-selection-store'
import { getSelectionBounds } from './canvas-hit-test'
import { pasteClipboardImageToCanvas } from './canvas-image-import'
import type { CanvasTool } from './canvas-types'

/**
 * Workspace root cached at attach time so the global keyboard handler can
 * persist pasted images to disk without threading workspaceRoot through every
 * key event. CanvasViewport sets/clears this when it mounts/unmounts the
 * listener so we never paste against a stale workspace.
 */
let pasteWorkspaceRoot: string | null = null
export function setCanvasPasteWorkspaceRoot(workspaceRoot: string | null): void {
  pasteWorkspaceRoot = workspaceRoot && workspaceRoot.trim() ? workspaceRoot.trim() : null
}

const KEY_TO_TOOL: Record<string, CanvasTool> = {
  v: 'select',
  r: 'rect',
  o: 'ellipse',
  t: 'text',
  f: 'frame',
  h: 'hand'
}

export function handleCanvasKeyDown(e: KeyboardEvent): boolean {
  const meta = e.metaKey || e.ctrlKey
  const shift = e.shiftKey
  const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return false

  const key = e.key.toLowerCase()

  if (meta && key === 'z') {
    e.preventDefault()
    if (shift) {
      useCanvasShapeStore.getState().redo()
    } else {
      useCanvasShapeStore.getState().undo()
    }
    return true
  }

  if (meta && key === 'a') {
    e.preventDefault()
    const doc = useCanvasShapeStore.getState().document
    const root = doc.objects[doc.rootId]
    if (root) useCanvasSelectionStore.getState().selectAll(root.children)
    return true
  }

  if (meta && key === 'v') {
    e.preventDefault()
    const vbox = useCanvasViewportStore.getState().vbox
    void pasteClipboardImageToCanvas({
      vbox,
      ...(pasteWorkspaceRoot ? { workspaceRoot: pasteWorkspaceRoot } : {})
    })
    return true
  }

  if (meta && key === 'd') {
    e.preventDefault()
    const { selectedIds } = useCanvasSelectionStore.getState()
    for (const id of selectedIds) {
      useCanvasShapeStore.getState().duplicateShape(id)
    }
    return true
  }

  if (!meta && (key === 'delete' || key === 'backspace')) {
    e.preventDefault()
    const { selectedIds, clearSelection } = useCanvasSelectionStore.getState()
    for (const id of selectedIds) {
      useCanvasShapeStore.getState().deleteShape(id)
    }
    clearSelection()
    return true
  }

  if (!meta && KEY_TO_TOOL[key]) {
    e.preventDefault()
    useCanvasViewportStore.getState().setActiveTool(KEY_TO_TOOL[key])
    return true
  }

  if (key === ' ' && !meta) {
    e.preventDefault()
    useCanvasViewportStore.getState().setActiveTool('hand')
    return true
  }

  if (key === 'escape') {
    e.preventDefault()
    useCanvasSelectionStore.getState().clearSelection()
    useCanvasViewportStore.getState().setActiveTool('select')
    return true
  }

  // Zoom: Cmd/Ctrl + / Cmd/Ctrl -
  if (meta && (key === '=' || key === '+')) {
    e.preventDefault()
    const s = useCanvasViewportStore.getState()
    const cx = s.vbox.x + s.vbox.width / 2
    const cy = s.vbox.y + s.vbox.height / 2
    s.zoomTo(1.2, { x: cx, y: cy })
    return true
  }
  if (meta && key === '-') {
    e.preventDefault()
    const s = useCanvasViewportStore.getState()
    const cx = s.vbox.x + s.vbox.width / 2
    const cy = s.vbox.y + s.vbox.height / 2
    s.zoomTo(1 / 1.2, { x: cx, y: cy })
    return true
  }

  // Shift+0 → zoom to 100%
  if (shift && !meta && key === '0') {
    e.preventDefault()
    useCanvasViewportStore.getState().resetView()
    return true
  }

  // Shift+1 → zoom to fit all
  if (shift && !meta && key === '1') {
    e.preventDefault()
    const doc = useCanvasShapeStore.getState().document
    const root = doc.objects[doc.rootId]
    if (root) {
      const bounds = getSelectionBounds(doc.objects, new Set(root.children))
      if (bounds) useCanvasViewportStore.getState().zoomToFit(bounds)
    }
    return true
  }

  // Shift+2 → zoom to selection
  if (shift && !meta && key === '2') {
    e.preventDefault()
    const doc = useCanvasShapeStore.getState().document
    const { selectedIds } = useCanvasSelectionStore.getState()
    if (selectedIds.size > 0) {
      const bounds = getSelectionBounds(doc.objects, selectedIds)
      if (bounds) useCanvasViewportStore.getState().zoomToFit(bounds, 60)
    }
    return true
  }

  return false
}

export function handleCanvasKeyUp(e: KeyboardEvent): void {
  if (e.key === ' ') {
    const tool = useCanvasViewportStore.getState().activeTool
    if (tool === 'hand') {
      useCanvasViewportStore.getState().setActiveTool('select')
    }
  }
}
