import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createHtmlFrameShape, type CanvasDocument } from '../../design/canvas/canvas-types'
import type { DesignArtifact } from '../../design/design-types'
import { DesignPrototypeFlowPanel } from './DesignPrototypeFlowPanel'

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

function addFrame(doc: CanvasDocument, artifactId: string, title: string, x: number): string {
  const frame = createHtmlFrameShape(title, x, 0, artifactId, 'desktop')
  doc.objects[frame.id] = { ...frame, parentId: doc.rootId }
  doc.objects[doc.rootId] = {
    ...doc.objects[doc.rootId],
    children: [...doc.objects[doc.rootId].children, frame.id]
  }
  return frame.id
}

describe('DesignPrototypeFlowPanel', () => {
  it('renders prototype flow edges and health summary', () => {
    const doc = createEmptyDocument()
    const homeFrameId = addFrame(doc, 'home', 'Home', 0)
    addFrame(doc, 'signup', 'Signup', 1500)
    const artifacts = [
      artifact('home', 'Home', {
        prototypeLinks: [{ targetTitle: 'Signup', targetArtifactId: 'signup', href: '../signup/v1.html', label: 'Start' }]
      }),
      artifact('signup', 'Signup')
    ]

    const html = renderToStaticMarkup(createElement(DesignPrototypeFlowPanel, {
      artifacts,
      canvasDocument: doc,
      selectedIds: new Set([homeFrameId]),
      onSeedPrompt: () => {}
    }))

    expect(html).toContain('Prototype flow')
    expect(html).toContain('Home -&gt; Signup')
    expect(html).toContain('Explicit')
    expect(html).toContain('Fallback')
    expect(html).toContain('2 screens')
    expect(html).toContain('1 links')
    expect(html).toContain('Connect prototype flow')
  })

  it('renders nothing without visible screens', () => {
    const html = renderToStaticMarkup(createElement(DesignPrototypeFlowPanel, {
      artifacts: [],
      canvasDocument: createEmptyDocument(),
      selectedIds: new Set<string>()
    }))

    expect(html).toBe('')
  })
})
