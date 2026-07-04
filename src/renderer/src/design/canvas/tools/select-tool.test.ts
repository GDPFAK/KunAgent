import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasSelectionStore } from '../canvas-selection-store'
import { useCanvasShapeStore } from '../canvas-shape-store'
import { useCanvasViewportStore } from '../canvas-viewport-store'
import { createEmptyDocument } from '../canvas-types'
import { useCanvasUndoStore } from '../canvas-undo-store'
import { executeOps } from '../shape-ops'
import type { CanvasPointerEvent } from './tool-types'
import { createSelectTool } from './select-tool'

beforeEach(() => {
  useCanvasShapeStore.getState().loadDocument(createEmptyDocument())
  useCanvasUndoStore.getState().clear()
  useCanvasSelectionStore.getState().clearSelection()
  const viewport = useCanvasViewportStore.getState()
  if (!viewport.snapEnabled) viewport.toggleSnap()
  if (viewport.gridVisible) viewport.toggleGrid()
})

function pointer(
  x: number,
  y: number,
  patch: Partial<Pick<CanvasPointerEvent, 'altKey' | 'shiftKey' | 'metaKey' | 'ctrlKey'>> = {}
): CanvasPointerEvent {
  return {
    canvasX: x,
    canvasY: y,
    clientX: x,
    clientY: y,
    shiftKey: patch.shiftKey ?? false,
    altKey: patch.altKey ?? false,
    metaKey: patch.metaKey ?? false,
    ctrlKey: patch.ctrlKey ?? false,
    timeStamp: 0
  }
}

function addRect(x = 0, y = 0): string {
  return executeOps([
    { op: 'add', shape: { type: 'rect', name: 'Card', x, y, width: 80, height: 60 } }
  ]).affectedIds[0]
}

function addFrameWithChild(): { frameId: string; childId: string } {
  const frameId = executeOps([
    {
      op: 'add',
      shape: { type: 'frame', name: 'Screen', x: 0, y: 0, width: 200, height: 160 }
    }
  ]).affectedIds[0]
  const childId = executeOps([
    {
      op: 'add',
      parentId: frameId,
      shape: { type: 'rect', name: 'Button', x: 24, y: 24, width: 80, height: 44 }
    }
  ]).affectedIds[0]

  return { frameId, childId }
}

describe('select tool', () => {
  it('marquee replaces selection by default', () => {
    const first = addRect(0, 0)
    const second = addRect(140, 0)
    useCanvasSelectionStore.getState().select([first])
    const tool = createSelectTool()

    tool.onPointerDown(pointer(120, -20))
    tool.onPointerMove(pointer(240, 100))
    tool.onPointerUp(pointer(240, 100))

    expect(Array.from(useCanvasSelectionStore.getState().selectedIds)).toEqual([second])
  })

  it('marquee keeps parent and child hits normalized to editable roots', () => {
    const { frameId, childId } = addFrameWithChild()
    const tool = createSelectTool()

    tool.onPointerDown(pointer(-20, -20))
    tool.onPointerMove(pointer(240, 200))
    tool.onPointerUp(pointer(240, 200))

    const selectedIds = useCanvasSelectionStore.getState().selectedIds
    expect(Array.from(selectedIds)).toEqual([frameId])
    expect(selectedIds.has(childId)).toBe(false)
  })

  it('shift-marquee adds hits to the existing selection', () => {
    const first = addRect(0, 0)
    const second = addRect(140, 0)
    const third = addRect(280, 0)
    useCanvasSelectionStore.getState().select([first])
    const tool = createSelectTool()

    tool.onPointerDown(pointer(120, -20, { shiftKey: true }))
    tool.onPointerMove(pointer(240, 100, { shiftKey: true }))
    tool.onPointerUp(pointer(240, 100, { shiftKey: true }))

    expect(Array.from(useCanvasSelectionStore.getState().selectedIds)).toEqual([first, second])
    expect(useCanvasSelectionStore.getState().selectedIds.has(third)).toBe(false)
  })

  it('shift-marquee normalizes added parent and child hits', () => {
    const existing = addRect(280, 0)
    const { frameId, childId } = addFrameWithChild()
    useCanvasSelectionStore.getState().select([existing])
    const tool = createSelectTool()

    tool.onPointerDown(pointer(-20, -20, { shiftKey: true }))
    tool.onPointerMove(pointer(240, 200, { shiftKey: true }))
    tool.onPointerUp(pointer(240, 200, { shiftKey: true }))

    const selectedIds = useCanvasSelectionStore.getState().selectedIds
    expect(Array.from(selectedIds)).toEqual([existing, frameId])
    expect(selectedIds.has(childId)).toBe(false)
  })

  it('alt-marquee subtracts hits from the existing selection', () => {
    const first = addRect(0, 0)
    const second = addRect(140, 0)
    const third = addRect(280, 0)
    useCanvasSelectionStore.getState().select([first, second, third])
    const tool = createSelectTool()

    tool.onPointerDown(pointer(120, -20, { altKey: true }))
    tool.onPointerMove(pointer(240, 100, { altKey: true }))
    tool.onPointerUp(pointer(240, 100, { altKey: true }))

    expect(Array.from(useCanvasSelectionStore.getState().selectedIds)).toEqual([first, third])
  })

  it('does not duplicate on alt-click without a real drag', () => {
    const originalId = addRect()
    useCanvasUndoStore.getState().clear()
    useCanvasSelectionStore.getState().select([originalId])
    const tool = createSelectTool()

    tool.onPointerDown(pointer(10, 10, { altKey: true }))
    tool.onPointerUp(pointer(10, 10, { altKey: true }))

    const doc = useCanvasShapeStore.getState().document
    expect(doc.objects[doc.rootId].children).toEqual([originalId])
    expect(Array.from(useCanvasSelectionStore.getState().selectedIds)).toEqual([originalId])
    expect(useCanvasUndoStore.getState().undoStack).toHaveLength(0)
  })

  it('alt-drags a duplicate while preserving the original and one-step undo', () => {
    const originalId = addRect()
    useCanvasUndoStore.getState().clear()
    useCanvasSelectionStore.getState().select([originalId])
    const tool = createSelectTool()

    tool.onPointerDown(pointer(10, 10, { altKey: true }))
    tool.onPointerMove(pointer(40, 30, { altKey: true }))
    tool.onPointerUp(pointer(40, 30, { altKey: true }))

    let doc = useCanvasShapeStore.getState().document
    const selectedAfterDrag = Array.from(useCanvasSelectionStore.getState().selectedIds)
    expect(selectedAfterDrag).toHaveLength(1)
    const cloneId = selectedAfterDrag[0]
    expect(cloneId).not.toBe(originalId)
    expect(doc.objects[originalId]).toMatchObject({ x: 0, y: 0 })
    expect(doc.objects[cloneId]).toMatchObject({ x: 30, y: 20, name: 'Card copy' })
    expect(doc.objects[doc.rootId].children).toEqual([originalId, cloneId])
    expect(useCanvasUndoStore.getState().undoStack).toHaveLength(1)

    useCanvasShapeStore.getState().undo()
    doc = useCanvasShapeStore.getState().document
    expect(doc.objects[originalId]).toBeDefined()
    expect(doc.objects[cloneId]).toBeUndefined()
    expect(doc.objects[doc.rootId].children).toEqual([originalId])
    expect(Array.from(useCanvasSelectionStore.getState().selectedIds)).toEqual([originalId])

    useCanvasShapeStore.getState().redo()
    doc = useCanvasShapeStore.getState().document
    expect(doc.objects[cloneId]).toMatchObject({ x: 30, y: 20 })
    expect(doc.objects[doc.rootId].children).toEqual([originalId, cloneId])
    expect(Array.from(useCanvasSelectionStore.getState().selectedIds)).toEqual([cloneId])
  })

  it('shift-drag locks movement to the dominant horizontal axis', () => {
    const id = addRect(0, 0)
    useCanvasUndoStore.getState().clear()
    useCanvasSelectionStore.getState().select([id])
    const tool = createSelectTool()

    tool.onPointerDown(pointer(10, 10))
    tool.onPointerMove(pointer(90, 34, { shiftKey: true }))
    tool.onPointerUp(pointer(90, 34, { shiftKey: true }))

    let doc = useCanvasShapeStore.getState().document
    expect(doc.objects[id]).toMatchObject({ x: 80, y: 0 })
    expect(useCanvasUndoStore.getState().undoStack).toHaveLength(1)

    useCanvasShapeStore.getState().undo()
    doc = useCanvasShapeStore.getState().document
    expect(doc.objects[id]).toMatchObject({ x: 0, y: 0 })
    expect(Array.from(useCanvasSelectionStore.getState().selectedIds)).toEqual([id])
  })

  it('shift-drag locks movement to the dominant vertical axis', () => {
    const id = addRect(0, 0)
    useCanvasSelectionStore.getState().select([id])
    const tool = createSelectTool()

    tool.onPointerDown(pointer(10, 10))
    tool.onPointerMove(pointer(32, 100, { shiftKey: true }))
    tool.onPointerUp(pointer(32, 100, { shiftKey: true }))

    const doc = useCanvasShapeStore.getState().document
    expect(doc.objects[id]).toMatchObject({ x: 0, y: 90 })
  })

  it('does not snap moved shapes to hidden targets', () => {
    const moving = addRect(0, 0)
    const hiddenTarget = addRect(90, 0)
    useCanvasShapeStore.getState().updateShape(hiddenTarget, { visible: false })
    useCanvasSelectionStore.getState().select([moving])
    const tool = createSelectTool()

    tool.onPointerDown(pointer(10, 10))
    tool.onPointerMove(pointer(18, 10))
    tool.onPointerUp(pointer(18, 10))

    const doc = useCanvasShapeStore.getState().document
    expect(doc.objects[moving]).toMatchObject({ x: 8, y: 0 })
  })

  it('does not snap moved shapes to descendants of hidden parents', () => {
    const moving = addRect(0, 0)
    const { frameId, childId } = addFrameWithChild()
    useCanvasShapeStore.getState().updateShape(frameId, { visible: false })
    useCanvasShapeStore.getState().updateShape(childId, { x: 90, y: 0 })
    useCanvasSelectionStore.getState().select([moving])
    const tool = createSelectTool()

    tool.onPointerDown(pointer(10, 10))
    tool.onPointerMove(pointer(18, 10))
    tool.onPointerUp(pointer(18, 10))

    const doc = useCanvasShapeStore.getState().document
    expect(doc.objects[moving]).toMatchObject({ x: 8, y: 0 })
  })
})
