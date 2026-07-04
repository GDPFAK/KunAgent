import { useCanvasSelectionStore } from '../canvas-selection-store'
import { useCanvasShapeStore } from '../canvas-shape-store'
import { useCanvasViewportStore } from '../canvas-viewport-store'
import { createDefaultShape } from '../canvas-types'
import type { Point } from '../canvas-types'
import type { CanvasPointerEvent, CanvasToolHandler } from './tool-types'
import {
  addShapeForCreation,
  commitCreatedShapeUndo,
  discardCreatedShape,
  type CreatedShapeUndo
} from './creation-undo'
import { normalizeFreehandPoints, simplifyFreehandPoints } from './freehand-points'

/**
 * Freehand pencil. Accumulates raw pointer samples and stores them as a points
 * polyline relative to the (recomputed) bounding box on every move.
 */
export function createDrawTool(): CanvasToolHandler {
  let drawing = false
  let previewId: string | null = null
  let creationUndo: CreatedShapeUndo | null = null
  let raw: Point[] = []

  return {
    cursor: 'crosshair',

    onPointerDown(e: CanvasPointerEvent) {
      drawing = true
      raw = [{ x: e.canvasX, y: e.canvasY }]
      const shape = createDefaultShape('draw', e.canvasX, e.canvasY)
      shape.width = 0
      shape.height = 0
      shape.points = [{ x: 0, y: 0 }]
      previewId = shape.id
      creationUndo = addShapeForCreation(shape)
      useCanvasSelectionStore.getState().select([shape.id])
    },

    onPointerMove(e: CanvasPointerEvent) {
      if (!drawing || !previewId) return
      raw.push({ x: e.canvasX, y: e.canvasY })

      const normalized = normalizeFreehandPoints(raw)
      if (normalized) {
        useCanvasShapeStore.getState().updateShape(previewId, normalized, true)
      }
    },

    onPointerUp() {
      if (!drawing || !previewId) return
      drawing = false
      const simplified = simplifyFreehandPoints(raw)
      const normalized = normalizeFreehandPoints(simplified)
      if (!normalized || normalized.points.length < 2) {
        discardCreatedShape(creationUndo)
      } else {
        useCanvasShapeStore.getState().updateShape(previewId, normalized, true)
        commitCreatedShapeUndo(creationUndo, 'create-draw')
      }
      useCanvasViewportStore.getState().setActiveTool('select')
      previewId = null
      creationUndo = null
      raw = []
    }
  }
}
