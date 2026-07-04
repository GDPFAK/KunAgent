import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createHtmlFrameShape } from '../../../design/canvas/canvas-types'
import { createRunningAppFrameShape } from '../../../design/canvas/running-app-frame'
import {
  canvasPortalFramesInCanvasPaintOrder,
  htmlFramesInCanvasPaintOrder,
  selectHtmlFramesForOverlay
} from './HtmlFrameOverlay'

describe('running app canvas portal overlay', () => {
  it('collects running app frames without changing html-only frame queries', () => {
    const doc = createEmptyDocument()
    const html = createHtmlFrameShape('Generated checkout', 0, 0, 'checkout', 'desktop')
    const app = createRunningAppFrameShape({
      x: 1400,
      y: 0,
      url: 'localhost:5173/checkout',
      title: 'Live checkout'
    })!
    doc.objects[html.id] = { ...html, parentId: doc.rootId }
    doc.objects[app.id] = { ...app, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [html.id, app.id] }

    expect(htmlFramesInCanvasPaintOrder(doc).map((shape) => shape.id)).toEqual([html.id])
    expect(canvasPortalFramesInCanvasPaintOrder(doc).map((shape) => shape.id)).toEqual([html.id, app.id])
  })

  it('prioritizes selected running app frames under the active portal cap', () => {
    const doc = createEmptyDocument()
    const first = createHtmlFrameShape('First', 0, 0, 'first', 'desktop')
    const second = createRunningAppFrameShape({ x: 1400, y: 0, url: 'localhost:5173', title: 'Live app' })!
    doc.objects[first.id] = { ...first, parentId: doc.rootId }
    doc.objects[second.id] = { ...second, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [first.id, second.id] }

    const selected = selectHtmlFramesForOverlay(
      canvasPortalFramesInCanvasPaintOrder(doc),
      new Set([first.id]),
      1
    )

    expect(selected.map((shape) => shape.id)).toEqual([first.id])
  })
})
