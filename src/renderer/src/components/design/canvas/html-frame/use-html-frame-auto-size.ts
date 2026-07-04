import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCanvasSelectionStore } from '../../../../design/canvas/canvas-selection-store'
import { useCanvasShapeStore } from '../../../../design/canvas/canvas-shape-store'
import { shapeBounds, type CanvasShape, type Rect } from '../../../../design/canvas/canvas-types'
import { useCanvasViewportStore } from '../../../../design/canvas/canvas-viewport-store'
import type { DesignArtifact, DesignArtifactFoundationRole } from '../../../../design/design-types'
import { useDesignWorkspaceStore } from '../../../../design/design-workspace-store'
import {
  FRAME_AUTO_GROW_THRESHOLD,
  HTML_FRAME_CONTENT_SIZE_QUERY,
  buildHtmlFrameScrollbarSuppressionScript,
  htmlFrameAllowsWidthAutoGrow,
  htmlFrameShouldApplyScrollbarSuppression,
  resolveHtmlFrameMeasurementDecision,
  shouldAutoResizeHtmlFrame
} from './html-frame-helpers'

type HtmlFrameScriptExecutor = (code: string) => Promise<unknown> | null

type HtmlFrameWebviewEvents = {
  addEventListener?: (name: 'dom-ready' | 'did-finish-load', handler: () => void) => void
  removeEventListener?: (name: 'dom-ready' | 'did-finish-load', handler: () => void) => void
}

type UseHtmlFrameAutoSizeOptions = {
  shape: CanvasShape
  artifact: DesignArtifact | undefined
  artifactKind: DesignArtifact['kind'] | undefined
  foundationRole: DesignArtifactFoundationRole | undefined
  autoResizeEnabled: boolean
  /**
   * The agent is still streaming HTML into this frame. While true, content
   * measurements only drive scrollbar suppression — frame resizing is held so
   * the drawn box stays stable and the page visibly "paints" inside it; the
   * settle-time measurement then adapts the height once.
   */
  drawingActive: boolean
  previewWebviewUrl: string
  previewRevision: number
  webview: HtmlFrameWebviewEvents | null | undefined
  webviewMountNonce: number
  currentRenderableContent: boolean
  executeScript: HtmlFrameScriptExecutor
}

export type HtmlFrameMeasurementEpoch = {
  shapeId: string
  artifactId: string
  artifactRelativePath: string
  previewWebviewUrl: string
  previewRevision: number
  webviewMountNonce: number
}

export function htmlFrameMeasurementEpochMatches(
  captured: HtmlFrameMeasurementEpoch | null,
  current: HtmlFrameMeasurementEpoch | null
): boolean {
  return Boolean(
    captured &&
      current &&
      captured.shapeId === current.shapeId &&
      captured.artifactId === current.artifactId &&
      captured.artifactRelativePath === current.artifactRelativePath &&
      captured.previewWebviewUrl === current.previewWebviewUrl &&
      captured.previewRevision === current.previewRevision &&
      captured.webviewMountNonce === current.webviewMountNonce
  )
}

export function htmlFrameMeasurementArtifactMatchesEpoch(
  epoch: HtmlFrameMeasurementEpoch,
  artifact: DesignArtifact | undefined
): artifact is DesignArtifact & { kind: 'html' } {
  return Boolean(
    artifact &&
      artifact.kind === 'html' &&
      artifact.id === epoch.artifactId &&
      artifact.relativePath === epoch.artifactRelativePath
  )
}

export function htmlFrameAutoSizeMeasurementCanWrite({
  artifactKind,
  sizeMode,
  previewStatus,
  parallelStatus,
  currentRenderableContent
}: {
  artifactKind: DesignArtifact['kind'] | undefined
  sizeMode?: 'auto' | 'manual' | 'manual-width-auto-height'
  previewStatus?: DesignArtifact['previewStatus']
  parallelStatus?: 'queued' | 'running' | 'done' | 'failed'
  currentRenderableContent: boolean
}): boolean {
  if (artifactKind !== 'html') return false
  if (!currentRenderableContent) return false
  return shouldAutoResizeHtmlFrame({ sizeMode, previewStatus, parallelStatus })
}

export function htmlFrameBoundsInsideViewport(rect: Rect, viewport: Rect): boolean {
  const margin = Math.max(80, Math.min(rect.width, rect.height) * 0.08)
  return (
    rect.x >= viewport.x + margin &&
    rect.y >= viewport.y + margin &&
    rect.x + rect.width <= viewport.x + viewport.width - margin &&
    rect.y + rect.height <= viewport.y + viewport.height - margin
  )
}

export function htmlFrameBoundsIntersectViewport(rect: Rect, viewport: Rect): boolean {
  return !(
    rect.x + rect.width < viewport.x ||
    rect.y + rect.height < viewport.y ||
    rect.x > viewport.x + viewport.width ||
    rect.y > viewport.y + viewport.height
  )
}

export function shouldRefitMeasuredHtmlFrame({
  previewStatus,
  selected,
  bounds,
  viewport
}: {
  previewStatus?: DesignArtifact['previewStatus']
  selected: boolean
  bounds: Rect
  viewport: Rect
}): boolean {
  if (previewStatus !== 'pending') return false
  if (!selected) return false
  if (!htmlFrameBoundsIntersectViewport(bounds, viewport)) return false
  return !htmlFrameBoundsInsideViewport(bounds, viewport)
}

function maybeRefitPendingFrame(shape: CanvasShape, patch: Partial<CanvasShape>, artifact: DesignArtifact): void {
  const next = { ...shape, ...patch }
  const bounds = shapeBounds(next)
  const viewport = useCanvasViewportStore.getState().vbox
  if (!shouldRefitMeasuredHtmlFrame({
    previewStatus: artifact.previewStatus,
    selected: useCanvasSelectionStore.getState().selectedIds.has(shape.id),
    bounds,
    viewport
  })) {
    return
  }
  useCanvasViewportStore.getState().zoomToFit(bounds, 72, { maxZoom: 1, minZoom: 0.04 })
}

export function useHtmlFrameAutoSize({
  shape,
  artifact,
  artifactKind,
  foundationRole,
  autoResizeEnabled,
  drawingActive,
  previewWebviewUrl,
  previewRevision,
  webview,
  webviewMountNonce,
  currentRenderableContent,
  executeScript
}: UseHtmlFrameAutoSizeOptions): void {
  const measurementTimersRef = useRef<number[]>([])
  const drawingActiveRef = useRef(drawingActive)
  const currentMeasurementEpoch = useMemo<HtmlFrameMeasurementEpoch | null>(() => {
    if (!artifact?.id || artifactKind !== 'html' || !artifact.relativePath || !previewWebviewUrl) return null
    return {
      shapeId: shape.id,
      artifactId: artifact.id,
      artifactRelativePath: artifact.relativePath,
      previewWebviewUrl,
      previewRevision,
      webviewMountNonce
    }
  }, [
    artifact?.id,
    artifact?.relativePath,
    artifactKind,
    previewRevision,
    previewWebviewUrl,
    shape.id,
    webviewMountNonce
  ])
  const currentMeasurementEpochRef = useRef<HtmlFrameMeasurementEpoch | null>(currentMeasurementEpoch)
  const [suppressDocumentScrollbars, setSuppressDocumentScrollbars] = useState(false)

  useEffect(() => {
    currentMeasurementEpochRef.current = currentMeasurementEpoch
  }, [currentMeasurementEpoch])

  useEffect(() => {
    drawingActiveRef.current = drawingActive
  }, [drawingActive])

  useEffect(() => {
    setSuppressDocumentScrollbars(false)
  }, [artifact?.id, artifact?.relativePath, shape.id])

  useEffect(() => {
    if (!previewWebviewUrl) return
    const shouldSuppressScrollbars = htmlFrameShouldApplyScrollbarSuppression({
      autoResizeEnabled,
      suppressScrollbars: suppressDocumentScrollbars
    })
    void executeScript(
      buildHtmlFrameScrollbarSuppressionScript(shouldSuppressScrollbars)
    )?.catch(() => undefined)
  }, [autoResizeEnabled, executeScript, previewRevision, suppressDocumentScrollbars, webviewMountNonce, previewWebviewUrl])

  useEffect(() => {
    if (autoResizeEnabled) return
    setSuppressDocumentScrollbars(false)
  }, [autoResizeEnabled])

  useEffect(() => {
    if (currentRenderableContent) return
    setSuppressDocumentScrollbars(false)
  }, [currentRenderableContent])

  const measureContentSize = useCallback((): void => {
    if (!artifact?.id || artifactKind !== 'html') return
    if (!currentRenderableContent) return
    const measurementEpoch = currentMeasurementEpochRef.current
    if (!measurementEpoch || measurementEpoch.artifactId !== artifact.id) return
    const measurement = executeScript(HTML_FRAME_CONTENT_SIZE_QUERY)
    if (!measurement) return
    void measurement
      .then((value) => {
        if (!htmlFrameMeasurementEpochMatches(measurementEpoch, currentMeasurementEpochRef.current)) return
        const decision = resolveHtmlFrameMeasurementDecision(value)
        if (!decision) return
        const store = useCanvasShapeStore.getState()
        const current = store.document.objects[shape.id]
        if (!current) return
        const designStore = useDesignWorkspaceStore.getState()
        const latestArtifact = designStore.artifacts.find((item) => item.id === artifact.id)
        if (!htmlFrameMeasurementArtifactMatchesEpoch(measurementEpoch, latestArtifact)) return
        const latestParallelState = designStore.parallelPageStates[artifact.id]
        const latestAutoResizeEnabled = htmlFrameAutoSizeMeasurementCanWrite({
          artifactKind: latestArtifact.kind,
          sizeMode: latestArtifact.node?.sizeMode,
          previewStatus: latestArtifact.previewStatus,
          parallelStatus: latestParallelState?.status,
          currentRenderableContent
        })
        const { nextWidth, nextHeight, suppressScrollbars } = decision
        const shouldSuppressScrollbars = htmlFrameShouldApplyScrollbarSuppression({
          autoResizeEnabled: latestAutoResizeEnabled,
          suppressScrollbars
        })
        setSuppressDocumentScrollbars(shouldSuppressScrollbars)
        void executeScript(
          buildHtmlFrameScrollbarSuppressionScript(shouldSuppressScrollbars)
        )?.catch(() => undefined)
        if (!latestAutoResizeEnabled) return
        // While the agent is still painting this page, hold the drawn frame
        // size: partial content would otherwise shrink/grow the box on every
        // streamed write. The settle-time re-measure adapts the height once.
        if (drawingActiveRef.current) return
        const widthChanged =
          htmlFrameAllowsWidthAutoGrow(foundationRole) &&
          Math.abs(nextWidth - current.width) > FRAME_AUTO_GROW_THRESHOLD
        const heightChanged = Math.abs(nextHeight - current.height) > FRAME_AUTO_GROW_THRESHOLD
        if (!widthChanged && !heightChanged) return
        const patch = {
          ...(widthChanged ? { width: nextWidth } : {}),
          ...(heightChanged ? { height: nextHeight } : {})
        }
        store.updateShape(shape.id, patch, true)
        designStore.updateArtifactNode(artifact.id, {
          x: Math.round(current.x),
          y: Math.round(current.y),
          width: widthChanged ? nextWidth : Math.round(current.width),
          height: heightChanged ? nextHeight : Math.round(current.height),
          sizeMode:
            latestArtifact.node?.sizeMode === 'manual-width-auto-height'
              ? 'manual-width-auto-height'
              : 'auto',
          viewMode: latestArtifact.node?.viewMode ?? 'preview'
        })
        maybeRefitPendingFrame(current, patch, latestArtifact)
      })
      .catch(() => undefined)
  }, [
    artifact,
    artifactKind,
    currentMeasurementEpochRef,
    currentRenderableContent,
    executeScript,
    foundationRole,
    shape.id
  ])

  const queueContentMeasurement = useCallback((): void => {
    for (const timer of measurementTimersRef.current) window.clearTimeout(timer)
    measurementTimersRef.current = [180, 700, 1400].map((delay) =>
      window.setTimeout(measureContentSize, delay)
    )
  }, [measureContentSize])

  useEffect(
    () => () => {
      for (const timer of measurementTimersRef.current) window.clearTimeout(timer)
      measurementTimersRef.current = []
    },
    []
  )

  useEffect(() => {
    if (!previewWebviewUrl) return
    const wv = webview
    if (!wv?.addEventListener || !wv.removeEventListener) return
    wv.addEventListener('dom-ready', queueContentMeasurement)
    wv.addEventListener('did-finish-load', queueContentMeasurement)
    queueContentMeasurement()
    return () => {
      wv.removeEventListener?.('dom-ready', queueContentMeasurement)
      wv.removeEventListener?.('did-finish-load', queueContentMeasurement)
    }
  }, [
    queueContentMeasurement,
    previewRevision,
    previewWebviewUrl,
    currentRenderableContent,
    shape.height,
    shape.width,
    webview,
    webviewMountNonce
  ])

  // Frame resizing is held during streaming; once the turn settles, run the
  // deferred measurement so the frame height adapts to the final content even
  // if the last webview load event fired while drawing was still active.
  useEffect(() => {
    if (drawingActive || !previewWebviewUrl) return
    queueContentMeasurement()
  }, [drawingActive, previewWebviewUrl, queueContentMeasurement])
}
