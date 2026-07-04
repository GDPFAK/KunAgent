import { describe, expect, it } from 'vitest'
import {
  htmlFrameCanvasRectToScreenRect,
  htmlFrameCanvasScreenTransform,
  htmlFrameWebviewCanvasStyle
} from './HtmlFrameOverlay'

describe('HtmlFrameOverlay SVG screen mapping', () => {
  it('uses the same meet scale and letterbox offset as the SVG viewBox', () => {
    const vbox = { x: 1000, y: 500, width: 1600, height: 1000 }
    const transform = htmlFrameCanvasScreenTransform({
      vbox,
      containerWidth: 1200,
      containerHeight: 800
    })

    expect(transform).toEqual({
      scale: 0.75,
      offsetX: 0,
      offsetY: 25
    })
    expect(htmlFrameCanvasRectToScreenRect({
      x: 1200,
      y: 700,
      width: 1280,
      height: 800
    }, vbox, transform)).toEqual({
      x: 150,
      y: 175,
      width: 960,
      height: 600
    })
  })

  it('has no offset when the viewBox ratio matches the container ratio', () => {
    const transform = htmlFrameCanvasScreenTransform({
      vbox: { x: -600, y: -400, width: 1200, height: 800 },
      containerWidth: 1200,
      containerHeight: 800
    })

    expect(transform).toEqual({ scale: 1, offsetX: 0, offsetY: 0 })
  })
})

describe('HtmlFrameOverlay webview canvas viewport style', () => {
  it('keeps the webview viewport in canvas pixels and scales visually with the canvas zoom', () => {
    expect(htmlFrameWebviewCanvasStyle({
      canvasWidth: 1834,
      visualCanvasHeight: 930,
      zoom: 0.48,
      interactive: false
    })).toEqual({
      display: 'flex',
      width: 1834,
      height: 930,
      transform: 'scale(0.48)',
      transformOrigin: 'left top',
      pointerEvents: 'none'
    })
    expect(htmlFrameWebviewCanvasStyle({
      canvasWidth: 390,
      visualCanvasHeight: 844,
      zoom: 1.25,
      interactive: true
    })).toMatchObject({
      width: 390,
      height: 844,
      transform: 'scale(1.25)',
      pointerEvents: 'auto'
    })
  })

  it('keeps the webview host display:flex so the shadow iframe fills the guest viewport', () => {
    // Electron's <webview> shadow iframe is `flex: 1 1 auto; width: 100%` with
    // no height. A block host collapses the guest viewport to the replaced
    // element default (150px tall), which painted pages as a short strip.
    expect(htmlFrameWebviewCanvasStyle({
      canvasWidth: 1280,
      visualCanvasHeight: 4627,
      zoom: 0.48,
      interactive: false
    }).display).toBe('flex')
  })

  it('always sizes the webview viewport to the full frame height', () => {
    expect(htmlFrameWebviewCanvasStyle({
      canvasWidth: 1280,
      visualCanvasHeight: 2400,
      zoom: 0.5,
      interactive: false
    })).toMatchObject({
      width: 1280,
      height: 2400,
      transform: 'scale(0.5)'
    })
  })
})
