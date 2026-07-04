import { describe, expect, it } from 'vitest'
import {
  createDefaultShape,
  createEmptyDocument,
  createHtmlFrameShape,
  type CanvasDocument
} from '../canvas/canvas-types'
import type { DesignSystem } from '../canvas/design-system-types'
import { buildDesignSystemPanelModel } from './design-system-panel-model'

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

describe('buildDesignSystemPanelModel', () => {
  it('recommends creating a design.system template when canvas content exists without a system', () => {
    const doc = createEmptyDocument()
    const frame = createHtmlFrameShape('Home', 0, 0, 'home', 'desktop')
    addToRoot(doc, frame)

    const model = buildDesignSystemPanelModel({
      doc,
      designSystem: { tokens: {}, components: {} },
      selectedIds: new Set(),
      designTarget: 'web'
    })
    const extract = model.actions.find((action) => action.id === 'extract-system')

    expect(model.screenCount).toBe(1)
    expect(extract?.toolId).toBe('design.system')
    expect(extract?.toolInputSeed).toMatchObject({
      action: 'template',
      operation: 'create',
      template: 'saas'
    })
    expect(extract?.disabledReasonKey).toBeUndefined()
  })

  it('switches to update/apply actions for an existing system and selected scope', () => {
    const doc = createEmptyDocument()
    const card = createDefaultShape('rect', 20, 32)
    card.name = 'Pricing card'
    card.fills = [{ type: 'solid', color: '#2563eb', opacity: 1 }]
    card.tokenBindings = { fill: 'brand/primary' }
    addToRoot(doc, card)

    const model = buildDesignSystemPanelModel({
      doc,
      designSystem: systemWithToken(),
      selectedIds: new Set([card.id]),
      designTarget: 'app'
    })
    const extract = model.actions.find((action) => action.id === 'extract-system')
    const apply = model.actions.find((action) => action.id === 'apply-system')
    const validate = model.actions.find((action) => action.id === 'validate-system')

    expect(model.tokenCount).toBe(1)
    expect(model.tokenUsageCount).toBe(1)
    expect(model.selectedCount).toBe(1)
    expect(extract?.toolInputSeed).toMatchObject({
      operation: 'update',
      template: 'app',
      scopeIds: [card.id]
    })
    expect(apply?.toolInputSeed).toMatchObject({
      operation: 'apply',
      scopeIds: [card.id]
    })
    expect(apply?.disabledReasonKey).toBeUndefined()
    expect(validate?.toolInputSeed).toMatchObject({ action: 'validate', scopeIds: [card.id] })
  })

  it('blocks apply-to-selection until both a selection and system exist', () => {
    const model = buildDesignSystemPanelModel({
      doc: createEmptyDocument(),
      designSystem: { tokens: {}, components: {} },
      selectedIds: new Set(),
      designTarget: 'web'
    })
    const apply = model.actions.find((action) => action.id === 'apply-system')

    expect(apply?.disabledReasonKey).toBe('designSystemPanelNeedsSelection')
  })
})
