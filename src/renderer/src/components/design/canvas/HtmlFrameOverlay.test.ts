import { describe, expect, it } from 'vitest'
import {
  HTML_FRAME_CONTENT_SIZE_QUERY,
  buildHtmlFrameScrollbarSuppressionScript,
  executeHtmlFrameWebviewScript,
  htmlFrameAllowsWidthAutoGrow,
  htmlFrameDrawingActive,
  htmlFrameOverlayPointerEvents,
  htmlFrameShouldSuppressDocumentScrollbars,
  htmlFrameVisualCanvasHeight,
  htmlFrameWebviewZoomFactor,
  resolveHtmlFrameMeasurementDecision,
  shouldAutoResizeHtmlFrame,
  shouldRenderHtmlFrameWebview
} from './HtmlFrameOverlay'
import { inferDesignArtifactFoundationRole } from '../../../design/design-types'

class FakeHTMLElement {
  tagName: string
  childNodes: unknown[]
  style: Record<string, string | number>
  rect: { width: number; height: number; bottom: number; right?: number }
  scrollWidth = 420
  offsetWidth = 420
  clientWidth = 420
  scrollHeight = 844
  offsetHeight = 844
  clientHeight = 844
  private descendants: FakeHTMLElement[]

  constructor(
    tagName: string,
    rect: { width: number; height: number; bottom: number; right?: number },
    options: {
      childNodes?: unknown[]
      style?: Record<string, string | number>
      descendants?: FakeHTMLElement[]
    } = {}
  ) {
    this.tagName = tagName.toUpperCase()
    this.rect = rect
    this.childNodes = options.childNodes ?? []
    this.style = options.style ?? {}
    this.descendants = options.descendants ?? []
  }

  getBoundingClientRect(): { width: number; height: number; bottom: number; right: number } {
    return { ...this.rect, right: this.rect.right ?? this.rect.width }
  }

  querySelectorAll(): FakeHTMLElement[] {
    return this.descendants
  }
}

class FakeSVGElement extends FakeHTMLElement {}

type FakeTextNode = {
  nodeType: number
  textContent: string
  rects: Array<{ width: number; height: number; bottom: number; right?: number }>
}

function runContentSizeQuery(
  body: FakeHTMLElement,
  options: { innerHeight?: number } = {}
): {
  width: number
  height: number
  documentHeight: number
  paintedHeight: number
  paintedWidth: number
} {
  const html = new FakeHTMLElement('html', { width: 420, height: 844, bottom: 844 })
  const fakeDocument = {
    documentElement: html,
    body,
    createRange: () => {
      let selected: FakeTextNode | null = null
      return {
        selectNodeContents: (node: FakeTextNode) => {
          selected = node
        },
        getClientRects: () => selected?.rects ?? [],
        detach: () => undefined
      }
    }
  }
  const fakeWindow = {
    scrollY: 0,
    scrollX: 0,
    innerWidth: 420,
    innerHeight: options.innerHeight ?? 844,
    getComputedStyle: (el: FakeHTMLElement) => ({
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      paddingBottom: '0',
      borderBottomWidth: '0',
      backgroundColor: 'transparent',
      backgroundImage: 'none',
      ...el.style
    })
  }
  const fakeNode = { TEXT_NODE: 3 }
  const execute = new Function(
    'document',
    'window',
    'Node',
    'HTMLElement',
    'SVGElement',
    `return ${HTML_FRAME_CONTENT_SIZE_QUERY}`
  )
  return execute(fakeDocument, fakeWindow, fakeNode, FakeHTMLElement, FakeSVGElement) as {
    width: number
    height: number
    documentHeight: number
    paintedHeight: number
    paintedWidth: number
  }
}

describe('HtmlFrameOverlay preview gating', () => {
  it('mounts the webview for skeleton placeholders before the first stable HTML lands', () => {
    expect(shouldRenderHtmlFrameWebview({
      fileUrl: 'file:///workspace/.kun-design/screen/v1.html',
      previewState: 'skeleton',
      hasRenderableContent: false
    })).toBe(true)
  })

  it('does not mount a webview without an authorized file URL', () => {
    expect(shouldRenderHtmlFrameWebview({
      fileUrl: '',
      previewState: 'skeleton',
      hasRenderableContent: false
    })).toBe(false)
  })

  it('keeps transient partial HTML off-screen until the first renderable revision exists', () => {
    expect(shouldRenderHtmlFrameWebview({
      fileUrl: 'file:///workspace/.kun-design/screen/v1.html',
      previewState: 'transient',
      hasRenderableContent: false
    })).toBe(false)
  })

  it('keeps showing the last good preview while later writes are transient', () => {
    expect(shouldRenderHtmlFrameWebview({
      fileUrl: 'file:///workspace/.kun-design/screen/v1.html',
      previewState: 'transient',
      hasRenderableContent: true
    })).toBe(true)
  })
})

describe('HtmlFrameOverlay pointer event policy', () => {
  it('lets the canvas receive drag events in normal selected-preview mode', () => {
    expect(htmlFrameOverlayPointerEvents({ panning: false, interactive: false, editing: false })).toBe('none')
  })

  it('captures events only for explicit interactive or edit modes', () => {
    expect(htmlFrameOverlayPointerEvents({ panning: false, interactive: true, editing: false })).toBe('auto')
    expect(htmlFrameOverlayPointerEvents({ panning: false, interactive: false, editing: true })).toBe('auto')
  })

  it('keeps hand-tool panning pass-through even when a frame mode is active', () => {
    expect(htmlFrameOverlayPointerEvents({ panning: true, interactive: true, editing: true })).toBe('none')
  })
})

describe('HtmlFrameOverlay webview native zoom factor', () => {
  it('passes normal zoom levels through unchanged', () => {
    expect(htmlFrameWebviewZoomFactor(1)).toBe(1)
    expect(htmlFrameWebviewZoomFactor(0.35)).toBe(0.35)
    expect(htmlFrameWebviewZoomFactor(2)).toBe(2)
  })

  it('clamps to a safe range and falls back for invalid input', () => {
    expect(htmlFrameWebviewZoomFactor(0)).toBe(1)
    expect(htmlFrameWebviewZoomFactor(-1)).toBe(1)
    expect(htmlFrameWebviewZoomFactor(Number.NaN)).toBe(1)
    expect(htmlFrameWebviewZoomFactor(0.001)).toBe(0.05)
    expect(htmlFrameWebviewZoomFactor(50)).toBe(4)
  })
})

describe('HtmlFrameOverlay visual crop policy', () => {
  it('keeps the full frame visible before measurement', () => {
    expect(htmlFrameVisualCanvasHeight(844, null)).toBe(844)
  })

  it('crops frames to measured content even while the preview is generating', () => {
    expect(htmlFrameVisualCanvasHeight(844, 260)).toBe(260)
    expect(htmlFrameVisualCanvasHeight(844, 240)).toBe(240)
    expect(htmlFrameVisualCanvasHeight(844, 80)).toBe(180)
    expect(htmlFrameVisualCanvasHeight(844, 1200)).toBe(844)
  })
})

describe('HtmlFrameOverlay content measurement query', () => {
  it('measures painted text instead of preserving a full-height blank container', () => {
    const titleText: FakeTextNode = {
      nodeType: 3,
      textContent: '品牌色彩 / Brand Colors',
      rects: [{ width: 260, height: 28, bottom: 128 }]
    }
    const title = new FakeHTMLElement('h1', { width: 320, height: 34, bottom: 132 }, {
      childNodes: [titleText]
    })
    const blankFullHeightSection = new FakeHTMLElement('section', { width: 420, height: 844, bottom: 844 }, {
      style: { backgroundColor: '#ffffff' }
    })
    const body = new FakeHTMLElement('body', { width: 420, height: 844, bottom: 844 }, {
      descendants: [title, blankFullHeightSection]
    })

    const measured = runContentSizeQuery(body)

    expect(measured.width).toBe(420)
    expect(measured.documentHeight).toBe(844)
    expect(measured.height).toBeLessThan(180)
    expect(htmlFrameShouldSuppressDocumentScrollbars({
      measuredHeight: measured.height,
      documentHeight: measured.documentHeight
    })).toBe(true)
  })

  it('keeps meaningful large background images in the measured height', () => {
    const hero = new FakeHTMLElement('section', { width: 420, height: 640, bottom: 640 }, {
      style: {
        backgroundColor: '#ffffff',
        backgroundImage: 'url(hero.jpg)'
      }
    })
    const body = new FakeHTMLElement('body', { width: 420, height: 844, bottom: 844 }, {
      descendants: [hero]
    })

    const measured = runContentSizeQuery(body)

    expect(measured.height).toBe(656)
    expect(htmlFrameShouldSuppressDocumentScrollbars({
      measuredHeight: measured.height,
      documentHeight: measured.documentHeight
    })).toBe(true)
  })

  it('does not let a previously-shrunk viewport height feed back into excluding real content', () => {
    // The <webview> host resizes this frame's CSS height to whatever was last
    // measured, so window.innerHeight reflects OUR prior measurement, not an
    // independent fact about the page. A threshold anchored to window.innerHeight
    // would exclude this legitimate ~500px section once the frame had been
    // shrunk once, permanently converging on a too-small height. The fix anchors
    // the threshold to documentHeight (scrollHeight-based), which stays correct
    // regardless of the frame's current (possibly still-wrong) CSS size.
    const heroText: FakeTextNode = {
      nodeType: 3,
      textContent: '欢迎回来',
      rects: [{ width: 120, height: 24, bottom: 64 }]
    }
    const header = new FakeHTMLElement('h1', { width: 300, height: 30, bottom: 64 }, {
      childNodes: [heroText]
    })
    const hero = new FakeHTMLElement('section', { width: 420, height: 500, bottom: 564 }, {
      style: { backgroundColor: '#112233' }
    })
    const body = new FakeHTMLElement('body', { width: 420, height: 3200, bottom: 3200 }, {
      descendants: [header, hero]
    })
    body.scrollHeight = 3200
    body.offsetHeight = 3200
    body.clientHeight = 3200

    const healthyViewport = runContentSizeQuery(body, { innerHeight: 3200 })
    expect(healthyViewport.height).toBeGreaterThanOrEqual(564)

    const afterPriorShrink = runContentSizeQuery(body, { innerHeight: 180 })
    expect(afterPriorShrink.height).toBe(healthyViewport.height)
  })

  it('measures painted width so auto frames can reveal wide HTML content', () => {
    const widePanel = new FakeHTMLElement('section', { width: 1180, height: 300, bottom: 300, right: 1180 }, {
      style: {
        backgroundColor: '#ffffff'
      }
    })
    const body = new FakeHTMLElement('body', { width: 420, height: 844, bottom: 844 }, {
      descendants: [widePanel]
    })

    const measured = runContentSizeQuery(body)

    expect(measured.width).toBe(1180)
    expect(measured.paintedWidth).toBe(1180)
  })
})

describe('HtmlFrameOverlay internal scrollbar suppression', () => {
  it('only suppresses scrollbars when the document has a blank tail beyond painted content', () => {
    expect(htmlFrameShouldSuppressDocumentScrollbars({
      measuredHeight: 180,
      documentHeight: 844
    })).toBe(true)
    expect(htmlFrameShouldSuppressDocumentScrollbars({
      measuredHeight: 844,
      documentHeight: 850
    })).toBe(false)
  })

  it('builds a reversible webview scrollbar style injection', () => {
    expect(buildHtmlFrameScrollbarSuppressionScript(true)).toContain('overflow: hidden')
    expect(buildHtmlFrameScrollbarSuppressionScript(false)).toContain('existing.remove()')
  })
})

describe('HtmlFrameOverlay webview script execution', () => {
  it('absorbs Electron sync throws before dom-ready', () => {
    expect(
      executeHtmlFrameWebviewScript({
        executeJavaScript: () => {
          throw new Error('The WebView must be attached to the DOM and the dom-ready event emitted')
        }
      }, 'true')
    ).toBeNull()
  })

  it('returns the guest promise once the webview accepts scripts', async () => {
    await expect(
      executeHtmlFrameWebviewScript({
        executeJavaScript: async () => 42
      }, 'true')
    ).resolves.toBe(42)
  })
})

describe('HtmlFrameOverlay measurement decision', () => {
  it('turns a tall blank document tail into an auto-cropped frame and scrollbar suppression', () => {
    expect(resolveHtmlFrameMeasurementDecision({
      width: 420,
      height: 141,
      documentHeight: 844
    })).toEqual({
      nextWidth: 420,
      nextHeight: 180,
      documentHeight: 844,
      suppressScrollbars: true
    })
  })

  it('does not suppress scrollbars when measured content and document height match', () => {
    expect(resolveHtmlFrameMeasurementDecision({
      width: 420,
      height: 844,
      documentHeight: 850
    })).toEqual({
      nextWidth: 420,
      nextHeight: 844,
      documentHeight: 850,
      suppressScrollbars: false
    })
  })

  it('ignores invalid webview measurements', () => {
    expect(resolveHtmlFrameMeasurementDecision(null)).toBeNull()
    expect(resolveHtmlFrameMeasurementDecision({ height: Number.NaN })).toBeNull()
    expect(resolveHtmlFrameMeasurementDecision({ width: Number.NaN, height: 844 })).toBeNull()
  })
})

describe('HtmlFrameOverlay width auto-grow policy', () => {
  it('lets foundation reference docs (design system / logo) auto-grow width', () => {
    expect(htmlFrameAllowsWidthAutoGrow('design-system')).toBe(true)
    expect(htmlFrameAllowsWidthAutoGrow('logo')).toBe(true)
  })

  it('pins regular screens to their fixed device width regardless of measured content', () => {
    // Regular screens represent a fixed device viewport (e.g. a 390px phone
    // mockup). Letting their width follow measured content produced wildly
    // inconsistent per-screen widths (window.innerWidth-based measurement can
    // race with the webview's native zoom factor applying).
    expect(htmlFrameAllowsWidthAutoGrow(undefined)).toBe(false)
  })
})

describe('HtmlFrameOverlay auto resize policy', () => {
  it('keeps normal manual frames fixed but migrates foundation frames back to auto sizing', () => {
    expect(shouldAutoResizeHtmlFrame({ sizeMode: 'manual', previewStatus: 'ready' })).toBe(false)
    expect(shouldAutoResizeHtmlFrame({
      sizeMode: 'manual',
      role: 'design-system',
      previewStatus: 'ready'
    })).toBe(true)
    expect(shouldAutoResizeHtmlFrame({
      sizeMode: 'manual',
      role: 'logo',
      previewStatus: 'ready'
    })).toBe(true)
    expect(shouldAutoResizeHtmlFrame({
      sizeMode: 'manual',
      role: inferDesignArtifactFoundationRole({ title: '设计系统' }),
      previewStatus: 'ready'
    })).toBe(true)
  })

  it('keeps pending and running frames auto-sized while generation is active', () => {
    expect(shouldAutoResizeHtmlFrame({ sizeMode: 'manual', previewStatus: 'pending' })).toBe(true)
    expect(shouldAutoResizeHtmlFrame({ sizeMode: 'manual', parallelStatus: 'running' })).toBe(true)
  })
})

describe('HtmlFrameOverlay drawing state', () => {
  it('does not keep a finished design-system frame in drawing mode while the logo step runs', () => {
    expect(htmlFrameDrawingActive({
      foundationRole: 'design-system',
      previewStatus: 'pending',
      pagesRunPhase: 'foundation',
      pagesRunStep: 'logo',
      chatBusy: true
    })).toBe(false)
  })

  it('keeps only the matching foundation artifact in drawing mode', () => {
    expect(htmlFrameDrawingActive({
      foundationRole: 'logo',
      previewStatus: 'pending',
      pagesRunPhase: 'foundation',
      pagesRunStep: 'logo',
      chatBusy: true
    })).toBe(true)
  })

  it('keeps normal pending screens drawing only while their turn is busy', () => {
    expect(htmlFrameDrawingActive({ previewStatus: 'pending', chatBusy: true })).toBe(true)
    expect(htmlFrameDrawingActive({ previewStatus: 'pending', chatBusy: false })).toBe(false)
  })
})
