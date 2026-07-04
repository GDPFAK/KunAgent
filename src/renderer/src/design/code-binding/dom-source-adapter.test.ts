import { describe, expect, it } from 'vitest'
import { createDefaultShape, createEmptyDocument } from '../canvas/canvas-types'
import {
  applyDomSourceBindingsToCanvasDocument,
  bindingsFromDomSourceSnapshot
} from './dom-source-adapter'
import type { DesignCodeBinding } from './code-binding-types'

const capturedAt = '2026-07-02T00:00:00.000Z'

describe('DOM source adapter', () => {
  it('creates stable active bindings from DOM/source nodes', () => {
    const bindings = bindingsFromDomSourceSnapshot({
      capturedAt,
      matches: [
        {
          designObjectId: 'shape_1',
          node: {
            tagName: 'button',
            text: 'Start trial',
            sourceFile: 'src/app/page.tsx',
            componentName: 'HeroButton',
            onlookId: 'oid_hero_button',
            domId: 'hero-cta'
          }
        }
      ]
    })

    expect(bindings).toHaveLength(1)
    expect(bindings[0]).toMatchObject({
      designObjectId: 'shape_1',
      kind: 'dom-node',
      status: 'active',
      createdAt: capturedAt,
      updatedAt: capturedAt,
      target: {
        sourceFile: 'src/app/page.tsx',
        componentName: 'HeroButton',
        onlookId: 'oid_hero_button',
        domId: 'hero-cta'
      },
      metadata: {
        tagName: 'button',
        text: 'Start trial'
      }
    })
  })

  it('keeps existing binding ids and marks untouched active bindings stale', () => {
    const existing: DesignCodeBinding[] = [
      {
        id: 'binding_existing',
        designObjectId: 'shape_1',
        kind: 'dom-node',
        status: 'active',
        createdAt: '2026-07-01T00:00:00.000Z',
        target: { sourceFile: 'src/app/page.tsx', onlookId: 'oid_1' }
      },
      {
        id: 'binding_other',
        designObjectId: 'shape_2',
        kind: 'component',
        status: 'active',
        createdAt: '2026-07-01T00:00:00.000Z',
        target: { sourceFile: 'src/app/card.tsx', componentName: 'Card' }
      }
    ]

    const bindings = bindingsFromDomSourceSnapshot({
      existingBindings: existing,
      capturedAt,
      matches: [
        {
          designObjectId: 'shape_1',
          node: { tagName: 'div', sourceFile: 'src/app/page.tsx', onlookId: 'oid_1' }
        }
      ]
    })

    expect(bindings.find((binding) => binding.id === 'binding_existing')).toMatchObject({
      status: 'active',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: capturedAt
    })
    expect(bindings.find((binding) => binding.id === 'binding_other')).toMatchObject({
      status: 'stale',
      updatedAt: capturedAt
    })
  })

  it('keeps untouched bindings active outside the requested sync scope', () => {
    const existing: DesignCodeBinding[] = [
      {
        id: 'binding_active_frame',
        designObjectId: 'frame_1',
        kind: 'dom-node',
        status: 'active',
        createdAt: '2026-07-01T00:00:00.000Z',
        target: { sourceFile: '.kun-design/home.html', domId: 'home' }
      },
      {
        id: 'binding_other_frame',
        designObjectId: 'frame_2',
        kind: 'dom-node',
        status: 'active',
        createdAt: '2026-07-01T00:00:00.000Z',
        target: { sourceFile: '.kun-design/settings.html', domId: 'settings' }
      }
    ]

    const bindings = bindingsFromDomSourceSnapshot({
      existingBindings: existing,
      capturedAt,
      scopeDesignObjectIds: ['frame_1'],
      matches: [
        {
          designObjectId: 'frame_1',
          node: { tagName: 'main', sourceFile: '.kun-design/home.html', domId: 'home-v2' }
        }
      ]
    })

    expect(bindings.find((binding) => binding.id === 'binding_active_frame')).toMatchObject({
      status: 'stale',
      updatedAt: capturedAt
    })
    expect(bindings.find((binding) => binding.id === 'binding_other_frame')).toMatchObject({
      status: 'active'
    })
  })

  it('applies generated bindings to a canvas document', () => {
    const doc = createEmptyDocument()
    const rect = createDefaultShape('rect', 0, 0)
    doc.objects[rect.id] = { ...rect, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [rect.id] }

    const next = applyDomSourceBindingsToCanvasDocument(doc, {
      capturedAt,
      matches: [
        {
          designObjectId: rect.id,
          node: { tagName: 'section', routePath: '/checkout', sourceFile: 'src/app/checkout/page.tsx' }
        }
      ]
    })

    expect(next.codeBindings?.[0]).toMatchObject({
      designObjectId: rect.id,
      kind: 'route',
      status: 'active',
      target: {
        routePath: '/checkout',
        sourceFile: 'src/app/checkout/page.tsx'
      }
    })
  })
})
