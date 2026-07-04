import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createHtmlFrameShape, type CanvasDocument } from '../canvas/canvas-types'
import type { DesignArtifact } from '../design-types'
import { buildPrototypeFlowPanelModel } from './prototype-flow-panel'

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

describe('buildPrototypeFlowPanelModel', () => {
  it('summarizes explicit, fallback, and unresolved prototype links', () => {
    const doc = createEmptyDocument()
    const homeFrameId = addFrame(doc, 'home', 'Home', 0)
    const signupFrameId = addFrame(doc, 'signup', 'Signup', 1500)
    addFrame(doc, 'settings', 'Settings', 3000)
    const artifacts = [
      artifact('home', 'Home', {
        prototypeLinks: [
          { targetTitle: 'Signup', targetArtifactId: 'signup', href: '../signup/v1.html', label: 'Start' },
          { targetTitle: 'Billing', href: '../billing/v1.html', label: 'Billing' }
        ]
      }),
      artifact('signup', 'Signup'),
      artifact('settings', 'Settings')
    ]

    const model = buildPrototypeFlowPanelModel({ artifacts, doc })

    expect(model).toMatchObject({
      screenCount: 3,
      explicitLinkCount: 2,
      fallbackEdgeCount: 2
    })
    expect(model.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceArtifactId: 'home',
        targetArtifactId: 'signup',
        sourceFrameId: homeFrameId,
        targetFrameId: signupFrameId,
        kind: 'explicit',
        label: 'Start'
      }),
      expect.objectContaining({
        sourceArtifactId: 'signup',
        kind: 'fallback'
      })
    ]))
    expect(model.missingLinks).toEqual([
      expect.objectContaining({ sourceTitle: 'Home', targetTitle: 'Billing', href: '../billing/v1.html' })
    ])
    expect(model.action.disabledReasonKey).toBeUndefined()
    expect(model.action.prompt).toContain('fallback edge(s)')
    expect(model.action.prompt).toContain('Home -> Billing')
  })

  it('blocks the connect action until at least two visible screens exist', () => {
    const doc = createEmptyDocument()
    addFrame(doc, 'home', 'Home', 0)

    const model = buildPrototypeFlowPanelModel({
      artifacts: [artifact('home', 'Home')],
      doc
    })

    expect(model.screenCount).toBe(1)
    expect(model.edges).toEqual([])
    expect(model.action.disabledReasonKey).toBe('designPrototypeFlowNeedsScreens')
  })
})
