import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasViewportStore } from '../canvas-viewport-store'
import { createHandTool } from './hand-tool'
import type { CanvasPointerEvent } from './tool-types'

beforeEach(() => {
  const viewport = useCanvasViewportStore.getState()
  viewport.setContainerSize(1000, 500)
  viewport.resetView()
})

function pointer(x: number, y: number): CanvasPointerEvent {
  return {
    canvasX: x,
    canvasY: y,
    clientX: x,
    clientY: y,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ctrlKey: false,
    timeStamp: 0
  }
}

describe('hand tool', () => {
  it('pans by screen delta scaled into canvas space', () => {
    const viewport = useCanvasViewportStore.getState()
    viewport.setVbox({ x: 0, y: 0, width: 2000, height: 1000 })
    const tool = createHandTool()

    tool.onPointerDown(pointer(100, 100))
    tool.onPointerMove(pointer(125, 80))

    expect(useCanvasViewportStore.getState().vbox).toMatchObject({
      x: -50,
      y: 40,
      width: 2000,
      height: 1000
    })
  })

  it('stops panning after pointer up', () => {
    const viewport = useCanvasViewportStore.getState()
    viewport.setVbox({ x: 0, y: 0, width: 1000, height: 500 })
    const tool = createHandTool()

    tool.onPointerDown(pointer(0, 0))
    tool.onPointerMove(pointer(20, 20))
    tool.onPointerUp(pointer(20, 20))
    tool.onPointerMove(pointer(40, 40))

    expect(useCanvasViewportStore.getState().vbox).toMatchObject({
      x: -20,
      y: -20,
      width: 1000,
      height: 500
    })
  })
})
