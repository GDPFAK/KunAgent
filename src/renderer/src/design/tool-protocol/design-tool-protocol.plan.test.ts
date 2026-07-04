import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultShape, createEmptyDocument } from '../canvas/canvas-types'
import { useCanvasShapeStore } from '../canvas/canvas-shape-store'
import { useCanvasUndoStore } from '../canvas/canvas-undo-store'
import { useDesignSystemStore } from '../canvas/design-system-store'
import { clearDesignOperationJournal } from '../graph/design-operation-journal'
import { useDesignWorkspaceStore } from '../design-workspace-store'
import { executeDesignToolInvocation } from './design-tool-protocol'

beforeEach(() => {
  useCanvasShapeStore.getState().loadDocument(createEmptyDocument())
  useCanvasUndoStore.getState().clear()
  useDesignSystemStore.getState().resetSystem()
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

describe('design.plan strategy output', () => {
  it('plans a blank board as whiteboard direction generation', () => {
    useDesignWorkspaceStore.setState({ designContext: { designTarget: 'app' } })

    const result = executeDesignToolInvocation({ toolId: 'design.plan' })
    const output = result.output as {
      strategy: { mode: string; focus: string; actions: Array<{ toolId: string; inputHint: string }> }
      nextTools: string[]
    }

    expect(result).toMatchObject({ ok: true, status: 'ready' })
    expect(output.strategy).toMatchObject({
      mode: 'whiteboard',
      actions: [
        { toolId: 'design.generate_directions', inputHint: expect.stringContaining('designTarget=app') },
        { toolId: 'design.system' },
        { toolId: 'design.generate_screen' }
      ]
    })
    expect(output.nextTools).toEqual(['design.generate_directions', 'design.system', 'design.generate_screen'])
    expect(result.summaryLines).toContain('mode: whiteboard')
  })

  it('plans plain canvas frames as screen generation work', () => {
    const doc = createEmptyDocument()
    const frame = createDefaultShape('frame', 40, 60)
    frame.name = 'Sketch frame'
    doc.objects[frame.id] = { ...frame, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [frame.id] }
    useCanvasShapeStore.getState().loadDocument(doc)

    const result = executeDesignToolInvocation({ toolId: 'design.plan' })
    const output = result.output as { strategy: { mode: string; nextTools: string[]; focus: string } }

    expect(output.strategy.mode).toBe('screen-generation')
    expect(output.strategy.nextTools).toEqual(['design.generate_screen', 'design.system', 'design.critique'])
    expect(output.strategy.focus).toContain('Convert whiteboard frames')
  })

  it('plans systemized screens without bindings as code roundtrip preparation', () => {
    const doc = createEmptyDocument()
    const frame = createDefaultShape('frame', 10, 20)
    frame.name = 'Ready screen'
    frame.htmlArtifactId = 'artifact_ready'
    const secondFrame = createDefaultShape('frame', 420, 20)
    secondFrame.name = 'Review screen'
    secondFrame.htmlArtifactId = 'artifact_review'
    doc.objects[frame.id] = { ...frame, parentId: doc.rootId }
    doc.objects[secondFrame.id] = { ...secondFrame, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [frame.id, secondFrame.id] }
    useCanvasShapeStore.getState().loadDocument(doc)
    const componentRoot = createDefaultShape('rect', 0, 0)
    componentRoot.name = 'Button'
    useDesignWorkspaceStore.getState().upsertArtifact({
      id: 'artifact_ready',
      kind: 'html',
      title: 'Ready screen',
      relativePath: '.kun-design/doc/artifact_ready/v1.html',
      createdAt: '2026-07-02T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
      versions: [{
        id: 'artifact_ready-v1',
        relativePath: '.kun-design/doc/artifact_ready/v1.html',
        createdAt: '2026-07-02T00:00:00.000Z',
        summary: ''
      }],
      direction: { id: 'dir_ready', name: 'Ready direction', status: 'active' }
    })
    useDesignWorkspaceStore.getState().upsertArtifact({
      id: 'artifact_review',
      kind: 'html',
      title: 'Review screen',
      relativePath: '.kun-design/doc/artifact_review/v1.html',
      createdAt: '2026-07-02T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
      versions: [{
        id: 'artifact_review-v1',
        relativePath: '.kun-design/doc/artifact_review/v1.html',
        createdAt: '2026-07-02T00:00:00.000Z',
        summary: ''
      }],
      direction: { id: 'dir_review', name: 'Review direction', status: 'active' }
    })
    useDesignSystemStore.getState().loadSystem({
      tokens: { 'brand/primary': { name: 'brand/primary', kind: 'color', value: '#0f766e' } },
      components: {
        Button: {
          id: 'component_button',
          name: 'Button',
          version: 1,
          tree: [componentRoot],
          slots: [{ path: 'Button', kind: 'text', label: 'Label' }]
        }
      }
    })

    const result = executeDesignToolInvocation({ toolId: 'design.plan' })
    const output = result.output as {
      strategy: { mode: string; actions: Array<{ toolId: string; reason: string }> }
    }

    expect(output.strategy.mode).toBe('code-roundtrip')
    expect(output.strategy.actions[0]).toMatchObject({
      toolId: 'design.bind_code',
      reason: expect.stringContaining('missing or stale')
    })
  })
})
