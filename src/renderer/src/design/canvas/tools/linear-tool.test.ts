import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasSelectionStore } from '../canvas-selection-store'
import { useCanvasShapeStore } from '../canvas-shape-store'
import { createEmptyDocument, type CanvasShape } from '../canvas-types'
import { useCanvasUndoStore } from '../canvas-undo-store'
import { useCanvasViewportStore } from '../canvas-viewport-store'
import { executeOps } from '../shape-ops'
import { createArrowTool, createLineTool } from './linear-tool'
import type { CanvasPointerEvent } from './tool-types'

beforeEach(() => {
  useCanvasShapeStore.getState().loadDocument(createEmptyDocument())
  useCanvasUndoStore.getState().clear()
  useCanvasSelectionStore.getState().clearSelection()
  useCanvasSelectionStore.getState().setSnapGuides([])
  const viewport = useCanvasViewportStore.getState()
  viewport.setContainerSize(1000, 500)
  viewport.resetView()
  if (!useCanvasViewportStore.getState().gridVisible) {
    useCanvasViewportStore.getState().toggleGrid()
  }
  if (!useCanvasViewportStore.getState().snapEnabled) {
    useCanvasViewportStore.getState().toggleSnap()
  }
  useCanvasViewportStore.getState().setActiveTool('line')
})

function pointer(
  x: number,
  y: number,
  patch: Partial<Pick<CanvasPointerEvent, 'shiftKey' | 'altKey' | 'metaKey' | 'ctrlKey' | 'timeStamp'>> = {}
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
    timeStamp: patch.timeStamp ?? 0
  }
}

function selectedShape(): CanvasShape {
  const id = Array.from(useCanvasSelectionStore.getState().selectedIds)[0]
  return useCanvasShapeStore.getState().document.objects[id]
}

function absolutePoints(shape: CanvasShape): Array<{ x: number; y: number }> {
  return (shape.points ?? []).map((point) => ({ x: shape.x + point.x, y: shape.y + point.y }))
}

describe('linear tools', () => {
  it('snaps dragged line endpoints to the visible grid', () => {
    const tool = createLineTool()

    tool.onPointerDown(pointer(3, 4))
    tool.onPointerMove(pointer(96, 37))

    let points = absolutePoints(selectedShape())
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 40 }
    ])
    expect(useCanvasSelectionStore.getState().activeSnapGuides).toEqual(
      expect.arrayContaining([
        { axis: 'v', position: 100, source: 'grid' },
        { axis: 'h', position: 40, source: 'grid' }
      ])
    )

    tool.onPointerUp(pointer(96, 37))
    points = absolutePoints(selectedShape())
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 40 }
    ])
    expect(useCanvasSelectionStore.getState().activeSnapGuides).toEqual([])
    expect(useCanvasViewportStore.getState().activeTool).toBe('select')
  })

  it('snaps dragged arrow endpoints to nearby object edges', () => {
    if (useCanvasViewportStore.getState().gridVisible) {
      useCanvasViewportStore.getState().toggleGrid()
    }
    executeOps([{ op: 'add', shape: { type: 'rect', x: 100, y: 300, width: 80, height: 80 } }])
    const tool = createArrowTool()

    tool.onPointerDown(pointer(0, 0))
    tool.onPointerMove(pointer(96, 31))

    expect(absolutePoints(selectedShape())).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 31 }
    ])
    expect(useCanvasSelectionStore.getState().activeSnapGuides).toContainEqual({
      axis: 'v',
      position: 100,
      source: 'edge'
    })
  })

  it('keeps shift angle snapping independent from grid endpoint snapping', () => {
    const tool = createLineTool()

    tool.onPointerDown(pointer(0, 0))
    tool.onPointerMove(pointer(96, 7, { shiftKey: true }))

    const [, end] = absolutePoints(selectedShape())
    expect(end.x).toBeCloseTo(Math.hypot(96, 7), 5)
    expect(end.y).toBeCloseTo(0, 5)
    expect(end.x).not.toBe(100)
    expect(useCanvasSelectionStore.getState().activeSnapGuides).toEqual([])
  })

  it('redoes a dragged line with its final normalized points', () => {
    const tool = createLineTool()

    tool.onPointerDown(pointer(3, 4))
    tool.onPointerMove(pointer(96, 37))
    tool.onPointerUp(pointer(96, 37))

    const shape = selectedShape()
    const id = shape.id
    expect(absolutePoints(shape)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 40 }
    ])

    useCanvasShapeStore.getState().undo()
    expect(useCanvasShapeStore.getState().document.objects[id]).toBeUndefined()

    useCanvasShapeStore.getState().redo()
    const restored = useCanvasShapeStore.getState().document.objects[id]
    expect(absolutePoints(restored)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 40 }
    ])
    expect(Array.from(useCanvasSelectionStore.getState().selectedIds)).toEqual([id])
  })
})
