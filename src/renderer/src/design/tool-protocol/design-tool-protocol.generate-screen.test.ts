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

describe('design.generate_screen tool executor', () => {
  it('creates one graph-backed HTML screen frame on a design board', () => {
    const result = executeDesignToolInvocation({
      toolId: 'design.generate_screen',
      input: {
        name: 'Billing overview',
        prompt: 'Design a billing dashboard for workspace administrators.'
      }
    })
    const workspace = useDesignWorkspaceStore.getState()
    const canvas = useCanvasShapeStore.getState().document
    const board = workspace.artifacts.find((artifact) => artifact.kind === 'canvas')
    const htmlArtifacts = workspace.artifacts.filter((artifact) => artifact.kind === 'html')
    const frame = canvas.objects[result.affectedIds[0]]
    const output = result.output as {
      boardArtifactId: string
      artifactId: string
      frameId: string
      screen: { name: string; artifactId: string; frameId: string }
      draftWrite: { status: string; reason?: string }
    }

    expect(result).toMatchObject({ ok: true, status: 'applied' })
    expect(board).toBeDefined()
    expect(htmlArtifacts).toHaveLength(1)
    expect(frame).toMatchObject({
      type: 'frame',
      name: 'Billing overview',
      htmlArtifactId: htmlArtifacts[0].id,
      width: 1280,
      height: 800,
      devicePreset: 'desktop'
    })
    expect(workspace.activeArtifactId).toBe(board?.id)
    expect(result.journalEntry).toMatchObject({
      label: 'design.generate_screen',
      operations: [{ type: 'generate_screen' }]
    })
    expect(output).toMatchObject({
      boardArtifactId: board?.id,
      artifactId: htmlArtifacts[0].id,
      frameId: frame.id,
      screen: {
        name: 'Billing overview',
        artifactId: htmlArtifacts[0].id,
        frameId: frame.id
      },
      draftWrite: { status: 'skipped', reason: 'missing-workspace-root' }
    })
  })

  it('honors app target input with a mobile screen frame', () => {
    const result = executeDesignToolInvocation({
      toolId: 'design.generate_screen',
      input: {
        designTarget: 'app',
        prompt: 'Create a mobile task approval screen for field managers.'
      }
    })
    const frame = useCanvasShapeStore.getState().document.objects[result.affectedIds[0]]
    const workspace = useDesignWorkspaceStore.getState()

    expect(result).toMatchObject({ ok: true, status: 'applied' })
    expect(frame).toMatchObject({
      type: 'frame',
      width: 390,
      height: 844,
      devicePreset: 'mobile'
    })
    expect(workspace.artifacts.filter((artifact) => artifact.kind === 'html')).toHaveLength(1)
  })

  it('queues initial HTML and DESIGN.md draft files when workspace writing is available', async () => {
    const writeWorkspaceFile = vi.fn(async (request: WriteWorkspaceFileRequest) => ({
      ok: true as const,
      path: request.path,
      savedAt: '2026-07-02T00:00:00.000Z'
    }))
    vi.stubGlobal('window', { kunGui: { writeWorkspaceFile } })
    useDesignWorkspaceStore.setState({ workspaceRoot: '/workspace' })

    const result = executeDesignToolInvocation({
      toolId: 'design.generate_screen',
      input: {
        name: 'Launch review',
        prompt: 'Create a launch readiness workspace for product and design leads.'
      }
    })
    const output = result.output as {
      artifactId: string
      draftWrite: { status: string; htmlPath: string; designMdPath: string }
    }
    const htmlWrite = writeWorkspaceFile.mock.calls.find(([request]) =>
      request.path === output.draftWrite.htmlPath
    )?.[0]
    const notesWrite = writeWorkspaceFile.mock.calls.find(([request]) =>
      request.path === output.draftWrite.designMdPath
    )?.[0]

    expect(output.draftWrite).toMatchObject({
      status: 'queued',
      htmlPath: expect.stringMatching(/^\.kun-design\/.+\/.+\/v1\.html$/),
      designMdPath: expect.stringMatching(/^\.kun-design\/.+\/.+\/DESIGN\.md$/)
    })
    expect(htmlWrite).toMatchObject({
      workspaceRoot: '/workspace',
      content: expect.stringContaining('<title>Launch review</title>')
    })
    expect(htmlWrite?.content).toContain('Create a launch readiness workspace')
    expect(notesWrite).toMatchObject({
      workspaceRoot: '/workspace',
      content: expect.stringContaining('# Design Notes: Launch review')
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(useDesignWorkspaceStore.getState().artifacts.find((artifact) => artifact.id === output.artifactId))
      .toMatchObject({ previewStatus: 'ready' })
  })
})
