import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasShapeStore } from '../canvas/canvas-shape-store'
import {
  createDefaultShape,
  createEmptyDocument,
  type CanvasDocument
} from '../canvas/canvas-types'
import { useDesignSystemStore } from '../canvas/design-system-store'
import type { DesignSystem } from '../canvas/design-system-types'
import { useDesignWorkspaceStore } from '../design-workspace-store'
import { clearDesignOperationJournal } from '../graph/design-operation-journal'
import {
  buildDesignToolRunPanelModel,
  runDesignToolPanelAction
} from './design-tool-run-panel'

function addToRoot(doc: CanvasDocument, ...shapes: ReturnType<typeof createDefaultShape>[]): void {
  for (const shape of shapes) {
    doc.objects[shape.id] = { ...shape, parentId: doc.rootId }
  }
  doc.objects[doc.rootId] = {
    ...doc.objects[doc.rootId],
    children: shapes.map((shape) => shape.id)
  }
}

function systemWithToken(): DesignSystem {
  return {
    tokens: {
      'brand/primary': { name: 'brand/primary', kind: 'color', value: '#2563eb' }
    },
    components: {}
  }
}

describe('design tool run panel model', () => {
  beforeEach(() => {
    clearDesignOperationJournal()
    useCanvasShapeStore.setState({ document: createEmptyDocument(), documentKey: null })
    useDesignSystemStore.setState({ system: { tokens: {}, components: {} } })
    useDesignWorkspaceStore.setState({
      documents: [],
      activeDocumentId: null,
      artifacts: [],
      designContext: { designTarget: 'web' }
    })
  })

  it('builds local design tool actions for a selected lintable scope', () => {
    const doc = createEmptyDocument()
    const card = createDefaultShape('rect', 20, 32)
    card.name = 'CTA card'
    card.fills = [{ type: 'solid', color: '#2563eb', opacity: 1 }]
    addToRoot(doc, card)

    const model = buildDesignToolRunPanelModel({
      doc,
      designSystem: systemWithToken(),
      selectedIds: new Set([card.id]),
      title: 'Checkout'
    })
    const repair = model.actions.find((action) => action.id === 'repair-current')
    const validate = model.actions.find((action) => action.id === 'validate-system')
    const exported = model.actions.find((action) => action.id === 'export-package')

    expect(model).toMatchObject({
      objectCount: 1,
      selectedCount: 1,
      lintFindingCount: 1,
      unresolvedNoteCount: 0
    })
    expect(repair?.disabledReasonKey).toBeUndefined()
    expect(repair?.toolInputSeed).toMatchObject({ scopeIds: [card.id], maxFindings: 8 })
    expect(validate?.toolInputSeed).toMatchObject({ action: 'validate', scopeIds: [card.id] })
    expect(exported?.toolInputSeed).toMatchObject({ format: 'package', title: 'Checkout' })
  })

  it('keeps mutation-oriented tools disabled without canvas content or findings', () => {
    const model = buildDesignToolRunPanelModel({
      doc: createEmptyDocument(),
      designSystem: { tokens: {}, components: {} },
      selectedIds: new Set()
    })

    expect(model.actions.find((action) => action.id === 'plan-next')?.disabledReasonKey).toBeUndefined()
    expect(model.actions.find((action) => action.id === 'critique-current')?.disabledReasonKey)
      .toBe('designToolsNeedsContent')
    expect(model.actions.find((action) => action.id === 'repair-current')?.disabledReasonKey)
      .toBe('designToolsNeedsFindings')
  })

  it('runs a local design.plan action through the tool protocol executor', () => {
    const doc = createEmptyDocument()
    const frame = createDefaultShape('frame', 10, 20)
    addToRoot(doc, frame)
    useCanvasShapeStore.getState().loadDocument(doc)

    const action = buildDesignToolRunPanelModel({
      doc,
      designSystem: { tokens: {}, components: {} },
      selectedIds: new Set()
    }).actions.find((item) => item.id === 'plan-next')
    const result = runDesignToolPanelAction(action!)

    expect(result).toMatchObject({
      ok: true,
      toolId: 'design.plan',
      status: 'ready',
      errors: []
    })
    expect(result.summaryLines.join('\n')).toContain('design.plan')
  })
})
