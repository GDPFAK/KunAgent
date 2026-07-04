import { useCanvasSelectionStore } from '../canvas-selection-store'
import { useCanvasShapeStore } from '../canvas-shape-store'
import { useCanvasViewportStore } from '../canvas-viewport-store'
import { createDefaultShape } from '../canvas-types'
import type { Point } from '../canvas-types'
import type { CanvasPointerEvent, CanvasToolHandler } from './tool-types'
import { snapCanvasPoint } from './point-snap'
import {
  addShapeForCreation,
  commitCreatedShapeUndo,
  discardCreatedShape,
  type CreatedShapeUndo
} from './creation-undo'

const MIN_LENGTH = 4
const DRAG_PROMOTE_PX = 3
const DBLCLICK_MS = 280
const DBLCLICK_NEAR_PX = 6

/**
 * Excalidraw-style linear tool shared by `arrow` and `line`:
 *   - press + drag                       → 2-point straight segment (released = done)
 *   - press without dragging (a "click") → enter MULTI-POINT mode:
 *     subsequent clicks append vertices; the next pointermove tracks a "preview"
 *     last vertex following the cursor; a fast double-click on the last point
 *     finalises the polyline (the preview tail is dropped). Catmull-Rom in
 *     LinearShape smooths ≥3 points into a curve.
 */
function createPolylineTool(shapeType: 'arrow' | 'line'): CanvasToolHandler {
  // Committed vertices in absolute canvas coords. In multi-point mode the
  // *previewed* last point is appended only when we sync to the store, not here.
  let raw: Point[] = []
  let previewId: string | null = null
  let creationUndo: CreatedShapeUndo | null = null
  let mode: 'idle' | 'drag-pending' | 'dragging' | 'multipoint' = 'idle'
  let lastClickT = 0
  let lastClickX = 0
  let lastClickY = 0

  function syncShape(all: Point[]): void {
    if (!previewId) return
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const p of all) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
    useCanvasShapeStore.getState().updateShape(
      previewId,
      {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        points: all.map((p) => ({ x: p.x - minX, y: p.y - minY }))
      },
      true
    )
  }

  function reset(): void {
    mode = 'idle'
    raw = []
    previewId = null
    creationUndo = null
    useCanvasSelectionStore.getState().setSnapGuides([])
  }

  function finish(): void {
    if (!previewId) {
      reset()
      return
    }
    if (raw.length < 2) {
      discardCreatedShape(creationUndo)
    } else {
      // Detect a tiny/degenerate single-segment line (e.g. a single click then
      // immediate dbl) and drop it so we don't leave invisible junk behind.
      const len = Math.hypot(raw[raw.length - 1].x - raw[0].x, raw[raw.length - 1].y - raw[0].y)
      if (raw.length === 2 && len < MIN_LENGTH) {
        discardCreatedShape(creationUndo)
      } else {
        syncShape(raw)
        commitCreatedShapeUndo(creationUndo, `create-${shapeType}`)
      }
    }
    useCanvasViewportStore.getState().setActiveTool('select')
    reset()
  }

  return {
    cursor: 'crosshair',

    onPointerDown(e: CanvasPointerEvent) {
      if (mode === 'idle') {
        const start = snapCanvasPoint({ x: e.canvasX, y: e.canvasY }, null)
        const shape = createDefaultShape(shapeType, start.x, start.y)
        shape.width = 0
        shape.height = 0
        shape.points = [
          { x: 0, y: 0 },
          { x: 0, y: 0 }
        ]
        previewId = shape.id
        creationUndo = addShapeForCreation(shape)
        useCanvasSelectionStore.getState().select([shape.id])
        raw = [start]
        mode = 'drag-pending'
        lastClickT = e.timeStamp
        lastClickX = start.x
        lastClickY = start.y
        return
      }
      if (mode === 'multipoint') {
        // Double-click near the previous vertex → finish polyline.
        const dt = e.timeStamp - lastClickT
        const near = Math.hypot(e.canvasX - lastClickX, e.canvasY - lastClickY) < DBLCLICK_NEAR_PX
        if (dt < DBLCLICK_MS && near) {
          finish()
          return
        }
        // Commit a new vertex; the preview tail will be tracked by pointermove.
        const point = e.shiftKey
          ? { x: e.canvasX, y: e.canvasY }
          : snapCanvasPoint({ x: e.canvasX, y: e.canvasY }, previewId)
        raw.push(point)
        lastClickT = e.timeStamp
        lastClickX = point.x
        lastClickY = point.y
        syncShape([...raw, point])
        return
      }
    },

    onPointerMove(e: CanvasPointerEvent) {
      if (mode === 'idle' || !previewId) return

      // Optional 45° snap for straight-line and last segment.
      let endX = e.canvasX
      let endY = e.canvasY
      if (e.shiftKey) {
        useCanvasSelectionStore.getState().setSnapGuides([])
        const anchor = raw[raw.length - 1]
        const dx = endX - anchor.x
        const dy = endY - anchor.y
        const len = Math.hypot(dx, dy)
        const snapped = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
        endX = anchor.x + Math.cos(snapped) * len
        endY = anchor.y + Math.sin(snapped) * len
      } else {
        const snapped = snapCanvasPoint({ x: endX, y: endY }, previewId)
        endX = snapped.x
        endY = snapped.y
      }

      if (mode === 'drag-pending') {
        // Promote to dragging only once we've actually moved meaningfully;
        // tiny jitter shouldn't pre-commit to "drag" mode.
        const moved = Math.hypot(e.canvasX - raw[0].x, e.canvasY - raw[0].y)
        if (moved >= DRAG_PROMOTE_PX) mode = 'dragging'
        else {
          syncShape([raw[0], { x: endX, y: endY }])
          return
        }
      }

      if (mode === 'dragging') {
        syncShape([raw[0], { x: endX, y: endY }])
        return
      }
      if (mode === 'multipoint') {
        syncShape([...raw, { x: endX, y: endY }])
        return
      }
    },

    onPointerUp(e: CanvasPointerEvent) {
      if (mode === 'dragging') {
        // Two-point straight segment is done.
        let endX = e.canvasX
        let endY = e.canvasY
        if (e.shiftKey) {
          useCanvasSelectionStore.getState().setSnapGuides([])
          const dx = endX - raw[0].x
          const dy = endY - raw[0].y
          const len = Math.hypot(dx, dy)
          const snapped = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
          endX = raw[0].x + Math.cos(snapped) * len
          endY = raw[0].y + Math.sin(snapped) * len
        } else {
          const snapped = snapCanvasPoint({ x: endX, y: endY }, previewId)
          endX = snapped.x
          endY = snapped.y
        }
        raw.push({ x: endX, y: endY })
        finish()
        return
      }
      if (mode === 'drag-pending') {
        // It was a click without a real drag — enter multi-point mode.
        // raw already holds the first vertex; the preview tail follows the cursor.
        mode = 'multipoint'
        const point = e.shiftKey
          ? { x: e.canvasX, y: e.canvasY }
          : snapCanvasPoint({ x: e.canvasX, y: e.canvasY }, previewId)
        syncShape([...raw, point])
        return
      }
      // In 'multipoint' onPointerUp is a no-op; new clicks commit vertices.
    }
  }
}

export function createArrowTool(): CanvasToolHandler {
  return createPolylineTool('arrow')
}

export function createLineTool(): CanvasToolHandler {
  return createPolylineTool('line')
}
