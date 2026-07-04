import { describe, expect, it } from 'vitest'
import { createDefaultShape, createEmptyDocument, createHtmlFrameShape } from '../canvas/canvas-types'
import { createRunningAppFrameShape } from '../canvas/running-app-frame'
import type { DesignSystem } from '../canvas/design-system-types'
import { buildDesignGraphFromCanvasDocument } from './design-graph-from-canvas'
import { componentGraphObjectId, tokenGraphObjectId } from './design-system-graph'
import {
  appendDesignOperationJournalEntry,
  clearDesignOperationJournal,
  readDesignOperationJournal,
  shapeOpToDesignOperation
} from './design-operation-journal'
import type { DesignArtifact } from '../design-types'

const createdAt = '2026-07-02T00:00:00.000Z'

function htmlArtifact(id: string): DesignArtifact {
  return {
    id,
    kind: 'html',
    title: 'Checkout',
    relativePath: `.kun-design/doc/${id}/v1.html`,
    createdAt,
    updatedAt: createdAt,
    versions: [{ id: `${id}-v1`, relativePath: `.kun-design/doc/${id}/v1.html`, createdAt, summary: '' }],
    designMdPath: `.kun-design/doc/${id}/DESIGN.md`,
    direction: { id: 'dir_checkout', name: 'Checkout direction', status: 'active', createdAt }
  }
}

describe('design graph', () => {
  it('projects canvas HTML frames into graph objects and directions', () => {
    const doc = createEmptyDocument()
    const frame = createHtmlFrameShape('Draft', 120, 80, 'checkout', 'desktop')
    const label = createDefaultShape('text', 160, 120)
    label.textContent = 'Pay now'
    label.parentId = frame.id
    frame.children = [label.id]
    doc.objects[frame.id] = { ...frame, parentId: doc.rootId }
    doc.objects[label.id] = label
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [frame.id] }
    doc.codeBindings = [
      {
        id: 'binding_1',
        designObjectId: frame.id,
        kind: 'route',
        status: 'active',
        createdAt,
        target: {
          sourceFile: 'src/app/checkout/page.tsx',
          routePath: '/checkout',
          componentName: 'CheckoutPage'
        }
      }
    ]

    const graph = buildDesignGraphFromCanvasDocument(doc, {
      projectId: 'project_1',
      artifacts: [htmlArtifact('checkout')],
      updatedAt: createdAt
    })

    expect(graph.rootObjectIds).toEqual([frame.id])
    expect(graph.objects[frame.id]).toMatchObject({
      kind: 'html-frame',
      name: 'Checkout',
      source: { canvasShapeId: frame.id, htmlArtifactId: 'checkout' },
      bounds: { x: 120, y: 80, width: 1280, height: 800 },
      metadata: {
        codeBindings: [
          {
            id: 'binding_1',
            kind: 'route',
            status: 'active',
            sourceFile: 'src/app/checkout/page.tsx',
            componentName: 'CheckoutPage',
            routePath: '/checkout'
          }
        ]
      }
    })
    expect(graph.objects[label.id].text?.content).toBe('Pay now')
    expect(graph.directions.dir_checkout).toMatchObject({
      name: 'Checkout direction',
      status: 'active',
      objectIds: [frame.id],
      scorecard: {
        directionId: 'dir_checkout',
        readiness: 'needs-review',
        score: 51,
        implementationCost: 'medium',
        screenCount: 1,
        flowCoverage: 1,
        rationaleCount: 1,
        activeBindingCount: 1,
        risks: ['unreviewed', 'not-implemented']
      }
    })
  })

  it('records shape operations as design operation journal entries', () => {
    clearDesignOperationJournal()
    const operation = shapeOpToDesignOperation(
      { op: 'update', id: 'shape_1', patch: { name: 'Hero Card' } },
      'rename-shape'
    )

    appendDesignOperationJournalEntry({
      label: 'rename-shape',
      status: 'applied',
      operations: [operation],
      affectedIds: ['shape_1'],
      errors: []
    })

    const entries = readDesignOperationJournal()
    expect(entries).toHaveLength(1)
    expect(entries[0].operations[0]).toMatchObject({
      type: 'update_shape',
      source: 'agent',
      targetIds: ['shape_1']
    })
  })

  it('projects running app frames as code bridge graph objects', () => {
    const doc = createEmptyDocument()
    const frame = createRunningAppFrameShape({
      x: 40,
      y: 64,
      url: 'localhost:5173/inventory',
      title: 'Inventory app',
      routePath: '/inventory',
      sourceFile: 'src/app/inventory/page.tsx',
      componentName: 'InventoryPage'
    })!
    doc.objects[frame.id] = { ...frame, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [frame.id] }

    const graph = buildDesignGraphFromCanvasDocument(doc, {
      projectId: 'project_1',
      updatedAt: createdAt
    })

    expect(graph.objects[frame.id]).toMatchObject({
      kind: 'running-app-frame',
      name: 'Inventory app',
      source: {
        canvasShapeId: frame.id,
        runningAppUrl: 'http://localhost:5173/inventory'
      },
      metadata: {
        runningApp: {
          routePath: '/inventory',
          sourceFile: 'src/app/inventory/page.tsx',
          componentName: 'InventoryPage'
        }
      }
    })
  })

  it('projects filled image shapes as asset graph objects', () => {
    const doc = createEmptyDocument()
    const image = createDefaultShape('image', 32, 48)
    image.id = 'asset_logo'
    image.name = 'Logo asset'
    image.imageUrl = '.kun-design/assets/logo.png'
    doc.objects[image.id] = { ...image, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [image.id] }

    const graph = buildDesignGraphFromCanvasDocument(doc, {
      projectId: 'project_1',
      updatedAt: createdAt
    })

    expect(graph.objects.asset_logo).toMatchObject({
      kind: 'asset',
      name: 'Logo asset',
      source: {
        canvasShapeId: 'asset_logo',
        assetPath: '.kun-design/assets/logo.png'
      },
      metadata: {
        asset: {
          id: 'asset_logo',
          kind: 'image',
          path: '.kun-design/assets/logo.png',
          sourceKind: 'workspace',
          modelReady: true
        }
      }
    })
  })

  it('projects design system tokens and components into graph objects', () => {
    const doc = createEmptyDocument()
    const button = createDefaultShape('frame', 10, 20)
    button.name = 'Primary button instance'
    button.tokenBindings = { fill: 'brand/primary' }
    button.componentId = 'button'
    button.componentVersion = 2
    doc.objects[button.id] = { ...button, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [button.id] }
    const designSystem: DesignSystem = {
      tokens: {
        'brand/primary': { name: 'brand/primary', kind: 'color', value: '#2563eb' },
        'space/compact': { name: 'space/compact', kind: 'space', value: 8 }
      },
      components: {
        button: {
          id: 'button',
          name: 'Button',
          version: 2,
          tree: [createDefaultShape('frame', 0, 0)],
          slots: [{ path: 'label', kind: 'text' }]
        }
      }
    }

    const graph = buildDesignGraphFromCanvasDocument(doc, {
      projectId: 'project_1',
      designSystem,
      updatedAt: createdAt
    })

    expect(graph.designSystem).toMatchObject({
      tokenCount: 2,
      componentCount: 1,
      tokenUsageCount: 1,
      componentInstanceCount: 1,
      tokens: [
        { name: 'brand/primary', kind: 'color', usageCount: 1, usedBy: [{ objectId: button.id, prop: 'fill' }] },
        { name: 'space/compact', kind: 'space', usageCount: 0 }
      ],
      components: [
        { id: 'button', name: 'Button', version: 2, slotCount: 1, rootShapeCount: 1, usageCount: 1, instanceIds: [button.id] }
      ]
    })
    expect(graph.objects[tokenGraphObjectId('brand/primary')]).toMatchObject({
      kind: 'token',
      name: 'brand/primary',
      source: { tokenName: 'brand/primary' },
      metadata: { kind: 'color', value: '#2563eb', usageCount: 1 }
    })
    expect(graph.objects[componentGraphObjectId('button')]).toMatchObject({
      kind: 'component',
      name: 'Button',
      source: { componentId: 'button' },
      metadata: { version: 2, rootShapeCount: 1, usageCount: 1, instanceIds: [button.id] }
    })
  })
})
