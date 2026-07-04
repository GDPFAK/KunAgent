import { describe, expect, it } from 'vitest'
import {
  createDefaultShape,
  createEmptyDocument,
  createHtmlFrameShape,
  type CanvasDocument,
  type CanvasShape
} from '../canvas/canvas-types'
import type { DesignArtifact } from '../design-types'
import { buildDesignReferencePanelModel } from './design-reference-panel'

const createdAt = '2026-07-02T00:00:00.000Z'

function artifact(id: string, title: string, extra: Partial<DesignArtifact> = {}): DesignArtifact {
  const relativePath = `.kun-design/doc/${id}/v1.html`
  return {
    id,
    kind: 'html',
    title,
    relativePath,
    createdAt,
    updatedAt: createdAt,
    versions: [{ id: `${id}-v1`, relativePath, createdAt, summary: '' }],
    ...extra
  }
}

function addShape(doc: CanvasDocument, shape: CanvasShape, parentId = doc.rootId): CanvasShape {
  const next = { ...shape, parentId }
  doc.objects[next.id] = next
  doc.objects[parentId] = {
    ...doc.objects[parentId],
    children: [...doc.objects[parentId].children, next.id]
  }
  return next
}

describe('buildDesignReferencePanelModel', () => {
  it('summarizes canvas images, screen artifacts, notes, and selected references', () => {
    const doc = createEmptyDocument()
    const moodboard = addShape(doc, { ...createDefaultShape('frame', 0, 0), name: 'Moodboard' })
    const hero = addShape(doc, {
      ...createDefaultShape('image', 24, 24),
      name: 'Hero reference',
      width: 320,
      height: 180,
      imageUrl: '.kun-design/assets/hero.png'
    }, moodboard.id)
    addShape(doc, {
      ...createDefaultShape('image', 400, 24),
      name: 'External product',
      imageUrl: 'https://example.com/product.png'
    })
    addShape(doc, {
      ...createDefaultShape('text', 0, 300),
      name: 'Review note',
      agentNote: { kind: 'decision', body: 'Keep the soft product shadow.', resolved: false }
    })
    const homeFrame = addShape(doc, createHtmlFrameShape('Home', 800, 0, 'home'))
    const artifacts = [
      artifact('home', 'Home', {
        designMdPath: '.kun-design/doc/home/DESIGN.md',
        prototypeLinks: [{ targetTitle: 'Checkout', targetArtifactId: 'checkout', href: '../checkout/v1.html' }],
        direction: { id: 'd1', name: 'Warm marketplace', status: 'active' }
      }),
      artifact('checkout', 'Checkout')
    ]

    const model = buildDesignReferencePanelModel({
      artifacts,
      doc,
      selectedIds: new Set([hero.id, homeFrame.id])
    })

    expect(model).toMatchObject({
      imageCount: 2,
      screenCount: 2,
      noteCount: 1,
      designMdCount: 1,
      workspaceImageCount: 1,
      selectedCount: 2,
      totalCount: 5
    })
    expect(model.images[0]).toMatchObject({
      id: hero.id,
      source: 'workspace',
      parentName: 'Moodboard',
      active: true
    })
    expect(model.screens[0]).toMatchObject({
      id: 'home',
      frameId: homeFrame.id,
      designMdPath: '.kun-design/doc/home/DESIGN.md',
      directionName: 'Warm marketplace',
      prototypeLinkCount: 1,
      active: true
    })
    expect(model.action.disabledReasonKey).toBeUndefined()
    expect(model.action.prompt).toContain('.kun-design/assets/hero.png')
    expect(model.action.prompt).toContain('.kun-design/doc/home/DESIGN.md')
  })

  it('disables the action when no project memory exists', () => {
    const model = buildDesignReferencePanelModel({
      artifacts: [],
      doc: createEmptyDocument(),
      selectedIds: new Set<string>()
    })

    expect(model.totalCount).toBe(0)
    expect(model.action.disabledReasonKey).toBe('designReferencesNeedsContext')
  })
})
