import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../canvas/canvas-types'
import { useCanvasSelectionStore } from '../canvas/canvas-selection-store'
import { useCanvasShapeStore } from '../canvas/canvas-shape-store'
import { useCanvasUndoStore } from '../canvas/canvas-undo-store'
import { useDesignSystemStore } from '../canvas/design-system-store'
import { setScreenCreationFactory } from '../canvas/screen-artifact-bridge'
import { clearDesignOperationJournal } from '../graph/design-operation-journal'
import { useDesignWorkspaceStore } from '../design-workspace-store'
import { executeDesignToolInvocation } from './design-tool-protocol'

type WriteWorkspaceFileRequest = {
  path: string
  workspaceRoot?: string
  content: string
}

beforeEach(() => {
  useCanvasShapeStore.getState().loadDocument(createEmptyDocument())
  useCanvasUndoStore.getState().clear()
  useCanvasSelectionStore.getState().clearSelection()
  useDesignSystemStore.getState().resetSystem()
  setScreenCreationFactory(null)
  useDesignWorkspaceStore.setState({
    workspaceRoot: '',
    documents: [],
    activeDocumentId: null,
    artifacts: [],
    activeArtifactId: null,
    designContext: { designTarget: 'web' },
    parallelPageStates: {},
    pagesRun: null
  })
  clearDesignOperationJournal()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('design.generate_directions tool executor', () => {
  it('queues draft HTML and DESIGN.md files for every generated direction', async () => {
    const writeWorkspaceFile = vi.fn(async (request: WriteWorkspaceFileRequest) => ({
      ok: true as const,
      path: request.path,
      savedAt: '2026-07-02T00:00:00.000Z'
    }))
    vi.stubGlobal('window', { kunGui: { writeWorkspaceFile } })
    useDesignWorkspaceStore.setState({ workspaceRoot: '/workspace' })

    const result = executeDesignToolInvocation({
      toolId: 'design.generate_directions',
      input: {
        designTarget: 'app',
        prompt: 'Design a field approval assistant.',
        directions: [
          { name: 'Calm operator', brief: 'A quiet approval queue for field managers.' },
          { name: 'Urgent dispatch', brief: 'A high-signal task triage view for active incidents.' }
        ]
      }
    })
    const output = result.output as {
      directions: Array<{
        name: string
        artifactId: string
        frameId: string
        draftWrite: { status: string; htmlPath: string; designMdPath: string }
      }>
    }
    const frames = output.directions.map((direction) =>
      useCanvasShapeStore.getState().document.objects[direction.frameId]
    )
    const htmlWrites = writeWorkspaceFile.mock.calls
      .map(([request]) => request)
      .filter((request) => request.path.endsWith('.html'))
    const notesWrites = writeWorkspaceFile.mock.calls
      .map(([request]) => request)
      .filter((request) => request.path.endsWith('/DESIGN.md'))

    expect(result).toMatchObject({ ok: true, status: 'applied' })
    expect(output.directions).toHaveLength(2)
    expect(output.directions.every((direction) => direction.draftWrite.status === 'queued')).toBe(true)
    expect(frames).toEqual([
      expect.objectContaining({ width: 390, height: 844, devicePreset: 'mobile' }),
      expect.objectContaining({ width: 390, height: 844, devicePreset: 'mobile' })
    ])
    expect(htmlWrites).toHaveLength(2)
    expect(notesWrites).toHaveLength(2)
    expect(htmlWrites.map((request) => request.content)).toEqual([
      expect.stringContaining('<title>Calm operator</title>'),
      expect.stringContaining('<title>Urgent dispatch</title>')
    ])
    expect(htmlWrites[0].content).toContain('A quiet approval queue')
    expect(htmlWrites[1].content).toContain('A high-signal task triage')
    expect(notesWrites.map((request) => request.content)).toEqual([
      expect.stringContaining('# Design Notes: Calm operator'),
      expect.stringContaining('# Design Notes: Urgent dispatch')
    ])

    await new Promise((resolve) => setTimeout(resolve, 0))
    for (const direction of output.directions) {
      expect(useDesignWorkspaceStore.getState().artifacts.find((artifact) => artifact.id === direction.artifactId))
        .toMatchObject({ previewStatus: 'ready' })
    }
  })
})
