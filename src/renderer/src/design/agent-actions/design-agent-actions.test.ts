import { describe, expect, it } from 'vitest'
import { createDefaultShape, createEmptyDocument, createHtmlFrameShape } from '../canvas/canvas-types'
import type { DesignSystem } from '../canvas/design-system-types'
import { createRunningAppFrameShape } from '../canvas/running-app-frame'
import type { DesignDocument } from '../design-types'
import { buildDesignAgentActions, buildRecommendedDesignWorkflowAction } from './design-agent-actions'

function designDocument(): DesignDocument {
  return {
    id: 'doc_1',
    title: 'Checkout redesign',
    createdAt: '2026-07-02T12:00:00.000Z',
    updatedAt: '2026-07-02T12:00:00.000Z',
    order: 0,
    artifacts: [],
    activeArtifactId: null
  }
}

describe('design agent actions', () => {
  it('always offers direction exploration with target context', () => {
    const actions = buildDesignAgentActions({
      doc: createEmptyDocument(),
      selectedIds: new Set(),
      designTarget: 'web'
    })

    expect(actions[0]).toMatchObject({
      id: 'explore-directions',
      intentMode: 'generate'
    })
    expect(actions[0]?.prompt).toContain('Design target: web.')
    expect(actions[0]?.prompt).toContain('design.ops')
    expect(actions[0]?.prompt).toContain('Design Operation Journal')
    expect(actions[0]?.disabledReasonKey).toBeUndefined()
  })

  it('builds a workflow recommendation action from the design mode manifest', () => {
    const action = buildRecommendedDesignWorkflowAction({
      document: designDocument(),
      doc: createEmptyDocument(),
      selectedIds: new Set(),
      designTarget: 'web'
    })

    expect(action).toMatchObject({
      id: 'workflow-next-step',
      intentMode: 'generate',
      labelKey: 'designAgentActionWorkflowNext'
    })
    expect(action?.prompt).toContain('Recommended design-mode workflow step: plan-directions.')
    expect(action?.prompt).toContain('Surface: agent. Tool: design.plan.')
    expect(action?.prompt).toContain('Suggested tool call: design.plan')
    expect(action?.prompt).toContain('"goal":"Plan named design directions')
    expect(action?.prompt).toContain('Prefer design.ops')
    expect(action?.prompt).toContain('Current counts: 0 screen(s), 0 direction(s)')
    expect(action?.prompt).toContain('Surface health:')
    expect(action?.prompt).toContain('Workflow:')
  })

  it('recommends design system extraction after screens and directions exist', () => {
    const doc = createEmptyDocument()
    const home = createHtmlFrameShape('Home', 0, 0, 'artifact_home', 'desktop')
    doc.objects[home.id] = { ...home, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [home.id] }

    const action = buildRecommendedDesignWorkflowAction({
      document: designDocument(),
      artifacts: [{
        id: 'artifact_home',
        kind: 'html',
        title: 'Home',
        relativePath: '.kun-design/doc_1/home/v1.html',
        createdAt: '2026-07-02T12:00:00.000Z',
        updatedAt: '2026-07-02T12:00:00.000Z',
        versions: [],
        direction: { id: 'direction_modern', name: 'Modern dashboard' }
      }],
      doc,
      selectedIds: new Set([home.id]),
      designTarget: 'app',
      designSystem: { tokens: {}, components: {} }
    })

    expect(action?.prompt).toContain('Recommended design-mode workflow step: extract-design-system.')
    expect(action?.prompt).toContain('Design target: app.')
    expect(action?.prompt).toContain('Suggested tool call: design.system')
    expect(action?.prompt).toContain('"action":"template"')
    expect(action?.prompt).toContain('1 screen(s), 1 direction(s)')
  })

  it('enables componentization only when there is a selection', () => {
    const doc = createEmptyDocument()
    const button = createDefaultShape('rect', 0, 0)
    button.name = 'CTA button'
    doc.objects[button.id] = { ...button, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [button.id] }

    const disabled = buildDesignAgentActions({
      doc,
      selectedIds: new Set(),
      designTarget: 'web'
    }).find((action) => action.id === 'componentize-selection')
    const enabled = buildDesignAgentActions({
      doc,
      selectedIds: new Set([button.id]),
      designTarget: 'web'
    }).find((action) => action.id === 'componentize-selection')

    expect(disabled?.disabledReasonKey).toBe('designAgentActionNeedsSelection')
    expect(enabled?.disabledReasonKey).toBeUndefined()
    expect(enabled?.prompt).toContain('CTA button')
  })

  it('offers design-system extraction with graph usage context', () => {
    const doc = createEmptyDocument()
    const button = createDefaultShape('frame', 0, 0)
    button.name = 'Primary CTA'
    button.tokenBindings = { fill: 'brand/primary' }
    button.componentId = 'button'
    doc.objects[button.id] = { ...button, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [button.id] }
    const designSystem: DesignSystem = {
      tokens: {
        'brand/primary': { name: 'brand/primary', kind: 'color', value: '#2563eb' }
      },
      components: {
        button: {
          id: 'button',
          name: 'Button',
          version: 1,
          tree: [button],
          slots: [{ path: 'label', kind: 'text' }]
        }
      }
    }

    const action = buildDesignAgentActions({
      doc,
      selectedIds: new Set([button.id]),
      designTarget: 'web',
      designSystem
    }).find((item) => item.id === 'extract-design-system')

    expect(action?.disabledReasonKey).toBeUndefined()
    expect(action?.prompt).toContain('Design-system graph: 1 token(s), 1 component(s)')
    expect(action?.prompt).toContain('brand/primary')
    expect(action?.prompt).toContain('component Button')
    expect(action?.prompt).toContain('define-token')
    expect(action?.prompt).toContain('define-component')
    expect(action?.prompt).toContain('variant-matrix')
  })

  it('enables structured critique only when there is a selection', () => {
    const doc = createEmptyDocument()
    const frame = createDefaultShape('frame', 0, 0)
    frame.name = 'Checkout frame'
    doc.objects[frame.id] = { ...frame, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [frame.id] }

    const disabled = buildDesignAgentActions({
      doc,
      selectedIds: new Set(),
      designTarget: 'web'
    }).find((action) => action.id === 'critique-selection')
    const enabled = buildDesignAgentActions({
      doc,
      selectedIds: new Set([frame.id]),
      designTarget: 'web'
    }).find((action) => action.id === 'critique-selection')

    expect(disabled?.disabledReasonKey).toBe('designAgentActionNeedsSelection')
    expect(enabled?.disabledReasonKey).toBeUndefined()
    expect(enabled?.prompt).toContain('Checkout frame')
    expect(enabled?.prompt).toContain('agentNote payload')
    expect(enabled?.prompt).toContain('targetIds')
  })

  it('enables prototype flow only when at least two html frames exist', () => {
    const doc = createEmptyDocument()
    const home = createHtmlFrameShape('Home', 0, 0, 'artifact_home', 'desktop')
    const checkout = createHtmlFrameShape('Checkout', 500, 0, 'artifact_checkout', 'desktop')
    doc.objects[home.id] = { ...home, parentId: doc.rootId }
    doc.objects[checkout.id] = { ...checkout, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [home.id, checkout.id] }

    const action = buildDesignAgentActions({
      doc,
      selectedIds: new Set(),
      designTarget: 'app'
    }).find((item) => item.id === 'prototype-flow')

    expect(action?.disabledReasonKey).toBeUndefined()
    expect(action?.prompt).toContain('Design target: app.')
  })

  it('enables live app binding when a running app frame exists', () => {
    const doc = createEmptyDocument()
    const live = createRunningAppFrameShape({
      x: 0,
      y: 0,
      url: 'localhost:5173/dashboard',
      title: 'Dashboard live',
      routePath: '/dashboard',
      sourceFile: 'src/app/dashboard/page.tsx'
    })!
    doc.objects[live.id] = { ...live, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [live.id] }

    const disabled = buildDesignAgentActions({
      doc: createEmptyDocument(),
      selectedIds: new Set(),
      designTarget: 'web'
    }).find((action) => action.id === 'bind-live-app')
    const enabled = buildDesignAgentActions({
      doc,
      selectedIds: new Set([live.id]),
      designTarget: 'web'
    }).find((action) => action.id === 'bind-live-app')

    expect(disabled?.disabledReasonKey).toBe('designAgentActionNeedsLiveApp')
    expect(enabled?.disabledReasonKey).toBeUndefined()
    expect(enabled?.prompt).toContain('Dashboard live')
    expect(enabled?.prompt).toContain('http://localhost:5173/dashboard')
    expect(enabled?.prompt).toContain('src/app/dashboard/page.tsx')
    expect(enabled?.prompt).toContain('Live app binding candidates')
    expect(enabled?.prompt).toContain('codeBindings')
  })

  it('enables code bridge repair only with active bindings and operation journal', () => {
    const doc = createEmptyDocument()
    doc.operationJournal = [{
      id: 'journal_1',
      label: 'Edit CTA',
      createdAt: '2026-07-02T12:00:00.000Z',
      status: 'applied',
      operations: [],
      affectedIds: [],
      errors: []
    }]
    doc.codeBindings = [{
      id: 'binding_1',
      designObjectId: 'shape_1',
      kind: 'dom-node',
      status: 'active',
      createdAt: '2026-07-02T12:00:00.000Z',
      target: { sourceFile: 'src/app/page.tsx', onlookId: 'cta' }
    }]

    const action = buildDesignAgentActions({
      doc,
      selectedIds: new Set(),
      designTarget: 'web'
    }).find((item) => item.id === 'repair-code-bridge')

    expect(action?.disabledReasonKey).toBeUndefined()
    expect(action?.prompt).toContain('codeBindings')
  })
})
