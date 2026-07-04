import { describe, expect, it } from 'vitest'
import {
  designHtmlPreviewUrl,
  designHtmlPreviewWebviewZoomFactor,
  executeDesignHtmlPreviewScript,
  shouldRenderDesignHtmlPreviewWebview
} from './DesignHtmlPreviewHost'

describe('DesignHtmlPreviewHost helpers', () => {
  it('renders skeletons and last-good previews, but not transient first chunks', () => {
    expect(shouldRenderDesignHtmlPreviewWebview({
      fileUrl: 'file:///workspace/.kun-design/screen/v1.html',
      renderState: 'skeleton',
      hasRenderableContent: false
    })).toBe(true)
    expect(shouldRenderDesignHtmlPreviewWebview({
      fileUrl: 'file:///workspace/.kun-design/screen/v1.html',
      renderState: 'transient',
      hasRenderableContent: false
    })).toBe(false)
    expect(shouldRenderDesignHtmlPreviewWebview({
      fileUrl: 'file:///workspace/.kun-design/screen/v1.html',
      renderState: 'transient',
      hasRenderableContent: true
    })).toBe(true)
    expect(shouldRenderDesignHtmlPreviewWebview({
      fileUrl: '',
      renderState: 'skeleton',
      hasRenderableContent: true
    })).toBe(false)
  })

  it('never mounts skeletons for surfaces that opt out of skeleton painting', () => {
    expect(shouldRenderDesignHtmlPreviewWebview({
      fileUrl: 'file:///workspace/.kun-design/screen/v1.html',
      renderState: 'skeleton',
      hasRenderableContent: false,
      mountWhileSkeleton: false
    })).toBe(false)
    expect(shouldRenderDesignHtmlPreviewWebview({
      fileUrl: 'file:///workspace/.kun-design/screen/v1.html',
      renderState: 'renderable',
      hasRenderableContent: true,
      mountWhileSkeleton: false
    })).toBe(true)
  })

  it('builds revision URLs without remount-oriented keys', () => {
    expect(designHtmlPreviewUrl('file:///workspace/page.html', 3)).toBe('file:///workspace/page.html?rev=3')
    expect(designHtmlPreviewUrl('file:///workspace/page.html?token=1', 4)).toBe('file:///workspace/page.html?token=1&rev=4')
  })

  it('clamps native webview zoom factors', () => {
    expect(designHtmlPreviewWebviewZoomFactor(1)).toBe(1)
    expect(designHtmlPreviewWebviewZoomFactor(0)).toBe(1)
    expect(designHtmlPreviewWebviewZoomFactor(Number.NaN)).toBe(1)
    expect(designHtmlPreviewWebviewZoomFactor(0.001)).toBe(0.05)
    expect(designHtmlPreviewWebviewZoomFactor(50)).toBe(4)
  })

  it('guards synchronous Electron executeJavaScript throws', async () => {
    expect(
      executeDesignHtmlPreviewScript({
        executeJavaScript: () => {
          throw new Error('not ready')
        }
      }, 'true')
    ).toBeNull()
    await expect(
      executeDesignHtmlPreviewScript({
        executeJavaScript: async () => 42
      }, 'true')
    ).resolves.toBe(42)
    await expect(
      executeDesignHtmlPreviewScript({
        executeJavaScript: async () => {
          throw new Error('guest script failed')
        }
      }, 'true')
    ).resolves.toBeNull()
  })
})
