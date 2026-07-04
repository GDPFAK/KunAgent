import { useCanvasSelectionStore } from '../canvas-selection-store'
import { isShapeEditable } from '../canvas-editability'
import { findResizeSnaps } from '../canvas-snap'
import { useCanvasShapeStore } from '../canvas-shape-store'
import { shapeGeometry, type Rect } from '../canvas-types'
import { useCanvasViewportStore } from '../canvas-viewport-store'
import type { ResizeHandle } from '../canvas-resize'
import type { CanvasPointerEvent } from './tool-types'

type CreateBoundsResult = {
  bounds: Rect
  handle: ResizeHandle
}

function creationHandle(startX: number, startY: number, endX: number, endY: number): ResizeHandle {
  const horizontal = endX < startX ? 'w' : 'e'
  const vertical = endY < startY ? 'n' : 's'
  return `${vertical}${horizontal}` as ResizeHandle
}

export function computeCreateShapeBounds(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  constrainSquare = false
): CreateBoundsResult {
  const handle = creationHandle(startX, startY, endX, endY)
  let x = Math.min(startX, endX)
  let y = Math.min(startY, endY)
  let width = Math.abs(endX - startX)
  let height = Math.abs(endY - startY)

  if (constrainSquare) {
    const side = Math.max(width, height)
    width = side
    height = side
    if (endX < startX) x = startX - side
    if (endY < startY) y = startY - side
  }

  return { bounds: { x, y, width, height }, handle }
}

export function computeSnappedCreateShapeBounds(
  startX: number,
  startY: number,
  event: CanvasPointerEvent,
  previewId: string,
  options: { constrainSquare?: boolean; allowSnap?: boolean } = {}
): Rect {
  const { bounds, handle } = computeCreateShapeBounds(
    startX,
    startY,
    event.canvasX,
    event.canvasY,
    options.constrainSquare
  )
  if (options.allowSnap === false) {
    useCanvasSelectionStore.getState().setSnapGuides([])
    return bounds
  }

  const viewport = useCanvasViewportStore.getState()
  if (!viewport.snapEnabled) {
    useCanvasSelectionStore.getState().setSnapGuides([])
    return bounds
  }

  const doc = useCanvasShapeStore.getState().document
  const statics: Rect[] = []
  for (const id of Object.keys(doc.objects)) {
    if (id === doc.rootId || id === previewId || !isShapeEditable(doc, id)) continue
    statics.push(shapeGeometry(doc.objects[id]).selrect)
  }

  const snap = findResizeSnaps(
    bounds,
    handle,
    statics,
    viewport.getZoom(),
    viewport.gridVisible ? 10 : null
  )
  useCanvasSelectionStore.getState().setSnapGuides(snap.guides)
  return snap.bounds
}
