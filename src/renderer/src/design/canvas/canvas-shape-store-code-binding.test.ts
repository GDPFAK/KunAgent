import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultShape, createEmptyDocument } from './canvas-types'
import { useCanvasShapeStore } from './canvas-shape-store'

describe('canvas shape store code bindings', () => {
  beforeEach(() => {
    useCanvasShapeStore.getState().loadDocument(createEmptyDocument())
  })

  it('syncs DOM source bindings into the current canvas document', () => {
    const frame = createDefaultShape('frame', 0, 0)
    useCanvasShapeStore.getState().addShape(frame, undefined, { skipUndo: true })

    useCanvasShapeStore.getState().syncDomSourceBindings({
      capturedAt: '2026-07-02T12:00:00.000Z',
      scopeDesignObjectIds: [frame.id],
      matches: [
        {
          designObjectId: frame.id,
          node: {
            tagName: 'main',
            sourceFile: '.kun-design/home.html',
            domId: 'home-root'
          }
        }
      ]
    })

    expect(useCanvasShapeStore.getState().document.codeBindings?.[0]).toMatchObject({
      designObjectId: frame.id,
      status: 'active',
      target: {
        sourceFile: '.kun-design/home.html',
        domId: 'home-root'
      }
    })
  })
})
