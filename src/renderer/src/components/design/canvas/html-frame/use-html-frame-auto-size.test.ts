import { describe, expect, it } from 'vitest'
import {
  htmlFrameMeasurementArtifactMatchesEpoch,
  htmlFrameMeasurementEpochMatches,
  htmlFrameAutoSizeMeasurementCanWrite,
  htmlFrameBoundsInsideViewport,
  htmlFrameBoundsIntersectViewport,
  shouldRefitMeasuredHtmlFrame,
  type HtmlFrameMeasurementEpoch
} from './use-html-frame-auto-size'
import type { DesignArtifact } from '../../../../design/design-types'

describe('useHtmlFrameAutoSize viewport refit policy', () => {
  const viewport = { x: 0, y: 0, width: 1200, height: 800 }

  it('detects whether measured HTML frame bounds are still visible', () => {
    expect(htmlFrameBoundsIntersectViewport({ x: 100, y: 100, width: 390, height: 844 }, viewport)).toBe(true)
    expect(htmlFrameBoundsIntersectViewport({ x: 1400, y: 100, width: 390, height: 844 }, viewport)).toBe(false)
  })

  it('treats bounds near the viewport edge as needing a fit margin', () => {
    expect(htmlFrameBoundsInsideViewport({ x: 120, y: 100, width: 390, height: 520 }, viewport)).toBe(true)
    expect(htmlFrameBoundsInsideViewport({ x: 20, y: 20, width: 390, height: 520 }, viewport)).toBe(false)
  })

  it('refits selected pending frames when measured content grows past the current view', () => {
    expect(shouldRefitMeasuredHtmlFrame({
      previewStatus: 'pending',
      selected: true,
      bounds: { x: 100, y: 100, width: 390, height: 1200 },
      viewport
    })).toBe(true)
  })

  it('does not pull the camera back for unselected, ready, or off-screen frames', () => {
    const bounds = { x: 100, y: 100, width: 390, height: 1200 }
    expect(shouldRefitMeasuredHtmlFrame({ previewStatus: 'pending', selected: false, bounds, viewport })).toBe(false)
    expect(shouldRefitMeasuredHtmlFrame({ previewStatus: 'ready', selected: true, bounds, viewport })).toBe(false)
    expect(shouldRefitMeasuredHtmlFrame({
      previewStatus: 'pending',
      selected: true,
      bounds: { x: 1800, y: 100, width: 390, height: 1200 },
      viewport
    })).toBe(false)
  })
})

describe('useHtmlFrameAutoSize measurement write policy', () => {
  it('does not let stale measurements overwrite manually locked HTML frames', () => {
    expect(htmlFrameAutoSizeMeasurementCanWrite({
      artifactKind: 'html',
      sizeMode: 'manual',
      previewStatus: 'pending',
      currentRenderableContent: true
    })).toBe(false)
    expect(htmlFrameAutoSizeMeasurementCanWrite({
      artifactKind: 'html',
      sizeMode: 'manual',
      parallelStatus: 'running',
      currentRenderableContent: true
    })).toBe(false)
  })

  it('allows auto HTML frames to grow while generation is unsettled', () => {
    expect(htmlFrameAutoSizeMeasurementCanWrite({
      artifactKind: 'html',
      sizeMode: 'auto',
      previewStatus: 'pending',
      currentRenderableContent: true
    })).toBe(true)
    expect(htmlFrameAutoSizeMeasurementCanWrite({
      artifactKind: 'html',
      sizeMode: 'manual-width-auto-height',
      previewStatus: 'pending',
      currentRenderableContent: true
    })).toBe(true)
  })

  it('does not let loading skeleton measurements write frame size', () => {
    expect(htmlFrameAutoSizeMeasurementCanWrite({
      artifactKind: 'html',
      sizeMode: 'auto',
      previewStatus: 'pending',
      currentRenderableContent: false
    })).toBe(false)
    expect(htmlFrameAutoSizeMeasurementCanWrite({
      artifactKind: 'html',
      sizeMode: 'manual-width-auto-height',
      parallelStatus: 'running',
      currentRenderableContent: false
    })).toBe(false)
  })

  it('ignores measurements for non-html artifacts', () => {
    expect(htmlFrameAutoSizeMeasurementCanWrite({
      artifactKind: 'canvas',
      sizeMode: 'auto',
      previewStatus: 'pending',
      currentRenderableContent: true
    })).toBe(false)
  })

  it('rejects stale measurements after the preview target changes', () => {
    const epoch: HtmlFrameMeasurementEpoch = {
      shapeId: 'shape-1',
      artifactId: 'screen',
      artifactRelativePath: '.kun-design/doc/screen/v1.html',
      previewWebviewUrl: 'file:///workspace/.kun-design/doc/screen/v1.html',
      previewRevision: 1,
      webviewMountNonce: 10
    }

    expect(htmlFrameMeasurementEpochMatches(epoch, { ...epoch })).toBe(true)
    expect(htmlFrameMeasurementEpochMatches(epoch, {
      ...epoch,
      artifactRelativePath: '.kun-design/doc/screen/v2.html',
      previewWebviewUrl: 'file:///workspace/.kun-design/doc/screen/v2.html'
    })).toBe(false)
    expect(htmlFrameMeasurementEpochMatches(epoch, { ...epoch, previewRevision: 2 })).toBe(false)
    expect(htmlFrameMeasurementEpochMatches(epoch, { ...epoch, webviewMountNonce: 11 })).toBe(false)
    expect(htmlFrameMeasurementEpochMatches(epoch, null)).toBe(false)
  })

  it('only lets measurements write to the matching current HTML artifact version', () => {
    const epoch: HtmlFrameMeasurementEpoch = {
      shapeId: 'shape-1',
      artifactId: 'screen',
      artifactRelativePath: '.kun-design/doc/screen/v1.html',
      previewWebviewUrl: 'file:///workspace/.kun-design/doc/screen/v1.html',
      previewRevision: 1,
      webviewMountNonce: 10
    }
    const artifact = {
      id: 'screen',
      kind: 'html',
      title: 'Screen',
      relativePath: '.kun-design/doc/screen/v1.html',
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
      versions: []
    } satisfies DesignArtifact

    expect(htmlFrameMeasurementArtifactMatchesEpoch(epoch, artifact)).toBe(true)
    expect(htmlFrameMeasurementArtifactMatchesEpoch(epoch, {
      ...artifact,
      relativePath: '.kun-design/doc/screen/v2.html'
    })).toBe(false)
    expect(htmlFrameMeasurementArtifactMatchesEpoch(epoch, {
      ...artifact,
      id: 'other'
    })).toBe(false)
    expect(htmlFrameMeasurementArtifactMatchesEpoch(epoch, {
      ...artifact,
      kind: 'canvas'
    })).toBe(false)
  })
})
