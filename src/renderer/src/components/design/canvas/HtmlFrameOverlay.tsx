import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { AlertTriangle, Brush, Check, CheckCircle2, Monitor, MousePointer2, PenLine, ShieldCheck } from 'lucide-react'
import { useCanvasShapeStore } from '../../../design/canvas/canvas-shape-store'
import { useCanvasViewportStore } from '../../../design/canvas/canvas-viewport-store'
import { useCanvasSelectionStore } from '../../../design/canvas/canvas-selection-store'
import { isHtmlFrame, type CanvasShape } from '../../../design/canvas/canvas-types'
import type { DesignHtmlElementContext } from '../../../design/design-composer-context'
import {
  startDesignHtmlPreviewWatch,
  type DesignPreviewRenderState
} from '../../../design/design-preview-file'
import {
  inferDesignArtifactFoundationRole,
  type DesignArtifactFoundationRole
} from '../../../design/design-types'
import { useDesignWorkspaceStore } from '../../../design/design-workspace-store'
import { useChatStore } from '../../../store/chat-store'
import {
  buildDesignRuntimeQualityAuditScript,
  getDesignRuntimeQualityFindings,
  normalizeRuntimeQualityFindings,
  setDesignRuntimeQualityFindings,
  summarizeDesignHtmlQualityDetails,
  summarizeDesignHtmlQualityStatus,
  type DesignHtmlQualityFinding,
  type DesignRuntimeQualityPayload
} from '../../../design/design-html-quality'

const MAX_ACTIVE_WEBVIEWS = 10
const MIN_ZOOM_FOR_WEBVIEW = 0.04

/** Hide the "AI is drawing here" cursor this long after the last file change. */
const AI_CURSOR_TTL_MS = 4500

/** A just-created screen has no HTML file yet; poll fast for this long, then slowly. */
const PREVIEW_FAST_POLL_MS = 6_000
/** Give up polling a preview that never lands after this (matches the page-generation ceiling). */
const PREVIEW_MAX_WAIT_MS = 300_000
const FRAME_AUTO_GROW_THRESHOLD = 12
const FRAME_AUTO_GROW_MAX_WIDTH = 7_680
const FRAME_AUTO_GROW_MIN_WIDTH = 240
const FRAME_AUTO_GROW_MAX_HEIGHT = 12_000
const FRAME_AUTO_GROW_MIN_HEIGHT = 180
const HTML_FRAME_SCROLLBAR_STYLE_ID = '__kun_html_frame_auto_crop_scrollbars__'

export const HTML_FRAME_CONTENT_SIZE_QUERY = `(() => {
  const html = document.documentElement
  const body = document.body
  const nums = (...values) => values.filter((v) => Number.isFinite(v) && v > 0)
  const numericCss = (value) => {
    const n = Number.parseFloat(value || '0')
    return Number.isFinite(n) ? n : 0
  }
  const textRects = (el, style) => {
    const rects = []
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType !== Node.TEXT_NODE) continue
      if (!(node.textContent || '').trim()) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const piece of Array.from(range.getClientRects())) {
        if (piece.width < 1 || piece.height < 1) continue
        const pieceRight = Number.isFinite(piece.right) ? piece.right : piece.width
        rects.push({
          bottom: piece.bottom + window.scrollY + numericCss(style.paddingBottom) + numericCss(style.borderBottomWidth),
          right: pieceRight + (window.scrollX || 0) + numericCss(style.paddingRight) + numericCss(style.borderRightWidth)
        })
      }
      if (typeof range.detach === 'function') range.detach()
    }
    return rects
  }
  // The exclusion threshold below MUST stay independent of window.innerHeight.
  // The <webview> host resizes this frame's CSS height to whatever we last
  // measured, so window.innerHeight is a self-referential signal here (it IS the
  // previous measurement, not an independent fact about the page). Using it as the
  // threshold created a shrink feedback loop: an early low reading would shrink the
  // frame, which shrinks window.innerHeight, which lowers the threshold, which
  // excludes MORE legitimate large sections next pass, converging to a permanently
  // too-small height. documentHeight (scrollHeight-based) reflects the page's real
  // natural content size and does not move just because we resized our own frame.
  const hasVisibleBoxPaint = (el, style, rect) => {
    if (el === body || el === html) return false
    const backgroundColor = style.backgroundColor || ''
    const hasBackgroundColor = backgroundColor && !/rgba?\\(\\s*0\\s*,\\s*0\\s*,\\s*0\\s*,\\s*0\\s*\\)|transparent/i.test(backgroundColor)
    const hasBackgroundImage = style.backgroundImage && style.backgroundImage !== 'none'
    if (hasBackgroundImage) return true
    if (rect.height > Math.max(480, documentHeight * 0.65)) return false
    return hasBackgroundColor
  }
  const documentHeight = Math.max(...nums(
    html?.scrollHeight,
    html?.offsetHeight,
    html?.clientHeight,
    body?.scrollHeight,
    body?.offsetHeight,
    body?.clientHeight
  ), 1)
  const candidates = body ? [body, ...Array.from(body.querySelectorAll('*'))] : []
  const visibleElementRects = candidates.flatMap((el) => {
        if (!(el instanceof HTMLElement || el instanceof SVGElement)) return []
        const tag = el.tagName.toLowerCase()
        if (tag === 'script' || tag === 'style' || tag === 'template') return []
        const style = window.getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return []
        const rect = el.getBoundingClientRect()
        if (rect.width < 1 || rect.height < 1) return []
        const hasMedia = ['img', 'svg', 'canvas', 'video', 'picture'].includes(tag)
        return [
          ...textRects(el, style),
          ...(hasMedia || hasVisibleBoxPaint(el, style, rect)
            ? [{ bottom: rect.bottom + window.scrollY, right: (Number.isFinite(rect.right) ? rect.right : rect.width) + (window.scrollX || 0) }]
            : [])
        ]
      })
  const paintedHeight = visibleElementRects.length ? Math.max(...visibleElementRects.map((rect) => rect.bottom)) : 0
  const paintedWidth = visibleElementRects.length ? Math.max(...visibleElementRects.map((rect) => rect.right)) : 0
  const width = Math.max(...nums(
    html?.scrollWidth,
    html?.offsetWidth,
    html?.clientWidth,
    body?.scrollWidth,
    body?.offsetWidth,
    body?.clientWidth,
    paintedWidth,
    window.innerWidth
  ), 1)
  const height = paintedHeight > 0 ? Math.min(documentHeight, paintedHeight + 16) : documentHeight
  return {
    width: Math.ceil(width),
    height: Math.ceil(height),
    documentHeight: Math.ceil(documentHeight),
    paintedHeight: Math.ceil(paintedHeight),
    paintedWidth: Math.ceil(paintedWidth)
  }
})()`

export function htmlFrameShouldSuppressDocumentScrollbars({
  measuredHeight,
  documentHeight
}: {
  measuredHeight: number
  documentHeight: number
}): boolean {
  return documentHeight > measuredHeight + FRAME_AUTO_GROW_THRESHOLD
}

export function buildHtmlFrameScrollbarSuppressionScript(suppress: boolean): string {
  const css = `
    html,
    body {
      overflow: hidden !important;
      min-height: 0 !important;
    }
    ::-webkit-scrollbar {
      width: 0 !important;
      height: 0 !important;
      display: none !important;
    }
  `
  return `(() => {
    const id = ${JSON.stringify(HTML_FRAME_SCROLLBAR_STYLE_ID)}
    const existing = document.getElementById(id)
    if (!${JSON.stringify(suppress)}) {
      if (existing) existing.remove()
      return
    }
    const style = existing || document.createElement('style')
    style.id = id
    style.textContent = ${JSON.stringify(css)}
    ;(document.head || document.documentElement).appendChild(style)
  })()`
}

type HtmlFrameWebviewScriptHost = {
  executeJavaScript?: (code: string) => Promise<unknown>
}

export function executeHtmlFrameWebviewScript(
  webview: HtmlFrameWebviewScriptHost | null | undefined,
  code: string
): Promise<unknown> | null {
  if (typeof webview?.executeJavaScript !== 'function') return null
  try {
    return webview.executeJavaScript(code)
  } catch {
    // Electron throws synchronously when a <webview> exists but is not attached
    // and dom-ready yet. Callers still handle rejected guest promises normally.
    return null
  }
}

export type HtmlFrameMeasurementDecision = {
  nextWidth: number
  nextHeight: number
  documentHeight: number
  suppressScrollbars: boolean
}

export function resolveHtmlFrameMeasurementDecision(value: unknown): HtmlFrameMeasurementDecision | null {
  if (!value || typeof value !== 'object') return null
  const measured = value as { width?: unknown; height?: unknown; documentHeight?: unknown }
  if (typeof measured.width !== 'number' || !Number.isFinite(measured.width)) return null
  if (typeof measured.height !== 'number' || !Number.isFinite(measured.height)) return null
  const documentHeight =
    typeof measured.documentHeight === 'number' && Number.isFinite(measured.documentHeight)
      ? measured.documentHeight
      : measured.height
  const nextWidth = Math.max(
    FRAME_AUTO_GROW_MIN_WIDTH,
    Math.min(FRAME_AUTO_GROW_MAX_WIDTH, Math.ceil(measured.width))
  )
  const nextHeight = Math.max(
    FRAME_AUTO_GROW_MIN_HEIGHT,
    Math.min(FRAME_AUTO_GROW_MAX_HEIGHT, Math.ceil(measured.height))
  )
  return {
    nextWidth,
    nextHeight,
    documentHeight,
    suppressScrollbars: htmlFrameShouldSuppressDocumentScrollbars({
      measuredHeight: nextHeight,
      documentHeight
    })
  }
}

function qualityBadgeClasses(kind: ReturnType<typeof summarizeDesignHtmlQualityStatus>['kind']): string {
  if (kind === 'critical') return 'border-red-300/70 bg-red-50/92 text-red-600'
  if (kind === 'warning') return 'border-amber-300/70 bg-amber-50/92 text-amber-700'
  if (kind === 'passed') return 'border-emerald-300/70 bg-emerald-50/92 text-emerald-700'
  return 'border-ds-border bg-white/88 text-ds-muted'
}

function qualityFindingClasses(severity: DesignHtmlQualityFinding['severity']): string {
  if (severity === 'critical') return 'border-red-200 bg-red-50/75 text-red-700'
  if (severity === 'warning') return 'border-amber-200 bg-amber-50/75 text-amber-800'
  return 'border-sky-200 bg-sky-50/75 text-sky-700'
}

function qualityFindingLabel(severity: DesignHtmlQualityFinding['severity']): string {
  if (severity === 'critical') return 'critical'
  if (severity === 'warning') return 'warning'
  return 'note'
}

export function shouldRenderHtmlFrameWebview({
  fileUrl,
  previewState,
  hasRenderableContent
}: {
  fileUrl: string
  previewState: DesignPreviewRenderState
  hasRenderableContent: boolean
}): boolean {
  if (!fileUrl) return false
  if (hasRenderableContent) return true
  return previewState === 'skeleton'
}

export function htmlFrameOverlayPointerEvents({
  panning,
  interactive,
  editing
}: {
  panning: boolean
  interactive: boolean
  editing: boolean
}): 'auto' | 'none' {
  if (panning) return 'none'
  return interactive || editing ? 'auto' : 'none'
}

export function htmlFrameVisualCanvasHeight(
  canvasHeight: number,
  measuredContentHeight: number | null
): number {
  if (!measuredContentHeight) return canvasHeight
  return Math.max(FRAME_AUTO_GROW_MIN_HEIGHT, Math.min(canvasHeight, measuredContentHeight))
}

export function shouldAutoResizeHtmlFrame({
  sizeMode,
  role,
  previewStatus,
  parallelStatus
}: {
  sizeMode?: 'auto' | 'manual'
  role?: DesignArtifactFoundationRole
  previewStatus?: 'pending' | 'ready' | 'error'
  parallelStatus?: 'queued' | 'running' | 'done' | 'failed'
}): boolean {
  return (
    sizeMode !== 'manual' ||
    Boolean(role) ||
    previewStatus === 'pending' ||
    parallelStatus === 'queued' ||
    parallelStatus === 'running'
  )
}

/**
 * Only foundation reference docs (design system / logo) may auto-grow their
 * frame WIDTH from measured content — they legitimately need to widen to show
 * component grids/specimens. Regular screens represent a fixed device
 * viewport (e.g. a 390px-wide phone mockup); letting their measured width
 * feed back into the frame produces wildly inconsistent per-screen widths
 * (window.innerWidth-based width measurement is sensitive to webview zoom
 * timing), so their width must stay pinned to the device target regardless of
 * measured content. This must stay consistent with design-board.ts's
 * genericFrameSizeForArtifact, which is the other half of this width policy.
 */
export function htmlFrameAllowsWidthAutoGrow(foundationRole: DesignArtifactFoundationRole | undefined): boolean {
  return Boolean(foundationRole)
}

export function htmlFrameDrawingActive({
  foundationRole,
  previewStatus,
  parallelStatus,
  pagesRunPhase,
  pagesRunStep,
  chatBusy
}: {
  foundationRole?: DesignArtifactFoundationRole
  previewStatus?: 'pending' | 'ready' | 'error'
  parallelStatus?: 'queued' | 'running' | 'done' | 'failed'
  pagesRunPhase?: 'foundation' | 'planning' | 'generating'
  pagesRunStep?: 'spec' | 'system' | 'logo'
  chatBusy: boolean
}): boolean {
  if (parallelStatus === 'queued' || parallelStatus === 'running') return true
  if (
    pagesRunPhase === 'foundation' &&
    (
      (pagesRunStep === 'system' && foundationRole === 'design-system') ||
      (pagesRunStep === 'logo' && foundationRole === 'logo')
    )
  ) {
    return true
  }
  return !foundationRole && !parallelStatus && previewStatus === 'pending' && chatBusy
}

/**
 * Runs inside the live webview to locate the section the agent just wrote: the
 * LAST element tagged `data-ds-section` (sections are written top-to-bottom), or
 * the last top-level body child as a fallback for untagged HTML. Returns its
 * label + rect in the webview's CSS px, which maps 1:1 to the overlay content div.
 */
const AI_SECTION_QUERY = `(() => {
  const tagged = document.querySelectorAll('[data-ds-section]')
  let el = null
  let label = ''
  if (tagged.length) {
    el = tagged[tagged.length - 1]
    label = el.getAttribute('data-ds-section') || ''
  } else if (document.body) {
    const kids = Array.prototype.slice.call(document.body.children).filter((n) => {
      const r = n.getBoundingClientRect()
      return r.height > 8 && r.width > 8
    })
    el = kids.length ? kids[kids.length - 1] : null
  }
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width < 1 || r.height < 1) return null
  return { label: label, left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }
})()`

type WebviewElement = HTMLElement & {
  executeJavaScript?: (code: string) => Promise<unknown>
  loadURL?: (url: string) => Promise<void>
  reload?: () => void
  getURL?: () => string
  setZoomFactor?: (factor: number) => void
}

/**
 * Electron/Chromium has a long-standing bug where CSS `transform: scale()` on a
 * `<webview>` (or any of its ancestors) produces cropped/double-scaled rendering
 * that gets progressively worse further from the transform origin — see
 * https://github.com/electron/electron/issues/2168 (upstream crbug.com/492182).
 * That is precisely what "renders fine near the top, blank/cropped further down a
 * tall frame" looks like. The documented fix is to size the `<webview>` at its
 * REAL on-screen pixel size (no CSS transform anywhere in its ancestor chain) and
 * use the webview's native zoom instead of CSS to scale its content.
 */
export function htmlFrameWebviewZoomFactor(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return 1
  return Math.min(4, Math.max(0.05, zoom))
}

type ScreenOverlayProps = {
  shape: CanvasShape
  workspaceRoot: string
  screenX: number
  screenY: number
  screenWidth: number
  screenHeight: number
  zoom: number
  active: boolean
  interactive: boolean
  panning: boolean
  /** Element-pick ("修改") mode is on for this frame: clicking selects text/elements. */
  editing: boolean
  onDoubleClick: (shapeId: string) => void
  onToggleModify: (shapeId: string) => void
  onUseElementAsContext?: (context: DesignHtmlElementContext | null, promptSeed?: string) => void
  onRuntimeQualityFindings?: (payload: DesignRuntimeQualityPayload) => void
  onRequestQualityRepair?: (payload: DesignRuntimeQualityPayload) => void
}

function ScreenOverlayInner({
  shape,
  workspaceRoot,
  screenX,
  screenY,
  screenWidth,
  screenHeight,
  zoom,
  active,
  interactive,
  panning,
  editing,
  onDoubleClick,
  onToggleModify,
  onUseElementAsContext,
  onRuntimeQualityFindings,
  onRequestQualityRepair
}: ScreenOverlayProps): ReactElement {
  const [fileUrl, setFileUrl] = useState('')
  const [revision, setRevision] = useState(0)
  const [previewError, setPreviewError] = useState('')
  const [previewState, setPreviewState] = useState<DesignPreviewRenderState>('transient')
  const [hasRenderablePreview, setHasRenderablePreview] = useState(false)
  const [selectedElementRect, setSelectedElementRect] = useState<{
    left: number
    top: number
    width: number
    height: number
  } | null>(null)
  const webviewRef = useRef<WebviewElement | null>(null)
  const [aiCursor, setAiCursor] = useState<{
    label: string
    left: number
    top: number
    width: number
    height: number
  } | null>(null)
  const aiFadeTimerRef = useRef<number>(0)
  const firstRevisionRef = useRef<number | null>(null)
  // Drive live preview refreshes imperatively (loadURL) instead of via a changing
  // React `key`/`src`. Track which file the webview is showing and the last revision
  // we navigated to so streaming writes refresh the SAME element (no remount → no
  // white flash) while still advancing to the newest file content.
  const webviewReadyRef = useRef(false)
  const loadedFileRef = useRef('')
  const lastLoadedRevisionRef = useRef(-1)
  const zoomRef = useRef(zoom)
  const qualitySignatureRef = useRef('')
  const measurementTimersRef = useRef<number[]>([])
  const [qualityChecked, setQualityChecked] = useState(false)
  const [qualityFindings, setQualityFindings] = useState<DesignHtmlQualityFinding[]>([])
  const [qualityDetailsOpen, setQualityDetailsOpen] = useState(false)
  const [measuredContentSize, setMeasuredContentSize] = useState<{
    width: number
    height: number
  } | null>(null)
  const [suppressDocumentScrollbars, setSuppressDocumentScrollbars] = useState(false)
  const [webviewMountNonce, setWebviewMountNonce] = useState(0)

  const artifact = useDesignWorkspaceStore((s) =>
    s.artifacts.find((a) => a.id === shape.htmlArtifactId)
  )
  const artifactKind = artifact?.kind
  const artifactRelativePath = artifact?.relativePath
  const parallelState = useDesignWorkspaceStore((s) =>
    shape.htmlArtifactId ? s.parallelPageStates[shape.htmlArtifactId] : undefined
  )
  const pagesRun = useDesignWorkspaceStore((s) => s.pagesRun)
  const setFileError = useDesignWorkspaceStore((s) => s.setFileError)
  const setArtifactPreviewStatus = useDesignWorkspaceStore((s) => s.setArtifactPreviewStatus)
  // A design turn is in flight: the agent is still streaming HTML into the file.
  // Keep the frame in its transparent "generating" surface until the turn settles
  // so a half-written page never shows the opaque white frame band beneath it.
  const chatBusy = useChatStore((s) => s.busy)

  const canvasWidth = Math.max(1, shape.width)
  const canvasHeight = Math.max(1, shape.height)
  const foundationRole = artifact ? inferDesignArtifactFoundationRole(artifact) : undefined
  const drawingActive = htmlFrameDrawingActive({
    foundationRole,
    previewStatus: artifact?.previewStatus,
    parallelStatus: parallelState?.status,
    pagesRunPhase: pagesRun?.phase,
    pagesRunStep: pagesRun?.step,
    chatBusy
  })

  const setWebviewNode = useCallback((node: WebviewElement | null): void => {
    webviewRef.current = node
    if (!node) return
    webviewReadyRef.current = false
    setWebviewMountNonce((value) => value + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    let cleanupWatch: (() => void) | null = null
    let retryTimer = 0
    const startedAt = Date.now()
    setFileUrl('')
    setRevision(0)
    setPreviewError('')
    setPreviewState('transient')
    setHasRenderablePreview(false)
    if (!artifactRelativePath || artifactKind !== 'html' || !workspaceRoot) return
    if (typeof window.kunGui?.authorizeWritePrototype !== 'function') return

    const reportError = (message: string): void => {
      setPreviewError(message)
      setFileError(message)
      if (artifact?.id) setArtifactPreviewStatus(artifact.id, 'error')
    }

    const tryAuthorize = (): void => {
      void window.kunGui
        .authorizeWritePrototype({ path: artifactRelativePath, workspaceRoot })
        .then((res) => {
          if (cancelled) return
          if (res.ok) {
            setPreviewError('')
            setFileUrl(res.fileUrl)
            cleanupWatch?.()
            cleanupWatch = startDesignHtmlPreviewWatch({
              workspaceRoot,
              path: artifactRelativePath,
              onRevision: (nextRevision) => {
                setPreviewError('')
                setRevision(nextRevision)
              },
              onPreviewStateChange: (state) => {
                if (cancelled) return
                setPreviewState(state)
                if (state === 'renderable') {
                  setHasRenderablePreview(true)
                }
              },
              onError: reportError
            })
            return
          }
          if (res.message === 'prototype file not found') {
            // The agent creates the artifact card before it writes the HTML, so a
            // missing file is the normal "still generating" state — never the
            // canvas-wide error banner. Keep polling (fast, then slow) and let the
            // tile show its local "Generating…" placeholder; the success path below
            // installs the watcher, so this self-heals the moment the file lands.
            const elapsed = Date.now() - startedAt
            if (elapsed <= PREVIEW_MAX_WAIT_MS) {
              retryTimer = window.setTimeout(
                tryAuthorize,
                elapsed < PREVIEW_FAST_POLL_MS ? 250 : 2000
              )
            }
            return
          }
          reportError(res.message)
        })
        .catch((error: unknown) => {
          if (!cancelled) reportError(error instanceof Error ? error.message : String(error))
        })
    }

    tryAuthorize()

    return () => {
      cancelled = true
      if (retryTimer) window.clearTimeout(retryTimer)
      cleanupWatch?.()
    }
  }, [
    artifact?.id,
    artifact?.previewStatus,
    artifactKind,
    artifactRelativePath,
    setArtifactPreviewStatus,
    setFileError,
    workspaceRoot
  ])

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDoubleClick(shape.id)
    },
    [shape.id, onDoubleClick]
  )

  const selectElementAt = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      if (!editing || interactive || !artifact) return
      event.preventDefault()
      event.stopPropagation()
      const rect = event.currentTarget.getBoundingClientRect()
      const x = rect.width > 0 ? ((event.clientX - rect.left) / rect.width) * canvasWidth : 0
      const y = rect.height > 0 ? ((event.clientY - rect.top) / rect.height) * canvasHeight : 0
      const selectionQuery = executeHtmlFrameWebviewScript(webviewRef.current, `(() => {
          const x = ${JSON.stringify(x)}
          const y = ${JSON.stringify(y)}
          const escapeCss = (value) => {
            if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value)
            return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\\\$&')
          }
          const selectorFor = (element) => {
            if (!element || element.nodeType !== Node.ELEMENT_NODE) return ''
            if (element.id) return '#' + escapeCss(element.id)
            const parts = []
            let current = element
            while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.documentElement) {
              const tag = current.tagName.toLowerCase()
              if (tag === 'body') {
                parts.unshift('body')
                break
              }
              let index = 1
              let sibling = current.previousElementSibling
              while (sibling) {
                if (sibling.tagName === current.tagName) index += 1
                sibling = sibling.previousElementSibling
              }
              parts.unshift(tag + ':nth-of-type(' + index + ')')
              current = current.parentElement
            }
            return parts.join(' > ')
          }
          const element = document.elementFromPoint(x, y)
          if (!element || element === document.documentElement || element === document.body) {
            return { ok: false, message: 'No editable element at this point.' }
          }
          const bounds = element.getBoundingClientRect()
          return {
            ok: true,
            selector: selectorFor(element),
            tagName: element.tagName,
            text: (element.innerText || element.textContent || '').trim().slice(0, 500),
            html: element.outerHTML.slice(0, 1400),
            rect: {
              left: Math.round(bounds.left),
              top: Math.round(bounds.top),
              width: Math.round(bounds.width),
              height: Math.round(bounds.height)
            }
          }
        })()`)
      if (!selectionQuery) return
      void selectionQuery
        .then((value) => {
          if (!value || typeof value !== 'object') return
          const result = value as {
            ok?: unknown
            message?: unknown
            selector?: unknown
            tagName?: unknown
            text?: unknown
            html?: unknown
            rect?: unknown
          }
          if (!result.ok) {
            if (typeof result.message === 'string') setPreviewError(result.message)
            setSelectedElementRect(null)
            onUseElementAsContext?.(null)
            return
          }
          const resultRect = result.rect as { left?: unknown; top?: unknown; width?: unknown; height?: unknown } | undefined
          if (
            typeof result.selector !== 'string' ||
            typeof result.tagName !== 'string' ||
            typeof result.text !== 'string' ||
            typeof result.html !== 'string' ||
            !resultRect ||
            typeof resultRect.left !== 'number' ||
            typeof resultRect.top !== 'number' ||
            typeof resultRect.width !== 'number' ||
            typeof resultRect.height !== 'number'
          ) {
            return
          }
          setPreviewError('')
          setSelectedElementRect({
            left: resultRect.left,
            top: resultRect.top,
            width: resultRect.width,
            height: resultRect.height
          })
          onUseElementAsContext?.({
            artifactId: artifact.id,
            artifactTitle: artifact.title,
            artifactRelativePath: artifact.relativePath,
            selector: result.selector,
            tagName: result.tagName,
            text: result.text,
            html: result.html
          })
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error)
          setPreviewError(message)
          setFileError(message)
        })
    },
    [canvasHeight, canvasWidth, editing, artifact, interactive, onUseElementAsContext, setFileError]
  )

  useEffect(() => {
    setSelectedElementRect(null)
    setMeasuredContentSize(null)
    setSuppressDocumentScrollbars(false)
  }, [artifact?.id, artifact?.relativePath, shape.id])

  useEffect(() => {
    qualitySignatureRef.current = ''
    setQualityChecked(false)
    setQualityFindings(getDesignRuntimeQualityFindings(artifact?.relativePath))
    setQualityDetailsOpen(false)
  }, [artifact?.id, artifact?.relativePath, shape.id])

  useEffect(() => {
    if (!active || interactive) setQualityDetailsOpen(false)
  }, [active, interactive])

  // Leaving 修改 mode drops the picked element + its AI context so the rail clears.
  useEffect(() => {
    if (editing) return
    setSelectedElementRect(null)
    onUseElementAsContext?.(null)
  }, [editing, onUseElementAsContext])

  const queryAiCursor = useCallback(() => {
    const wv = webviewRef.current
    const query = executeHtmlFrameWebviewScript(wv, AI_SECTION_QUERY)
    if (!query) return
    void query
      .then((value) => {
        if (!value || typeof value !== 'object') return
        const v = value as Record<string, unknown>
        if (
          typeof v.left !== 'number' ||
          typeof v.top !== 'number' ||
          typeof v.width !== 'number' ||
          typeof v.height !== 'number'
        ) {
          return
        }
        setAiCursor({
          label: typeof v.label === 'string' ? v.label : '',
          left: v.left,
          top: v.top,
          width: v.width,
          height: v.height
        })
        if (aiFadeTimerRef.current) window.clearTimeout(aiFadeTimerRef.current)
        aiFadeTimerRef.current = window.setTimeout(() => setAiCursor(null), AI_CURSOR_TTL_MS)
      })
      .catch(() => undefined)
  }, [])

  // Live "AI is drawing here" cursor. The watcher bumps `revision` once when the
  // watch is established (the file just loaded — baseline, no cursor); every later
  // bump means the agent wrote more, so query the newest tagged section and move
  // the cursor onto it. A static design never bumps past the baseline → no cursor.
  useEffect(() => {
    if (!fileUrl) {
      firstRevisionRef.current = null
      setAiCursor(null)
      return
    }
    if (firstRevisionRef.current === null) {
      firstRevisionRef.current = revision
      return
    }
    if (revision <= firstRevisionRef.current) return
    const timer = window.setTimeout(queryAiCursor, 450)
    return () => window.clearTimeout(timer)
  }, [revision, fileUrl, queryAiCursor])

  useEffect(
    () => () => {
      if (aiFadeTimerRef.current) window.clearTimeout(aiFadeTimerRef.current)
    },
    []
  )

  // Promote a pending preview to "ready" only once the turn has settled: the file
  // holds a complete standalone HTML document and the agent is no longer streaming.
  // This keeps the transparent generating surface up for the whole write so the
  // canvas updates live without an opaque white frame appearing mid-stream.
  useEffect(() => {
    if (!artifact?.id || artifact.previewStatus !== 'pending') return
    if (previewState !== 'renderable' || drawingActive) return
    setArtifactPreviewStatus(artifact.id, 'ready')
  }, [artifact?.id, artifact?.previewStatus, previewState, drawingActive, setArtifactPreviewStatus])

  const webviewUrl = shouldRenderHtmlFrameWebview({
    fileUrl,
    previewState,
    hasRenderableContent: hasRenderablePreview
  })
    ? `${fileUrl}${fileUrl.includes('?') ? '&' : '?'}rev=${revision}`
    : ''

  // Imperatively navigate the (stable, never-remounted) webview to the newest file
  // revision. The declarative `src` attribute load only fires reliably on the first
  // mount; relying on it for every revision left the preview frozen on an early
  // chunk (header only) with the rest of the frame blank. Calling loadURL here once
  // the element is dom-ready — and again on each debounced revision bump — guarantees
  // the canvas reflects the final HTML, while keeping the old frame painted until the
  // next page is ready (no white flash, no remount).
  useEffect(() => {
    if (fileUrl !== loadedFileRef.current) {
      // A new file URL means React mounted a fresh <webview>; reset load tracking.
      webviewReadyRef.current = false
      loadedFileRef.current = fileUrl
      lastLoadedRevisionRef.current = -1
    }
    const wv = webviewRef.current
    if (!wv || !webviewUrl) return
    const target = webviewUrl
    const navigate = (): void => {
      if (lastLoadedRevisionRef.current === revision) return
      lastLoadedRevisionRef.current = revision
      if (typeof wv.loadURL === 'function') {
        try {
          void wv.loadURL(target).catch(() => undefined)
        } catch {
          /* webview may detach while React is swapping canvas state */
        }
      } else if (typeof wv.reload === 'function') {
        try {
          wv.reload()
        } catch {
          /* webview may detach while React is swapping canvas state */
        }
      }
    }
    if (webviewReadyRef.current) {
      navigate()
      return
    }
    const onReady = (): void => {
      webviewReadyRef.current = true
      navigate()
    }
    wv.addEventListener('dom-ready', onReady)
    return () => wv.removeEventListener('dom-ready', onReady)
  }, [fileUrl, revision, webviewMountNonce, webviewUrl])

  useEffect(() => {
    const wv = webviewRef.current
    if (!webviewUrl) return
    void executeHtmlFrameWebviewScript(
      wv,
      buildHtmlFrameScrollbarSuppressionScript(suppressDocumentScrollbars)
    )?.catch(() => undefined)
  }, [revision, suppressDocumentScrollbars, webviewMountNonce, webviewUrl])

  // Apply the webview's NATIVE zoom (not a CSS transform — see the comment above
  // htmlFrameWebviewZoomFactor) so its content renders at canvasWidth x
  // visualCanvasHeight logical size while the element itself only occupies the
  // small on-screen box. `zoom` changes continuously during pan/zoom gestures, and
  // setZoomFactor is comparatively expensive (a real re-layout in the guest), so
  // debounce it during gestures — the CSS size (cheap, native <webview> resize)
  // still tracks every frame, it is only the content's zoom that lags briefly.
  // Re-apply immediately (no debounce) on every navigation, since a fresh guest
  // page always starts back at 100% zoom.
  const applyZoomFactor = useCallback((): void => {
    const wv = webviewRef.current
    if (typeof wv?.setZoomFactor !== 'function') return
    try {
      wv.setZoomFactor(htmlFrameWebviewZoomFactor(zoomRef.current))
    } catch {
      /* webview may be mid-navigation/detached */
    }
  }, [])

  useEffect(() => {
    zoomRef.current = zoom
    const timer = window.setTimeout(applyZoomFactor, 120)
    return () => window.clearTimeout(timer)
  }, [zoom, applyZoomFactor])

  useEffect(() => {
    const wv = webviewRef.current
    if (!wv || !webviewUrl) return
    applyZoomFactor()
    wv.addEventListener('dom-ready', applyZoomFactor)
    return () => wv.removeEventListener('dom-ready', applyZoomFactor)
  }, [webviewMountNonce, webviewUrl, applyZoomFactor])

  const measureContentSize = useCallback((): void => {
    const wv = webviewRef.current
    if (!artifact?.id || artifactKind !== 'html') return
    const allowAutoGrow = shouldAutoResizeHtmlFrame({
      sizeMode: artifact.node?.sizeMode,
      role: foundationRole,
      previewStatus: artifact.previewStatus,
      parallelStatus: parallelState?.status
    })
    const measurement = executeHtmlFrameWebviewScript(wv, HTML_FRAME_CONTENT_SIZE_QUERY)
    if (!measurement) return
    void measurement
      .then((value) => {
        const decision = resolveHtmlFrameMeasurementDecision(value)
        if (!decision) return
        const store = useCanvasShapeStore.getState()
        const current = store.document.objects[shape.id]
        if (!current) return
        // Track the measured content height in BOTH directions. A grow-only rule
        // would leave the frame stuck at the tallest intermediate height ever seen
        // while the agent streamed the HTML, so once the final (shorter) layout
        // lands the frame keeps the leftover space as a big white band below the
        // content. Mirroring DesignProjectCanvas, follow the real content height.
        const { nextWidth, nextHeight, suppressScrollbars } = decision
        setMeasuredContentSize({ width: nextWidth, height: nextHeight })
        setSuppressDocumentScrollbars(suppressScrollbars)
        // A <webview> navigation replaces the guest document, so an already-true
        // React state value is not enough to keep the injected style alive across
        // streamed file reloads. Apply it to the CURRENT document immediately after
        // every measurement; the state/effect path still covers explicit toggles.
        void executeHtmlFrameWebviewScript(
          wv,
          buildHtmlFrameScrollbarSuppressionScript(suppressScrollbars)
        )?.catch(() => undefined)
        if (!allowAutoGrow) return
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
        useDesignWorkspaceStore.getState().updateArtifactNode(artifact.id, {
          x: Math.round(current.x),
          y: Math.round(current.y),
          width: widthChanged ? nextWidth : Math.round(current.width),
          height: heightChanged ? nextHeight : Math.round(current.height),
          sizeMode: 'auto',
          viewMode: artifact.node?.viewMode ?? 'preview'
        })
      })
      .catch(() => undefined)
  }, [
    artifact?.id,
    artifact?.node?.sizeMode,
    artifact?.node?.viewMode,
    artifact?.previewStatus,
    artifactKind,
    foundationRole,
    parallelState?.status,
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
    if (!webviewUrl) return
    const wv = webviewRef.current
    if (!wv) return
    wv.addEventListener('dom-ready', queueContentMeasurement)
    wv.addEventListener('did-finish-load', queueContentMeasurement)
    queueContentMeasurement()
    return () => {
      wv.removeEventListener('dom-ready', queueContentMeasurement)
      wv.removeEventListener('did-finish-load', queueContentMeasurement)
    }
  }, [canvasHeight, canvasWidth, queueContentMeasurement, revision, webviewMountNonce, webviewUrl])

  useEffect(() => {
    if (!webviewUrl || artifactKind !== 'html' || !artifact?.id || !artifactRelativePath) return
    const wv = webviewRef.current
    if (!wv) return
    let cancelled = false
    let timer = 0
    const queueAudit = (): void => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (cancelled) return
        const audit = executeHtmlFrameWebviewScript(wv, buildDesignRuntimeQualityAuditScript())
        if (!audit) return
        void audit
          .then((value) => {
            if (cancelled) return
            const findings = normalizeRuntimeQualityFindings(value)
            setQualityChecked(true)
            setQualityFindings(findings)
            setDesignRuntimeQualityFindings(artifactRelativePath, findings)
            const signature = JSON.stringify(findings.map((finding) => [
              finding.code,
              finding.severity,
              finding.message
            ]))
            if (signature === qualitySignatureRef.current) return
            qualitySignatureRef.current = signature
            onRuntimeQualityFindings?.({
              artifactId: artifact.id,
              artifactRelativePath,
              shapeId: shape.id,
              findings
            })
          })
          .catch(() => undefined)
      }, 750)
    }
    wv.addEventListener('dom-ready', queueAudit)
    wv.addEventListener('did-finish-load', queueAudit)
    queueAudit()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      wv.removeEventListener('dom-ready', queueAudit)
      wv.removeEventListener('did-finish-load', queueAudit)
    }
  }, [
    artifact?.id,
    artifactKind,
    artifactRelativePath,
    onRuntimeQualityFindings,
    shape.id,
    webviewMountNonce,
    webviewUrl
  ])

  if (screenWidth < 20 || screenHeight < 20) return <></>

  const drawingLabel = parallelState?.status === 'queued' ? 'AI 排队中…' : 'AI 正在绘制…'
  const failedMessage = parallelState?.status === 'failed'
    ? parallelState.error || '生成失败'
    : ''
  const qualityStatus = summarizeDesignHtmlQualityStatus(qualityFindings, qualityChecked)
  const qualityDetails = summarizeDesignHtmlQualityDetails(qualityFindings, qualityChecked)
  const qualityPanelWidth = Math.max(170, Math.min(300, screenWidth - 20))
  const frameRadius = Math.min(7, Math.max(3, screenWidth * 0.012))
  const chromeOffset = Math.min(28, Math.max(18, screenWidth * 0.045))
  const showChrome = screenWidth > 92 && screenHeight > 42
  const placeholderPreview = !hasRenderablePreview && previewState !== 'renderable'
  const transparentGeneratingSurface = placeholderPreview || drawingActive
  const visualCanvasHeight = htmlFrameVisualCanvasHeight(
    canvasHeight,
    measuredContentSize?.height ?? null
  )
  const visualScreenHeight = (visualCanvasHeight / canvasHeight) * screenHeight
  const QualityIcon =
    qualityStatus.kind === 'critical'
      ? AlertTriangle
      : qualityStatus.kind === 'warning'
        ? AlertTriangle
        : qualityStatus.kind === 'passed'
          ? CheckCircle2
          : ShieldCheck

  return (
    <div
      className="absolute overflow-visible"
      style={{
        left: screenX,
        top: screenY,
        width: screenWidth,
        height: visualScreenHeight,
        pointerEvents: htmlFrameOverlayPointerEvents({ panning, interactive, editing }),
        borderRadius: frameRadius
      }}
      onDoubleClick={handleDoubleClick}
    >
      {showChrome ? (
        <div
          className="pointer-events-none absolute left-0 right-0 z-20 flex items-center justify-between gap-2 text-[#7b8493] dark:text-[#9aa3b2]"
          style={{
            top: -chromeOffset,
            height: chromeOffset - 4,
            fontSize: Math.min(12, Math.max(10, screenWidth * 0.018))
          }}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <Monitor className="h-3.5 w-3.5 shrink-0" strokeWidth={1.7} />
            <span className="min-w-0 truncate font-medium">{shape.name}</span>
          </div>
          {active && !interactive && !drawingActive && !failedMessage ? (
            <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
              {webviewUrl && screenWidth > 220 ? (
                <div className="relative">
                  <button
                    type="button"
                    className={`flex max-w-[180px] items-center gap-1.5 rounded-full border px-2 py-1 text-[10.5px] font-semibold shadow-sm backdrop-blur-md transition hover:shadow-md ${qualityBadgeClasses(qualityStatus.kind)}`}
                    title={qualityStatus.title}
                    aria-expanded={qualityDetailsOpen}
                    onPointerDown={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      setQualityDetailsOpen((open) => !open)
                    }}
                  >
                    <QualityIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
                    <span className="min-w-0 truncate">{qualityStatus.label}</span>
                  </button>
                  {qualityDetailsOpen ? (
                    <div
                      className="absolute right-0 top-full z-30 mt-1.5 rounded-md border border-ds-border bg-white/95 p-2.5 text-left text-[11px] leading-snug text-ds-ink shadow-[0_16px_40px_rgba(20,47,95,0.18)] backdrop-blur-md dark:bg-ds-card/95"
                      style={{ width: qualityPanelWidth }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-start gap-2">
                        <QualityIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
                        <div className="min-w-0">
                          <div className="truncate text-[11.5px] font-semibold">{qualityDetails.heading}</div>
                          <div className="mt-0.5 text-[10.5px] text-ds-muted">{qualityDetails.body}</div>
                        </div>
                      </div>
                      {qualityDetails.rows.length > 0 ? (
                        <div className="mt-2 flex flex-col gap-1.5">
                          {qualityDetails.rows.map((finding) => (
                            <div
                              key={`${finding.severity}-${finding.code}`}
                              className="rounded-md border border-ds-border/80 bg-white/75 p-1.5 dark:bg-white/5"
                            >
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span
                                  className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9.5px] font-semibold ${qualityFindingClasses(finding.severity)}`}
                                >
                                  {qualityFindingLabel(finding.severity)}
                                </span>
                                <span className="min-w-0 truncate text-[10.5px] font-semibold text-ds-ink">
                                  {finding.code}
                                </span>
                              </div>
                              <div className="mt-1 break-words text-[10.5px] font-medium text-ds-ink">
                                {finding.message}
                              </div>
                              <div className="mt-0.5 break-words text-[10.5px] text-ds-muted">
                                {finding.suggestion}
                              </div>
                            </div>
                          ))}
                          {qualityDetails.overflowCount > 0 ? (
                            <div className="px-1 text-[10.5px] font-medium text-ds-muted">
                              +{qualityDetails.overflowCount} more
                            </div>
                          ) : null}
                          {artifact?.id && artifactRelativePath && onRequestQualityRepair ? (
                            <button
                              type="button"
                              className="mt-0.5 inline-flex w-fit items-center gap-1.5 rounded-md border border-accent/30 bg-accent px-2 py-1 text-[10.5px] font-semibold text-white shadow-sm transition hover:opacity-90"
                              onPointerDown={(e) => e.stopPropagation()}
                              onDoubleClick={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation()
                                onRequestQualityRepair({
                                  artifactId: artifact.id,
                                  artifactRelativePath,
                                  shapeId: shape.id,
                                  findings: qualityFindings
                                })
                                setQualityDetailsOpen(false)
                              }}
                            >
                              <Brush className="h-3 w-3" strokeWidth={1.9} aria-hidden="true" />
                              Repair
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {webviewUrl && screenWidth > 170 ? (
                <>
                  {editing ? (
                    <span className="rounded-full border border-accent/30 bg-white/88 px-2 py-1 text-[10.5px] font-medium text-accent shadow-sm backdrop-blur-md dark:bg-ds-card/88">
                      点击文字进行修改
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleModify(shape.id)
                    }}
                    title={editing ? '完成修改' : '修改内容'}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold shadow-[0_10px_30px_rgba(20,47,95,0.12)] backdrop-blur-md transition ${
                      editing
                        ? 'border-accent bg-accent text-white hover:opacity-90'
                        : 'border-ds-border bg-white/90 text-ds-ink hover:bg-white dark:bg-ds-card/88'
                    }`}
                  >
                    {editing ? (
                      <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <PenLine className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
                    )}
                    {editing ? '完成' : '修改'}
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className={`relative h-full w-full overflow-hidden border ${
          transparentGeneratingSurface
            ? active
              ? 'border-dashed border-[#6557ff] bg-transparent shadow-none'
              : 'border-dashed border-ds-border/70 bg-transparent shadow-none dark:border-white/20'
            : `bg-white shadow-[0_12px_30px_rgba(15,23,42,0.10)] dark:bg-[#101214] ${
                active
                  ? 'border-[#6557ff] shadow-[0_0_0_1px_rgba(101,87,255,0.45),0_16px_38px_rgba(15,23,42,0.14)]'
                  : 'border-black/10 dark:border-white/12'
              }`
        }`}
        style={{ borderRadius: frameRadius }}
      >
        <div
          className="absolute left-0 top-0 overflow-hidden"
          style={{
            width: screenWidth,
            height: visualScreenHeight
          }}
        >
          {webviewUrl ? (
            <webview
              // Key on the stable file URL (NOT the rev'd one) so streaming writes
              // never unmount/remount the webview. A remount destroys the webContents
              // and repaints white; keeping the element mounted lets Electron navigate
              // in place via the `src` change while the old frame stays painted until
              // the next page is ready, so the canvas updates without a white flash.
              //
              // Deliberately NOT css-transformed (see htmlFrameWebviewZoomFactor): the
              // element is sized at its REAL on-screen pixel size and the guest's
              // content is scaled via the native zoom API instead, avoiding a
              // long-standing Chromium bug where transform-scaling a <webview>
              // produces cropped/blank rendering that worsens away from the origin.
              key={fileUrl}
              ref={setWebviewNode as React.Ref<WebviewElement>}
              src={fileUrl}
              partition="kun-proto"
              webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes"
              className="block border-0"
              style={{
                width: screenWidth,
                height: visualScreenHeight,
                pointerEvents: interactive ? 'auto' : 'none'
              }}
            />
          ) : (
            <div
              className={
                transparentGeneratingSurface
                  ? 'flex h-full w-full items-start justify-center p-3 text-ds-muted'
                  : 'flex h-full w-full items-center justify-center text-ds-faint'
              }
            >
              <div
                className={
                  transparentGeneratingSurface
                    ? 'flex max-w-[70%] items-center gap-1.5 rounded-full border border-accent/25 bg-white/90 px-3 py-1.5 text-center text-[11px] font-semibold text-accent shadow-[0_10px_30px_rgba(20,47,95,0.12)] backdrop-blur-md dark:bg-ds-card/90'
                    : 'flex flex-col items-center gap-2 text-center'
                }
                style={{ fontSize: Math.min(16, Math.max(12, screenWidth * 0.018)) }}
              >
                {drawingActive || placeholderPreview ? (
                  <Brush
                    className="h-5 w-5 animate-pulse text-accent"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                ) : null}
                <span>
                  {previewError ||
                    failedMessage ||
                    (artifact ? (drawingActive ? drawingLabel : 'Generating...') : 'No content')}
                </span>
              </div>
            </div>
          )}
          {webviewUrl && drawingActive && !aiCursor ? (
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute right-3 top-3 flex max-w-[70%] items-center gap-1.5 rounded-full border border-accent/30 bg-white/88 px-2.5 py-1.5 text-[11px] font-semibold text-accent shadow-[0_10px_30px_rgba(20,47,95,0.14)] backdrop-blur-md">
                <Brush className="h-3.5 w-3.5 animate-pulse" strokeWidth={1.8} aria-hidden="true" />
                <span className="min-w-0 truncate">{drawingLabel}</span>
              </div>
            </div>
          ) : null}
          {webviewUrl && failedMessage ? (
            <div className="pointer-events-none absolute inset-x-3 top-3 rounded-md border border-red-300/70 bg-white/92 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 shadow-sm">
              {failedMessage}
            </div>
          ) : null}
          {webviewUrl && editing && !interactive ? (
            <div
              className="absolute inset-0 cursor-crosshair"
              title="点击元素进行修改"
              onPointerDown={selectElementAt}
            />
          ) : null}
          {selectedElementRect && editing && !interactive ? (
            <div
              className="pointer-events-none absolute border border-accent bg-accent/10 shadow-[0_0_0_1px_rgba(255,255,255,0.75)]"
              style={{
                // selectedElementRect comes from the guest's own getBoundingClientRect(),
                // i.e. logical canvasWidth-space px (zoomFactor doesn't change how the
                // guest reports its own coordinates). This overlay now sits in a
                // screen-sized (not canvas-sized+transformed) wrapper, so project the
                // logical rect into screen space explicitly.
                left: selectedElementRect.left * zoom,
                top: selectedElementRect.top * zoom,
                width: selectedElementRect.width * zoom,
                height: selectedElementRect.height * zoom
              }}
            />
          ) : null}
          {aiCursor ? (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {/* Glow on the section the agent just wrote (logical -> screen space, see above) */}
              <div
                className="absolute rounded-[3px] border"
                style={{
                  left: aiCursor.left * zoom,
                  top: aiCursor.top * zoom,
                  width: aiCursor.width * zoom,
                  height: aiCursor.height * zoom,
                  borderColor: 'color-mix(in srgb, var(--ds-accent) 75%, transparent)',
                  background: 'color-mix(in srgb, var(--ds-accent) 9%, transparent)',
                  boxShadow:
                    '0 0 0 1px color-mix(in srgb, var(--ds-accent) 30%, transparent), 0 8px 26px color-mix(in srgb, var(--ds-accent) 22%, transparent)',
                  transition:
                    'left 360ms cubic-bezier(0.22,1,0.36,1), top 360ms cubic-bezier(0.22,1,0.36,1), width 360ms ease, height 360ms ease'
                }}
              />
              {/* Animated AI cursor + label, clamped to stay visible. The -8/-2/-22 nudges
                  are constant SCREEN px (like the rest of the UI chrome), applied after
                  projecting the underlying rect into screen space. */}
              <div
                className="absolute flex items-center gap-1"
                style={{
                  left: Math.min(aiCursor.left * zoom + aiCursor.width * zoom - 8, screenWidth - 8),
                  top: Math.max(2, Math.min(aiCursor.top * zoom - 2, visualScreenHeight - 22)),
                  transition:
                    'left 360ms cubic-bezier(0.22,1,0.36,1), top 360ms cubic-bezier(0.22,1,0.36,1)'
                }}
              >
                <MousePointer2
                  className="h-3.5 w-3.5 drop-shadow"
                  strokeWidth={1.6}
                  style={{ color: 'var(--ds-accent)', fill: 'var(--ds-accent)' }}
                />
                <span
                  className="max-w-[150px] truncate rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white shadow"
                  style={{ background: 'var(--ds-accent)' }}
                >
                  {aiCursor.label || 'AI 正在生成…'}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const ScreenOverlay = memo(ScreenOverlayInner)

type Props = {
  workspaceRoot: string
  interactiveId: string | null
  editingId: string | null
  onToggleInteractive: (shapeId: string) => void
  onToggleModify: (shapeId: string) => void
  onUseElementAsContext?: (context: DesignHtmlElementContext | null, promptSeed?: string) => void
  onRuntimeQualityFindings?: (payload: DesignRuntimeQualityPayload) => void
  onRequestQualityRepair?: (payload: DesignRuntimeQualityPayload) => void
}

export function HtmlFrameOverlay({
  workspaceRoot,
  interactiveId,
  editingId,
  onToggleInteractive,
  onToggleModify,
  onUseElementAsContext,
  onRuntimeQualityFindings,
  onRequestQualityRepair
}: Props): ReactElement {
  const objects = useCanvasShapeStore((s) => s.document.objects)
  const vbox = useCanvasViewportStore((s) => s.vbox)
  const containerWidth = useCanvasViewportStore((s) => s.containerWidth)
  const containerHeight = useCanvasViewportStore((s) => s.containerHeight)
  const activeTool = useCanvasViewportStore((s) => s.activeTool)
  const selectedIds = useCanvasSelectionStore((s) => s.selectedIds)

  const zoom = containerWidth / vbox.width
  const panning = activeTool === 'hand'

  const htmlFrames = useMemo(() => {
    const frames: CanvasShape[] = []
    for (const id of Object.keys(objects)) {
      const shape = objects[id]
      if (shape && isHtmlFrame(shape) && shape.visible) {
        frames.push(shape)
      }
    }
    return frames
  }, [objects])

  // Visibility + priority: viewport-visible frames first, selected frames get priority
  const visibleFrames = useMemo(() => {
    return htmlFrames
      .filter((shape) => {
        const right = shape.x + shape.width
        const bottom = shape.y + shape.height
        const vRight = vbox.x + vbox.width
        const vBottom = vbox.y + vbox.height
        return right > vbox.x && shape.x < vRight && bottom > vbox.y && shape.y < vBottom
      })
      .sort((a, b) => {
        const aSelected = selectedIds.has(a.id) ? 1 : 0
        const bSelected = selectedIds.has(b.id) ? 1 : 0
        return bSelected - aSelected
      })
  }, [htmlFrames, vbox, selectedIds])

  const selectedIdsKey = useMemo(() => [...selectedIds].sort().join(','), [selectedIds])

  useEffect(() => {
    onUseElementAsContext?.(null)
  }, [onUseElementAsContext, selectedIdsKey])

  if (htmlFrames.length === 0 || zoom < MIN_ZOOM_FOR_WEBVIEW) return <></>

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {visibleFrames.slice(0, MAX_ACTIVE_WEBVIEWS).map((shape) => {
        const screenX = ((shape.x - vbox.x) / vbox.width) * containerWidth
        const screenY = ((shape.y - vbox.y) / vbox.height) * containerHeight
        const screenWidth = (shape.width / vbox.width) * containerWidth
        const screenHeight = (shape.height / vbox.height) * containerHeight
        const active = selectedIds.has(shape.id)

        return (
          <ScreenOverlay
            key={shape.id}
            shape={shape}
            workspaceRoot={workspaceRoot}
            screenX={screenX}
            screenY={screenY}
            screenWidth={screenWidth}
            screenHeight={screenHeight}
            zoom={zoom}
            active={active}
            interactive={interactiveId === shape.id}
            panning={panning}
            editing={editingId === shape.id}
            onDoubleClick={onToggleInteractive}
            onToggleModify={onToggleModify}
            onUseElementAsContext={onUseElementAsContext}
            onRuntimeQualityFindings={onRuntimeQualityFindings}
            onRequestQualityRepair={onRequestQualityRepair}
          />
        )
      })}
    </div>
  )
}
