import { describe, expect, it } from 'vitest'
import {
  SKETCH_ELEMENTS,
  buildHtmlFrameGeneratingSketchCss,
  htmlFrameGeneratingSketchTimeline
} from './HtmlFrameGeneratingCanvas'
import { htmlFrameShouldShowGeneratingCanvas } from './html-frame-helpers'

describe('html frame generating sketch timeline', () => {
  it('assigns every element a monotonic, gapped window inside the draw span', () => {
    const { windows } = htmlFrameGeneratingSketchTimeline()

    expect(windows).toHaveLength(SKETCH_ELEMENTS.length)
    for (const window of windows) {
      expect(window.end).toBeGreaterThan(window.start)
    }
    for (let i = 1; i < windows.length; i += 1) {
      expect(windows[i].start).toBeGreaterThan(windows[i - 1].end)
    }
    expect(windows[0].start).toBeGreaterThanOrEqual(0)
    expect(windows[windows.length - 1].end).toBeLessThanOrEqual(90 + 1e-6)
  })

  it('keeps brush waypoints sorted along the cycle and inside the frame', () => {
    const { brushFrames } = htmlFrameGeneratingSketchTimeline()

    expect(brushFrames.length).toBeGreaterThan(0)
    for (let i = 1; i < brushFrames.length; i += 1) {
      expect(brushFrames[i].pct).toBeGreaterThanOrEqual(brushFrames[i - 1].pct)
    }
    for (const frame of brushFrames) {
      expect(frame.left).toBeGreaterThanOrEqual(0)
      expect(frame.left).toBeLessThanOrEqual(100)
      expect(frame.top).toBeGreaterThanOrEqual(0)
      expect(frame.top).toBeLessThanOrEqual(100)
    }
  })

  it('emits one keyframes rule per element plus brush, fade, and reduced-motion rules', () => {
    const css = buildHtmlFrameGeneratingSketchCss()

    SKETCH_ELEMENTS.forEach((_, index) => {
      expect(css).toContain(`@keyframes kun-hfgen-el-${index}{`)
      expect(css).toContain(`.kun-hfgen-el-${index}{animation:kun-hfgen-el-${index}`)
    })
    expect(css).toContain('@keyframes kun-hfgen-brush{')
    expect(css).toContain('@keyframes kun-hfgen-fade{')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })
})

describe('htmlFrameShouldShowGeneratingCanvas', () => {
  const base = {
    webviewMounted: false,
    hasArtifact: true,
    transparentGeneratingSurface: true,
    previewError: '',
    failedMessage: ''
  }

  it('shows the sketch overlay for generating frames without a mounted webview', () => {
    expect(htmlFrameShouldShowGeneratingCanvas(base)).toBe(true)
  })

  it('yields to the webview, plain placeholder, and error messages', () => {
    expect(htmlFrameShouldShowGeneratingCanvas({ ...base, webviewMounted: true })).toBe(false)
    expect(htmlFrameShouldShowGeneratingCanvas({ ...base, hasArtifact: false })).toBe(false)
    expect(
      htmlFrameShouldShowGeneratingCanvas({ ...base, transparentGeneratingSurface: false })
    ).toBe(false)
    expect(htmlFrameShouldShowGeneratingCanvas({ ...base, previewError: 'boom' })).toBe(false)
    expect(htmlFrameShouldShowGeneratingCanvas({ ...base, failedMessage: '生成失败' })).toBe(false)
  })
})
