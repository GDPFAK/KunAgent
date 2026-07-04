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

describe('design.repair report output', () => {
  it('summarizes automatic repairs by category and next verification step', () => {
    const doc = createEmptyDocument()
    const card = createDefaultShape('rect', 20, 24)
    card.name = 'Metric card'
    card.fills = [{ type: 'solid', color: '#2563eb', opacity: 1 }]
    const button = createDefaultShape('rect', 48, 72)
    button.name = 'Tiny button'
    button.width = 32
    button.height = 28
    doc.objects[card.id] = { ...card, parentId: doc.rootId }
    doc.objects[button.id] = { ...button, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [card.id, button.id] }
    useCanvasShapeStore.getState().loadDocument(doc)
    useDesignSystemStore.getState().loadSystem({
      tokens: { 'brand/primary': { name: 'brand/primary', kind: 'color', value: '#2563eb' } },
      components: {}
    })

    const result = executeDesignToolInvocation({
      toolId: 'design.repair',
      input: { scopeIds: [card.id, button.id] }
    })
    const output = result.output as {
      report: {
        status: string
        mode: string
        findingCount: number
        repairedFindingCount: number
        categories: Array<{ id: string; findingCount: number; repairedCount: number }>
        operationSummaries: Array<{ op: string; targetIds: string[] }>
        recommendations: Array<{ toolId: string }>
      }
    }

    expect(result).toMatchObject({ ok: true, status: 'applied' })
    expect(output.report).toMatchObject({
      status: 'applied',
      mode: 'auto',
      findingCount: 2,
      repairedFindingCount: 2
    })
    expect(output.report.categories).toEqual(expect.arrayContaining([
      { id: 'design-system', findingCount: 1, repairedCount: 1 },
      { id: 'interaction', findingCount: 1, repairedCount: 1 }
    ]))
    expect(output.report.operationSummaries).toEqual(expect.arrayContaining([
      expect.objectContaining({ op: 'apply-token', targetIds: [card.id] }),
      expect.objectContaining({ op: 'resize', targetIds: [button.id] })
    ]))
    expect(output.report.recommendations).toEqual([
      expect.objectContaining({ toolId: 'design.critique' })
    ])
    expect(result.summaryLines).toContain('repair report: applied, repaired 2/2')
  })

  it('reports explicit repair operations separately from auto findings', () => {
    const doc = createEmptyDocument()
    const label = createDefaultShape('text', 10, 20)
    doc.objects[label.id] = { ...label, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [label.id] }
    useCanvasShapeStore.getState().loadDocument(doc)

    const result = executeDesignToolInvocation({
      toolId: 'design.repair',
      input: { ops: [{ op: 'update', id: label.id, patch: { textContent: 'Approved' } }] }
    })
    const output = result.output as {
      report: {
        mode: string
        findingCount: number
        operationSummaries: Array<{ op: string; targetIds: string[] }>
      }
    }

    expect(result).toMatchObject({ ok: true, status: 'applied' })
    expect(output.report.mode).toBe('explicit')
    expect(output.report.findingCount).toBe(0)
    expect(output.report.operationSummaries).toEqual([
      expect.objectContaining({ op: 'update', targetIds: [label.id] })
    ])
  })
})
