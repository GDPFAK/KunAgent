import { describe, expect, it } from 'vitest'
import {
  HTML_FRAME_DOM_SOURCE_GUEST_SRC,
  bestHtmlFrameDomSourceNode,
  captureHtmlFrameDomSourceSnapshot,
  htmlFrameDomSourceBindingMatches,
  normalizeHtmlFrameDomSourceSnapshot
} from './html-frame-dom-source'

const rawSnapshot = {
  capturedAt: '2026-07-02T12:00:00.000Z',
  routePath: '/checkout',
  sourceFile: 'src/app/checkout/page.tsx',
  nodes: [
    {
      tagName: 'nav',
      text: 'Navigation',
      rect: { left: 0, top: 0, width: 390, height: 64 }
    },
    {
      tagName: 'section',
      text: 'Checkout Confirm order',
      rect: { left: 16, top: 96, width: 358, height: 520 },
      onlookId: 'ol_checkout_hero',
      componentName: 'CheckoutHero',
      children: [
        {
          tagName: 'button',
          text: 'Pay now',
          rect: { left: 32, top: 480, width: 160, height: 48 },
          domId: 'pay-now'
        }
      ]
    }
  ]
}

describe('HTML frame DOM source capture', () => {
  it('normalizes webview snapshots and picks the strongest source node', () => {
    const snapshot = normalizeHtmlFrameDomSourceSnapshot(rawSnapshot)

    expect(snapshot).toMatchObject({
      capturedAt: rawSnapshot.capturedAt,
      routePath: '/checkout',
      sourceFile: 'src/app/checkout/page.tsx'
    })
    expect(snapshot?.nodes).toHaveLength(2)
    expect(bestHtmlFrameDomSourceNode(snapshot!)).toMatchObject({
      tagName: 'section',
      onlookId: 'ol_checkout_hero',
      componentName: 'CheckoutHero'
    })
  })

  it('creates a frame-level binding match with artifact path fallback', () => {
    const snapshot = normalizeHtmlFrameDomSourceSnapshot({
      capturedAt: rawSnapshot.capturedAt,
      nodes: [
        {
          tagName: 'main',
          text: 'Generated landing page',
          rect: { left: 0, top: 0, width: 1200, height: 900 }
        }
      ]
    })

    const matches = htmlFrameDomSourceBindingMatches({
      shapeId: 'shape_frame',
      artifactRelativePath: '.kun-design/home/index.html',
      snapshot: snapshot!
    })

    expect(matches).toEqual([
      {
        designObjectId: 'shape_frame',
        node: expect.objectContaining({
          tagName: 'main',
          sourceFile: '.kun-design/home/index.html'
        })
      }
    ])
  })

  it('guards script execution failures and exposes a single guest script', async () => {
    await expect(captureHtmlFrameDomSourceSnapshot(() => null)).resolves.toBeNull()
    await expect(captureHtmlFrameDomSourceSnapshot(() => Promise.reject(new Error('detached')))).resolves.toBeNull()
    expect(HTML_FRAME_DOM_SOURCE_GUEST_SRC).toContain('data-onlook-id')
    expect(HTML_FRAME_DOM_SOURCE_GUEST_SRC).toContain('data-kun-source-file')
  })
})
