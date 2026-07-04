import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  createDefaultShape,
  createEmptyDocument,
  createHtmlFrameShape,
  type CanvasDocument,
  type CanvasShape
} from '../../design/canvas/canvas-types'
import type { DesignArtifact } from '../../design/design-types'
import { DesignReferencePanel } from './DesignReferencePanel'

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

function addShape(doc: CanvasDocument, shape: CanvasShape): CanvasShape {
  const next = { ...shape, parentId: doc.rootId }
  doc.objects[next.id] = next
  doc.objects[doc.rootId] = {
    ...doc.objects[doc.rootId],
    children: [...doc.objects[doc.rootId].children, next.id]
  }
  return next
}

describe('DesignReferencePanel', () => {
  it('renders project memory images, screens, and summary', () => {
    const doc = createEmptyDocument()
    const image = addShape(doc, {
      ...createDefaultShape('image', 0, 0),
      name: 'Hero reference',
      imageUrl: '.kun-design/assets/hero.png'
    })
    addShape(doc, createHtmlFrameShape('Home', 500, 0, 'home'))
    const artifacts = [
      artifact('home', 'Home', {
        designMdPath: '.kun-design/doc/home/DESIGN.md',
        prototypeLinks: [{ targetTitle: 'Checkout', href: '../checkout/v1.html' }]
      })
    ]

    const html = renderToStaticMarkup(createElement(DesignReferencePanel, {
      artifacts,
      canvasDocument: doc,
      selectedIds: new Set([image.id]),
      onSeedPrompt: () => {}
    }))

    expect(html).toContain('Project memory')
    expect(html).toContain('Hero reference')
    expect(html).toContain('Home')
    expect(html).toContain('Workspace')
    expect(html).toContain('1 images')
    expect(html).toContain('1 screens')
    expect(html).toContain('Use project memory')
  })

  it('renders nothing without references', () => {
    const html = renderToStaticMarkup(createElement(DesignReferencePanel, {
      artifacts: [],
      canvasDocument: createEmptyDocument(),
      selectedIds: new Set<string>()
    }))

    expect(html).toBe('')
  })
})
