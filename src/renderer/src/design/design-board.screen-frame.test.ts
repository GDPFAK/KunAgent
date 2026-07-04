import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createScreenFrameArtifact } from './design-board'
import { createEmptyDocument } from './canvas/canvas-types'
import { useCanvasSelectionStore } from './canvas/canvas-selection-store'
import { useCanvasShapeStore } from './canvas/canvas-shape-store'
import { useCanvasUndoStore } from './canvas/canvas-undo-store'
import { useCanvasViewportStore } from './canvas/canvas-viewport-store'
import { useDesignWorkspaceStore } from './design-workspace-store'
import { artifact, installDesignDocument } from './design-board.test-helpers'

describe('design board screen frame creation', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      kunGui: {
        writeWorkspaceFile: vi.fn(async () => ({ ok: true as const }))
      }
    })
    useCanvasShapeStore.getState().loadDocument(createEmptyDocument())
    useCanvasUndoStore.getState().clear()
    useCanvasSelectionStore.getState().clearSelection()
    useCanvasViewportStore.getState().setContainerSize(1200, 800)
    useCanvasViewportStore.getState().setVbox({ x: -600, y: -400, width: 1200, height: 800 })
    useDesignWorkspaceStore.setState({ designContext: { designTarget: 'web' } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a centered screen frame without stealing the active board', () => {
    const board = artifact('board', 'canvas')
    installDesignDocument([board], board.id)

    const result = createScreenFrameArtifact({
      boardArtifactId: board.id,
      brief: 'Design an onboarding screen'
    })

    const state = useDesignWorkspaceStore.getState()
    const created = state.artifacts.find((item) => item.id === result.artifactId)
    const shape = useCanvasShapeStore.getState().document.objects[result.shape.id]

    expect(state.activeArtifactId).toBe(board.id)
    expect(created).toMatchObject({
      kind: 'html',
      title: 'Design an onboarding screen',
      relativePath: expect.stringMatching(/^\.kun-design\/doc\/.+\/v1\.html$/),
      previewStatus: 'pending',
      node: {
        x: -640,
        y: -400,
        width: 1280,
        height: 800,
        sizeMode: 'auto',
        viewMode: 'preview'
      }
    })
    expect(shape).toMatchObject({
      type: 'frame',
      htmlArtifactId: result.artifactId,
      x: -640,
      y: -400,
      width: 1280,
      height: 800
    })
    expect(useCanvasSelectionStore.getState().selectedIds.has(shape.id)).toBe(true)
    expect(useCanvasViewportStore.getState().activeTool).toBe('select')
  })

  it('creates app-target screen frames with mobile dimensions by default', () => {
    const board = artifact('board', 'canvas')
    installDesignDocument([board], board.id)
    useDesignWorkspaceStore.setState({ designContext: { designTarget: 'app' } })

    const result = createScreenFrameArtifact({
      boardArtifactId: board.id,
      brief: 'Design a mobile onboarding flow'
    })

    const created = useDesignWorkspaceStore.getState().artifacts.find((item) => item.id === result.artifactId)
    const shape = useCanvasShapeStore.getState().document.objects[result.shape.id]
    expect(created?.node).toMatchObject({
      width: 390,
      height: 844,
      sizeMode: 'auto'
    })
    expect(shape).toMatchObject({
      type: 'frame',
      htmlArtifactId: result.artifactId,
      width: 390,
      height: 844,
      devicePreset: 'mobile'
    })
  })
})
