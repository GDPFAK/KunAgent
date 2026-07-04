import { describe, expect, it, beforeEach } from 'vitest'
import { executeOps } from './shape-ops'
import { hitTest } from './canvas-hit-test'
import { useCanvasShapeStore } from './canvas-shape-store'
import { useCanvasUndoStore } from './canvas-undo-store'
import { useCanvasSelectionStore } from './canvas-selection-store'
import { createEmptyDocument } from './canvas-types'

beforeEach(() => {
  useCanvasShapeStore.getState().loadDocument(createEmptyDocument())
  useCanvasUndoStore.getState().clear()
  useCanvasSelectionStore.getState().clearSelection()
})

describe('linear ShapeOps normalization', () => {
  it('add arrow with absolute points derives the bbox and relative points', () => {
    const r = executeOps([
      {
        op: 'add',
        shape: {
          type: 'arrow',
          points: [
            { x: 100, y: 100 },
            { x: 300, y: 200 }
          ]
        }
      }
    ])
    expect(r.ok).toBe(true)
    const shape = useCanvasShapeStore.getState().document.objects[r.affectedIds[0]]
    expect(shape?.type).toBe('arrow')
    expect(shape).toMatchObject({ x: 100, y: 100, width: 200, height: 100 })
    expect(shape?.points).toEqual([
      { x: 0, y: 0 },
      { x: 200, y: 100 }
    ])
  })

  it('update with absolute points re-normalizes the linear shape', () => {
    const added = executeOps([
      {
        op: 'add',
        shape: {
          type: 'line',
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 }
          ]
        }
      }
    ])
    const id = added.affectedIds[0]
    executeOps([
      {
        op: 'update',
        id,
        patch: {
          points: [
            { x: 50, y: 50 },
            { x: 50, y: 150 }
          ]
        }
      }
    ])
    const shape = useCanvasShapeStore.getState().document.objects[id]
    expect(shape).toMatchObject({ x: 50, y: 50, width: 0, height: 100 })
    expect(shape?.points).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 100 }
    ])
  })
})

describe('linear shape styling ops', () => {
  it('accepts arrowhead styles and a dashed stroke', () => {
    const r = executeOps([
      {
        op: 'add',
        shape: {
          type: 'arrow',
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 }
          ],
          arrowheadStart: 'circle',
          arrowheadEnd: 'triangle',
          strokes: [{ color: '#e03131', width: 4, opacity: 1, position: 'center', dash: 'dashed' }]
        }
      }
    ])
    expect(r.ok).toBe(true)
    const shape = useCanvasShapeStore.getState().document.objects[r.affectedIds[0]]
    expect(shape?.arrowheadStart).toBe('circle')
    expect(shape?.arrowheadEnd).toBe('triangle')
    expect(shape?.strokes[0]).toMatchObject({ color: '#e03131', width: 4, dash: 'dashed' })
  })

  it('rejects an unknown arrowhead style', () => {
    const r = executeOps([
      { op: 'add', shape: { type: 'arrow', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], arrowheadEnd: 'star' } }
    ])
    expect(r.ok).toBe(false)
    expect(r.errors[0].code).toBe('INVALID_OP')
  })
})

describe('multi-point linear ShapeOps', () => {
  it('accepts a 3+ vertex polyline arrow (will render as a smooth curve)', () => {
    const r = executeOps([
      {
        op: 'add',
        shape: {
          type: 'arrow',
          points: [
            { x: 0, y: 0 },
            { x: 50, y: -20 },
            { x: 100, y: 0 },
            { x: 150, y: 30 }
          ]
        }
      }
    ])
    expect(r.ok).toBe(true)
    const shape = useCanvasShapeStore.getState().document.objects[r.affectedIds[0]]
    expect(shape?.points).toHaveLength(4)
    // Box is the bbox of the points (y spans -20..30 → height 50).
    expect(shape).toMatchObject({ x: 0, y: -20, width: 150, height: 50 })
  })
})

describe('linear shape hit-testing', () => {
  it('selects a diagonal arrow by proximity to the stroke, not its bbox', () => {
    const r = executeOps([
      {
        op: 'add',
        shape: {
          type: 'arrow',
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 100 }
          ]
        }
      }
    ])
    const id = r.affectedIds[0]
    const doc = useCanvasShapeStore.getState().document
    // On the y=x stroke → hit.
    expect(hitTest(doc, 50, 50)).toBe(id)
    // Inside the bounding box but far from the stroke → miss.
    expect(hitTest(doc, 90, 10)).toBeNull()
  })
})
