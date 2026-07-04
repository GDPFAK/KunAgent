import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyDocument } from './canvas-types'
import { hitTest, hitTestAll } from './canvas-hit-test'
import { useCanvasShapeStore } from './canvas-shape-store'
import { useCanvasUndoStore } from './canvas-undo-store'
import { executeOps } from './shape-ops'

beforeEach(() => {
  useCanvasShapeStore.getState().loadDocument(createEmptyDocument())
  useCanvasUndoStore.getState().clear()
})

function addRect(x: number, y: number, parentId?: string): string {
  return executeOps([
    {
      op: 'add',
      shape: { type: 'rect', x, y, width: 80, height: 80 },
      ...(parentId ? { parentId } : {})
    }
  ]).affectedIds[0]
}

describe('canvas hit testing editability', () => {
  it('does not hit shapes under a locked parent', () => {
    const frameId = executeOps([
      { op: 'add', shape: { type: 'frame', x: 0, y: 0, width: 200, height: 200 } }
    ]).affectedIds[0]
    addRect(20, 20, frameId)
    useCanvasShapeStore.getState().updateShape(frameId, { locked: true })

    const doc = useCanvasShapeStore.getState().document
    expect(hitTest(doc, 40, 40)).toBeNull()
  })

  it('does not marquee-select hidden or locked shapes', () => {
    const editable = addRect(0, 0)
    const hidden = addRect(120, 0)
    const locked = addRect(240, 0)
    const store = useCanvasShapeStore.getState()
    store.updateShape(hidden, { visible: false })
    store.updateShape(locked, { locked: true })

    const doc = useCanvasShapeStore.getState().document
    expect(hitTestAll(doc, { x: -10, y: -10, width: 400, height: 120 })).toEqual([editable])
  })
})
