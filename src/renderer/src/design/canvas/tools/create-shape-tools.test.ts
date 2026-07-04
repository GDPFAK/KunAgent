import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasSelectionStore } from '../canvas-selection-store'
import { useCanvasShapeStore } from '../canvas-shape-store'
import { createEmptyDocument, createHtmlFrameShape } from '../canvas-types'
import { useCanvasUndoStore } from '../canvas-undo-store'
import { useCanvasViewportStore } from '../canvas-viewport-store'
import { setScreenArtifactFactory, setScreenCreationFactory } from '../screen-artifact-bridge'
import { executeOps } from '../shape-ops'
import { useDesignWorkspaceStore } from '../../design-workspace-store'
import { createDrawTool } from './draw-tool'
import { createEllipseTool } from './ellipse-tool'
import { createAiImageTool } from './ai-image-tool'
import { createFrameTool } from './frame-tool'
import { createRectTool } from './rect-tool'
import { createScreenTool } from './screen-tool'
import { createTextTool } from './text-tool'
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
  setScreenArtifactFactory(() => null)
  setScreenCreationFactory(null)
  useDesignWorkspaceStore.setState({ designContext: { designTarget: 'web' } })
  useCanvasViewportStore.getState().setActiveTool('rect')
})

function pointer(
  x: number,
  y: number,
  patch: Partial<Pick<CanvasPointerEvent, 'shiftKey' | 'altKey' | 'metaKey' | 'ctrlKey'>> = {}
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

function selectedShapeId(): string {
  return Array.from(useCanvasSelectionStore.getState().selectedIds)[0]
}

describe('shape creation tools', () => {
  it('snaps a newly drawn rectangle edge to a nearby object edge', () => {
    if (useCanvasViewportStore.getState().gridVisible) {
      useCanvasViewportStore.getState().toggleGrid()
    }
    executeOps([{ op: 'add', shape: { type: 'rect', x: 100, y: 300, width: 80, height: 80 } }])
    const tool = createRectTool()

    tool.onPointerDown(pointer(0, 0))
    tool.onPointerMove(pointer(96, 31))

    const shape = useCanvasShapeStore.getState().document.objects[selectedShapeId()]
    expect(shape).toMatchObject({ x: 0, y: 0, width: 100, height: 31 })
    expect(useCanvasSelectionStore.getState().activeSnapGuides).toContainEqual({
      axis: 'v',
      position: 100,
      source: 'edge'
    })

    tool.onPointerUp(pointer(96, 31))
    expect(useCanvasViewportStore.getState().activeTool).toBe('select')
    expect(useCanvasSelectionStore.getState().activeSnapGuides).toEqual([])
  })

  it('snaps a newly drawn frame to the visible grid', () => {
    const tool = createFrameTool()

    tool.onPointerDown(pointer(0, 0))
    tool.onPointerMove(pointer(96, 37))

    const shape = useCanvasShapeStore.getState().document.objects[selectedShapeId()]
    expect(shape).toMatchObject({ x: 0, y: 0, width: 100, height: 40 })
    expect(useCanvasSelectionStore.getState().activeSnapGuides).toEqual(
      expect.arrayContaining([
        { axis: 'v', position: 100, source: 'grid' },
        { axis: 'h', position: 40, source: 'grid' }
      ])
    )
  })

  it('snaps a newly drawn screen frame while preserving its HTML artifact link', () => {
    setScreenArtifactFactory((name) => `artifact-${name.toLowerCase()}`)
    const tool = createScreenTool()

    tool.onPointerDown(pointer(0, 0))
    tool.onPointerMove(pointer(96, 37))

    let shape = useCanvasShapeStore.getState().document.objects[selectedShapeId()]
    expect(shape).toMatchObject({
      type: 'frame',
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      htmlArtifactId: 'artifact-screen',
      devicePreset: 'desktop'
    })
    expect(useCanvasSelectionStore.getState().activeSnapGuides).toEqual(
      expect.arrayContaining([
        { axis: 'v', position: 100, source: 'grid' },
        { axis: 'h', position: 40, source: 'grid' }
      ])
    )

    tool.onPointerUp(pointer(96, 37))
    shape = useCanvasShapeStore.getState().document.objects[selectedShapeId()]
    expect(shape.htmlArtifactId).toBe('artifact-screen')
    expect(useCanvasViewportStore.getState().activeTool).toBe('select')
    expect(useCanvasSelectionStore.getState().activeSnapGuides).toEqual([])
  })

  it('finalizes drawn screen frames through the linked screen creation factory', () => {
    const requests: Array<{ preparePreview?: boolean; sizeMode?: 'auto' | 'manual' | 'manual-width-auto-height' }> = []
    setScreenCreationFactory((request) => {
      requests.push(request)
      const shape = createHtmlFrameShape(request.name, request.x, request.y, 'artifact-linked', request.devicePreset)
      shape.width = request.width
      shape.height = request.height
      useCanvasShapeStore.getState().addShape(shape)
      return { artifactId: 'artifact-linked', shapeId: shape.id }
    })
    const tool = createScreenTool()

    tool.onPointerDown(pointer(0, 0))
    tool.onPointerMove(pointer(96, 37))

    const preview = useCanvasShapeStore.getState().document.objects[selectedShapeId()]
    expect(preview).toMatchObject({ type: 'frame', width: 100, height: 40 })
    expect(preview.htmlArtifactId).toBeUndefined()

    tool.onPointerUp(pointer(96, 37))

    const shape = useCanvasShapeStore.getState().document.objects[selectedShapeId()]
    expect(shape).toMatchObject({
      type: 'frame',
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      htmlArtifactId: 'artifact-linked',
      devicePreset: 'desktop'
    })
    expect(useCanvasShapeStore.getState().document.objects[preview.id]).toBeUndefined()
    expect(useCanvasViewportStore.getState().activeTool).toBe('select')
    expect(requests[0]?.preparePreview).toBe(true)
    // A drag-drawn size is an explicit user sizing: the width must be locked
    // so board sync keeps it instead of resetting to 1280x800, while height
    // stays content-driven like a horizontal SelectionOverlay resize.
    expect(requests[0]?.sizeMode).toBe('manual-width-auto-height')
  })

  it('requests auto sizing for click-created screens through the creation factory', () => {
    const requests: Array<{ width: number; height: number; sizeMode?: 'auto' | 'manual' | 'manual-width-auto-height' }> = []
    setScreenCreationFactory((request) => {
      requests.push(request)
      const shape = createHtmlFrameShape(request.name, request.x, request.y, 'artifact-linked', request.devicePreset)
      shape.width = request.width
      shape.height = request.height
      useCanvasShapeStore.getState().addShape(shape)
      return { artifactId: 'artifact-linked', shapeId: shape.id }
    })
    const tool = createScreenTool()

    tool.onPointerDown(pointer(24, 32))
    tool.onPointerUp(pointer(24, 32))

    expect(requests[0]).toMatchObject({ width: 1280, height: 800, sizeMode: 'auto' })
  })

  it('click-creates app-sized screen frames when the design target is app', () => {
    useDesignWorkspaceStore.setState({ designContext: { designTarget: 'app' } })
    setScreenArtifactFactory((name) => `artifact-${name.toLowerCase()}`)
    const tool = createScreenTool()

    tool.onPointerDown(pointer(24, 32))
    tool.onPointerUp(pointer(24, 32))

    const shape = useCanvasShapeStore.getState().document.objects[selectedShapeId()]
    expect(shape).toMatchObject({
      type: 'frame',
      x: 24,
      y: 32,
      width: 390,
      height: 844,
      htmlArtifactId: 'artifact-screen',
      devicePreset: 'mobile'
    })
  })

  it('keeps shift-drawn ellipses circular instead of applying single-axis snap', () => {
    const tool = createEllipseTool()

    tool.onPointerDown(pointer(0, 0))
    tool.onPointerMove(pointer(96, 40, { shiftKey: true }))

    const shape = useCanvasShapeStore.getState().document.objects[selectedShapeId()]
    expect(shape).toMatchObject({ x: 0, y: 0, width: 96, height: 96 })
    expect(useCanvasSelectionStore.getState().activeSnapGuides).toEqual([])
  })

  it('clicks to create editable default text', () => {
    const tool = createTextTool()

    tool.onPointerDown(pointer(11, 13))
    tool.onPointerUp(pointer(11, 13))

    const shape = useCanvasShapeStore.getState().document.objects[selectedShapeId()]
    expect(shape).toMatchObject({
      type: 'text',
      x: 11,
      y: 13,
      width: 200,
      height: 24,
      textContent: 'Text'
    })
    expect(useCanvasSelectionStore.getState().editingId).toBe(shape.id)
    expect(useCanvasViewportStore.getState().activeTool).toBe('select')
  })

  it('creates a selected AI image slot that opens the canvas assistant', () => {
    const tool = createAiImageTool()
    useDesignWorkspaceStore.setState({ canvasAssistantOpen: false })

    tool.onPointerDown(pointer(10, 20))
    tool.onPointerMove(pointer(210, 160))
    tool.onPointerUp(pointer(210, 160))

    const shape = useCanvasShapeStore.getState().document.objects[selectedShapeId()]
    expect(shape).toMatchObject({
      type: 'image',
      name: 'AI Image',
      x: 10,
      y: 20,
      width: 200,
      height: 140,
      aiImageHolder: true
    })
    expect(useCanvasViewportStore.getState().activeTool).toBe('select')
    expect(useDesignWorkspaceStore.getState().canvasAssistantOpen).toBe(true)
  })

  it('can create an AI image slot without opening the design assistant', () => {
    const tool = createAiImageTool({ openAssistant: false })
    useDesignWorkspaceStore.setState({ canvasAssistantOpen: false })

    tool.onPointerDown(pointer(10, 20))
    tool.onPointerUp(pointer(10, 20))

    const shape = useCanvasShapeStore.getState().document.objects[selectedShapeId()]
    expect(shape).toMatchObject({
      type: 'image',
      aiImageHolder: true,
      width: 320,
      height: 220
    })
    expect(useCanvasViewportStore.getState().activeTool).toBe('select')
    expect(useDesignWorkspaceStore.getState().canvasAssistantOpen).toBe(false)
  })

  it('drags to create a snapped text box for canvas notes', () => {
    const tool = createTextTool()

    tool.onPointerDown(pointer(0, 0))
    tool.onPointerMove(pointer(96, 37))

    let shape = useCanvasShapeStore.getState().document.objects[selectedShapeId()]
    expect(shape).toMatchObject({ type: 'text', x: 0, y: 0, width: 100, height: 40 })
    expect(useCanvasSelectionStore.getState().activeSnapGuides).toEqual(
      expect.arrayContaining([
        { axis: 'v', position: 100, source: 'grid' },
        { axis: 'h', position: 40, source: 'grid' }
      ])
    )

    tool.onPointerUp(pointer(96, 37))

    shape = useCanvasShapeStore.getState().document.objects[selectedShapeId()]
    expect(shape).toMatchObject({ type: 'text', width: 100, height: 40 })
    expect(useCanvasSelectionStore.getState().editingId).toBe(shape.id)
    expect(useCanvasSelectionStore.getState().activeSnapGuides).toEqual([])
  })

  it('redoes a dragged rectangle with its final created bounds', () => {
    const tool = createRectTool()

    tool.onPointerDown(pointer(0, 0))
    tool.onPointerMove(pointer(96, 37))
    tool.onPointerUp(pointer(96, 37))

    let shape = useCanvasShapeStore.getState().document.objects[selectedShapeId()]
    const id = shape.id
    expect(shape).toMatchObject({ width: 100, height: 40 })
    expect(useCanvasUndoStore.getState().undoStack).toHaveLength(1)

    useCanvasShapeStore.getState().undo()
    expect(useCanvasShapeStore.getState().document.objects[id]).toBeUndefined()

    useCanvasShapeStore.getState().redo()
    shape = useCanvasShapeStore.getState().document.objects[id]
    expect(shape).toMatchObject({ type: 'rect', width: 100, height: 40 })
    expect(Array.from(useCanvasSelectionStore.getState().selectedIds)).toEqual([id])
  })

  it('does not record undo for a click-only draw stroke that gets discarded', () => {
    const tool = createDrawTool()

    tool.onPointerDown(pointer(5, 5))
    tool.onPointerUp(pointer(5, 5))

    const doc = useCanvasShapeStore.getState().document
    expect(doc.objects[doc.rootId].children).toEqual([])
    expect(useCanvasSelectionStore.getState().selectedIds.size).toBe(0)
    expect(useCanvasUndoStore.getState().undoStack).toHaveLength(0)
  })

  it('simplifies freehand strokes before recording their final undo state', () => {
    const tool = createDrawTool()

    tool.onPointerDown(pointer(0, 0))
    for (let x = 1; x <= 120; x += 1) {
      tool.onPointerMove(pointer(x, Math.sin(x / 4) * 0.25))
    }
    tool.onPointerUp(pointer(120, 0))

    let shape = useCanvasShapeStore.getState().document.objects[selectedShapeId()]
    const id = shape.id
    expect(shape.points).toHaveLength(2)
    expect(shape).toMatchObject({ type: 'draw', x: 0, width: 120 })

    useCanvasShapeStore.getState().undo()
    expect(useCanvasShapeStore.getState().document.objects[id]).toBeUndefined()

    useCanvasShapeStore.getState().redo()
    shape = useCanvasShapeStore.getState().document.objects[id]
    expect(shape.points).toHaveLength(2)
    expect(shape).toMatchObject({ type: 'draw', x: 0, width: 120 })
  })
})
