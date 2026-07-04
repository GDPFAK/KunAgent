import { describe, expect, it } from 'vitest'
import { createCanvasMinimapLayout, minimapPointToCanvas } from './canvas-minimap'
import {
  createDefaultShape,
  createEmptyDocument,
  type CanvasDocument,
  type CanvasShape,
  type ShapeType
} from './canvas-types'

function shape(type: ShapeType, id: string, patch: Partial<CanvasShape> = {}): CanvasShape {
  const item = createDefaultShape(type, patch.x ?? 0, patch.y ?? 0)
  item.id = id
  item.name = id
  Object.assign(item, patch)
  return item
}

function addShape(doc: CanvasDocument, item: CanvasShape, parentId = doc.rootId): CanvasShape {
  item.parentId = parentId
  item.frameId = parentId === doc.rootId ? null : parentId
  doc.objects[item.id] = item
  doc.objects[parentId]?.children.push(item.id)
  return item
}

describe('createCanvasMinimapLayout', () => {
  it('maps content and viewport into minimap space', () => {
    const doc = createEmptyDocument()
    addShape(doc, shape('frame', 'screen-a', { x: 100, y: 200, width: 400, height: 300 }))
    addShape(doc, shape('frame', 'screen-b', { x: 700, y: 200, width: 400, height: 300 }))

    const layout = createCanvasMinimapLayout(
      doc,
      { x: 80, y: 160, width: 500, height: 400 },
      new Set(['screen-b']),
      { width: 200, height: 120 }
    )

    expect(layout).not.toBeNull()
    expect(layout?.contentRect.width).toBeGreaterThan(layout?.viewportRect.width ?? 0)
    expect(layout?.shapeRects.map((item) => item.id)).toEqual(['screen-a', 'screen-b'])
    expect(layout?.shapeRects.find((item) => item.id === 'screen-b')?.selected).toBe(true)
  })

  it('includes selected descendants without duplicating top-level shapes', () => {
    const doc = createEmptyDocument()
    const frame = addShape(doc, shape('frame', 'screen', { x: 0, y: 0, width: 400, height: 400 }))
    addShape(doc, shape('rect', 'button', { x: 120, y: 140, width: 80, height: 40 }), frame.id)

    const layout = createCanvasMinimapLayout(
      doc,
      { x: -50, y: -50, width: 500, height: 500 },
      new Set(['screen', 'button']),
      { width: 160, height: 120 }
    )

    expect(layout?.shapeRects.map((item) => item.id)).toEqual(['screen', 'button'])
    expect(layout?.shapeRects.every((item) => item.selected)).toBe(true)
  })

  it('skips effectively hidden shapes', () => {
    const doc = createEmptyDocument()
    const hidden = addShape(doc, shape('frame', 'hidden', { visible: false, width: 300, height: 300 }))
    addShape(doc, shape('rect', 'hidden-child', { width: 120, height: 80 }), hidden.id)
    addShape(doc, shape('rect', 'visible', { x: 500, width: 100, height: 100 }))

    const layout = createCanvasMinimapLayout(
      doc,
      { x: 480, y: -20, width: 180, height: 160 },
      new Set(['hidden-child', 'visible']),
      { width: 160, height: 120 }
    )

    expect(layout?.shapeRects.map((item) => item.id)).toEqual(['visible'])
  })

  it('converts minimap points back to clamped canvas coordinates', () => {
    const doc = createEmptyDocument()
    addShape(doc, shape('rect', 'card', { x: 100, y: 100, width: 300, height: 200 }))
    const layout = createCanvasMinimapLayout(
      doc,
      { x: 100, y: 100, width: 300, height: 200 },
      new Set(),
      { width: 180, height: 120 }
    )

    expect(layout).not.toBeNull()
    if (!layout) return

    const center = minimapPointToCanvas(layout, {
      x: layout.viewportRect.x + layout.viewportRect.width / 2,
      y: layout.viewportRect.y + layout.viewportRect.height / 2
    })
    expect(center.x).toBeCloseTo(250)
    expect(center.y).toBeCloseTo(200)

    const clamped = minimapPointToCanvas(layout, { x: -1000, y: -1000 })
    expect(clamped.x).toBe(layout.worldBounds.x)
    expect(clamped.y).toBe(layout.worldBounds.y)
  })
})
