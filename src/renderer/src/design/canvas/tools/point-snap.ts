import { useCanvasSelectionStore } from '../canvas-selection-store'
import { isShapeEditable } from '../canvas-editability'
import { findSnaps } from '../canvas-snap'
import { useCanvasShapeStore } from '../canvas-shape-store'
import { shapeGeometry, type Point, type Rect } from '../canvas-types'
import { useCanvasViewportStore } from '../canvas-viewport-store'

export function snapCanvasPoint(point: Point, excludeId?: string | null): Point {
  const viewport = useCanvasViewportStore.getState()
  if (!viewport.snapEnabled) {
    useCanvasSelectionStore.getState().setSnapGuides([])
    return point
  }

  const doc = useCanvasShapeStore.getState().document
  const statics: Rect[] = []
  for (const id of Object.keys(doc.objects)) {
    if (id === doc.rootId || id === excludeId || !isShapeEditable(doc, id)) continue
    statics.push(shapeGeometry(doc.objects[id]).selrect)
  }

  const snap = findSnaps(
    { x: point.x, y: point.y, width: 0, height: 0 },
    statics,
    viewport.getZoom(),
    viewport.gridVisible ? 10 : null
  )
  useCanvasSelectionStore.getState().setSnapGuides(snap.guides)
  return { x: point.x + snap.dx, y: point.y + snap.dy }
}
