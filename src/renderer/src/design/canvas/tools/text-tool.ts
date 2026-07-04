import { useCanvasSelectionStore } from '../canvas-selection-store'
import { useCanvasShapeStore } from '../canvas-shape-store'
import { useCanvasViewportStore } from '../canvas-viewport-store'
import { createDefaultShape } from '../canvas-types'
import type { CanvasPointerEvent, CanvasToolHandler } from './tool-types'
import { computeSnappedCreateShapeBounds } from './create-shape-bounds'
import { addShapeForCreation, commitCreatedShapeUndo, type CreatedShapeUndo } from './creation-undo'

const TEXT_DRAG_THRESHOLD_PX = 3
const MIN_TEXT_BOX_WIDTH = 24
const MIN_TEXT_BOX_HEIGHT = 24

export function createTextTool(): CanvasToolHandler {
  let drawing = false
  let startX = 0
  let startY = 0
  let startClientX = 0
  let startClientY = 0
  let previewId: string | null = null
  let dragged = false
  let creationUndo: CreatedShapeUndo | null = null

  function textBounds(startX: number, startY: number, e: CanvasPointerEvent, id: string): {
    x: number
    y: number
    width: number
    height: number
  } {
    const bounds = computeSnappedCreateShapeBounds(startX, startY, e, id)
    if (bounds.width < MIN_TEXT_BOX_WIDTH) {
      bounds.x = e.canvasX < startX ? startX - MIN_TEXT_BOX_WIDTH : startX
      bounds.width = MIN_TEXT_BOX_WIDTH
    }
    if (bounds.height < MIN_TEXT_BOX_HEIGHT) {
      bounds.y = e.canvasY < startY ? startY - MIN_TEXT_BOX_HEIGHT : startY
      bounds.height = MIN_TEXT_BOX_HEIGHT
    }
    return bounds
  }

  return {
    cursor: 'text',

    onPointerDown(e: CanvasPointerEvent) {
      const shape = createDefaultShape('text', e.canvasX, e.canvasY)
      creationUndo = addShapeForCreation(shape)
      useCanvasSelectionStore.getState().select([shape.id])
      drawing = true
      startX = e.canvasX
      startY = e.canvasY
      startClientX = e.clientX
      startClientY = e.clientY
      previewId = shape.id
      dragged = false
    },

    onPointerMove(e: CanvasPointerEvent) {
      if (!drawing || !previewId) return
      const movedPx = Math.hypot(e.clientX - startClientX, e.clientY - startClientY)
      if (!dragged && movedPx < TEXT_DRAG_THRESHOLD_PX) return
      dragged = true
      useCanvasShapeStore.getState().updateShape(previewId, textBounds(startX, startY, e, previewId), true)
    },

    onPointerUp(e: CanvasPointerEvent) {
      if (!drawing || !previewId) return
      if (dragged) {
        useCanvasShapeStore.getState().updateShape(previewId, textBounds(startX, startY, e, previewId), true)
      }
      useCanvasSelectionStore.getState().setEditing(previewId)
      useCanvasSelectionStore.getState().setSnapGuides([])
      useCanvasViewportStore.getState().setActiveTool('select')
      commitCreatedShapeUndo(creationUndo, 'create-text')
      drawing = false
      previewId = null
      dragged = false
      creationUndo = null
    }
  }
}
