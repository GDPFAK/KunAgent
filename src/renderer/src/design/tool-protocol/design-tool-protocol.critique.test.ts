import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultShape, createEmptyDocument } from '../canvas/canvas-types'
import { useCanvasShapeStore } from '../canvas/canvas-shape-store'
import { useCanvasUndoStore } from '../canvas/canvas-undo-store'
import { useDesignSystemStore } from '../canvas/design-system-store'
import { useDesignWorkspaceStore } from '../design-workspace-store'
import { clearDesignOperationJournal } from '../graph/design-operation-journal'
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

describe('design.critique report output', () => {
  it('returns dimensional quality report and next tool recommendations', () => {
    const doc = createEmptyDocument()
    const card = createDefaultShape('rect', 20, 24)
    card.name = 'Metric card'
    card.fills = [{ type: 'solid', color: '#0f766e', opacity: 1 }]
    const button = createDefaultShape('rect', 48, 64)
    button.name = 'Tiny button'
    button.width = 32
    button.height = 28
    button.fills = [{ type: 'solid', color: '#f59e0b', opacity: 1 }]
    const frame = createDefaultShape('frame', 0, 0)
    frame.name = 'Linked screen'
    frame.htmlArtifactId = 'artifact_screen'
    doc.objects[frame.id] = { ...frame, parentId: doc.rootId, children: [card.id, button.id] }
    doc.objects[card.id] = { ...card, parentId: frame.id }
    doc.objects[button.id] = { ...button, parentId: frame.id }
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [frame.id] }
    useCanvasShapeStore.getState().loadDocument(doc)
    useDesignSystemStore.getState().loadSystem({
      tokens: {
        'brand/primary': { name: 'brand/primary', kind: 'color', value: '#0f766e' },
        'brand/warn': { name: 'brand/warn', kind: 'color', value: '#f59e0b' }
      },
      components: {}
    })

    const result = executeDesignToolInvocation({
      toolId: 'design.critique',
      input: { scopeIds: [frame.id], attachNotes: false }
    })
    const output = result.output as {
      report: {
        status: string
        score: number
        dimensions: Array<{ id: string; status: string; findingCount: number; nextTool?: string }>
        recommendations: Array<{ toolId: string; reason: string }>
      }
    }

    expect(result).toMatchObject({ ok: true, status: 'applied' })
    expect(output.report.status).toBe('needs-repair')
    expect(output.report.score).toBeLessThan(100)
    expect(output.report.dimensions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'design-system', status: 'needs-review', nextTool: 'design.system' }),
      expect.objectContaining({ id: 'interaction', status: 'needs-review', findingCount: 1, nextTool: 'design.repair' }),
      expect.objectContaining({ id: 'code-readiness', status: 'needs-review', nextTool: 'design.bind_code' })
    ]))
    expect(output.report.recommendations.map((item) => item.toolId)).toEqual(
      expect.arrayContaining(['design.repair', 'design.system', 'design.bind_code'])
    )
    expect(result.summaryLines).toContain(`report: ${output.report.status}, score ${output.report.score}`)
  })

  it('recommends export when no critique blockers are present', () => {
    const result = executeDesignToolInvocation({
      toolId: 'design.critique',
      input: { attachNotes: false }
    })
    const output = result.output as {
      report: {
        status: string
        dimensions: Array<{ status: string }>
        recommendations: Array<{ toolId: string }>
      }
    }

    expect(output.report.status).toBe('clean')
    expect(output.report.dimensions.every((dimension) => dimension.status === 'pass')).toBe(true)
    expect(output.report.recommendations).toEqual([
      expect.objectContaining({ toolId: 'design.export' })
    ])
  })
})
