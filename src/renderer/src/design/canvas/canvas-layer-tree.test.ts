import { describe, expect, it } from 'vitest'
import { flattenCanvasLayerRows, isLayerTreeContainer } from './canvas-layer-tree'
import {
  createDefaultShape,
  createEmptyDocument,
  type CanvasDocument,
  type CanvasShape,
  type ShapeType
} from './canvas-types'

function layer(type: ShapeType, id: string): CanvasShape {
  const shape = createDefaultShape(type, 0, 0)
  shape.id = id
  shape.name = id
  return shape
}

function addLayer(doc: CanvasDocument, shape: CanvasShape, parentId = doc.rootId): CanvasShape {
  shape.parentId = parentId
  shape.frameId = parentId === doc.rootId ? null : parentId
  doc.objects[shape.id] = shape
  doc.objects[parentId]?.children.push(shape.id)
  return shape
}

function rowSummary(doc: CanvasDocument, collapsedIds: ReadonlySet<string> = new Set()) {
  return flattenCanvasLayerRows(doc, collapsedIds).map((row) => ({
    id: row.id,
    depth: row.depth,
    hasChildren: row.hasChildren,
    collapsed: row.collapsed
  }))
}

describe('flattenCanvasLayerRows', () => {
  it('flattens visible layer order from top to bottom', () => {
    const doc = createEmptyDocument()
    const frame = addLayer(doc, layer('frame', 'frame'))
    addLayer(doc, layer('rect', 'rect'), frame.id)
    const group = addLayer(doc, layer('group', 'group'), frame.id)
    addLayer(doc, layer('text', 'text'), group.id)
    addLayer(doc, layer('ellipse', 'ellipse'))

    expect(rowSummary(doc)).toEqual([
      { id: 'ellipse', depth: 0, hasChildren: false, collapsed: false },
      { id: 'frame', depth: 0, hasChildren: true, collapsed: false },
      { id: 'group', depth: 1, hasChildren: true, collapsed: false },
      { id: 'text', depth: 2, hasChildren: false, collapsed: false },
      { id: 'rect', depth: 1, hasChildren: false, collapsed: false }
    ])
  })

  it('keeps a collapsed container row and skips descendants', () => {
    const doc = createEmptyDocument()
    const frame = addLayer(doc, layer('frame', 'frame'))
    addLayer(doc, layer('rect', 'child'), frame.id)
    addLayer(doc, layer('ellipse', 'top'))

    expect(rowSummary(doc, new Set([frame.id]))).toEqual([
      { id: 'top', depth: 0, hasChildren: false, collapsed: false },
      { id: 'frame', depth: 0, hasChildren: true, collapsed: true }
    ])
  })

  it('does not duplicate rows when document references repeat', () => {
    const doc = createEmptyDocument()
    const group = addLayer(doc, layer('group', 'group'))
    const child = addLayer(doc, layer('rect', 'child'), group.id)
    doc.objects[group.id]?.children.push(group.id, child.id)
    doc.objects[doc.rootId]?.children.push(group.id)

    expect(rowSummary(doc)).toEqual([
      { id: 'group', depth: 0, hasChildren: true, collapsed: false },
      { id: 'child', depth: 1, hasChildren: false, collapsed: false }
    ])
  })
})

describe('isLayerTreeContainer', () => {
  it('only treats frame/group shapes with children as containers', () => {
    expect(isLayerTreeContainer(layer('frame', 'empty-frame'))).toBe(false)
    expect(isLayerTreeContainer({ ...layer('frame', 'frame'), children: ['child'] })).toBe(true)
    expect(isLayerTreeContainer({ ...layer('rect', 'rect'), children: ['child'] })).toBe(false)
  })
})
