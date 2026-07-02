import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { AlertTriangle, Brush, Check, CheckCircle2, Monitor, MousePointer2, PenLine, ShieldCheck } from 'lucide-react'
import { useCanvasShapeStore } from '../../../design/canvas/canvas-shape-store'
import { useCanvasViewportStore } from '../../../design/canvas/canvas-viewport-store'
import { useCanvasSelectionStore } from '../../../design/canvas/canvas-selection-store'
import { isHtmlFrame, type CanvasShape } from '../../../design/canvas/canvas-types'
import type { DesignHtmlElementContext } from '../../../design/design-composer-context'
import { startDesignHtmlPreviewWatch } from '../../../design/design-preview-file'
import { useDesignWorkspaceStore } from '../../../design/design-workspace-store'
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

const MAX_ACTIVE_WEBVIEWS = 6
const MIN_ZOOM_FOR_WEBVIEW = 0.04

/** Hide the "AI is drawing here" cursor this long after the last file change. */
const AI_CURSOR_TTL_MS = 4500

/** A just-created screen has no HTML file yet; poll fast for this long, then slowly. */
const PREVIEW_FAST_POLL_MS = 6_000
/** Give up polling a preview that never lands after this (matches the page-generation ceiling). */
const PREVIEW_MAX_WAIT_MS = 300_000

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
}

type ScreenOverlayProps = {
  shape: CanvasShape
  workspaceRoot: string
  screenX: number
  screenY: number
  screenWidth: number
  screenHeight: number
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
  const qualitySignatureRef = useRef('')
  const [qualityChecked, setQualityChecked] = useState(false)
  const [qualityFindings, setQualityFindings] = useState<DesignHtmlQualityFinding[]>([])
  const [qualityDetailsOpen, setQualityDetailsOpen] = useState(false)

  const artifact = useDesignWorkspaceStore((s) =>
    s.artifacts.find((a) => a.id === shape.htmlArtifactId)
  )
  const artifactKind = artifact?.kind
  const artifactRelativePath = artifact?.relativePath
  const parallelState = useDesignWorkspaceStore((s) =>
    shape.htmlArtifactId ? s.parallelPageStates[shape.htmlArtifactId] : undefined
  )
  const setFileError = useDesignWorkspaceStore((s) => s.setFileError)

  useEffect(() => {
    let cancelled = false
    let cleanupWatch: (() => void) | null = null
    let retryTimer = 0
    const startedAt = Date.now()
    setFileUrl('')
    setRevision(0)
    setPreviewError('')
    if (!artifactRelativePath || artifactKind !== 'html' || !workspaceRoot) return
    if (typeof window.kunGui?.authorizeWritePrototype !== 'function') return

    const reportError = (message: string): void => {
      setPreviewError(message)
      setFileError(message)
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
  }, [artifactKind, artifactRelativePath, setFileError, workspaceRoot])

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDoubleClick(shape.id)
    },
    [shape.id, onDoubleClick]
  )

  const selectElementAt = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      if (!editing || interactive || !artifact || !webviewRef.current?.executeJavaScript) return
      event.preventDefault()
      event.stopPropagation()
      const rect = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      void webviewRef.current
        .executeJavaScript(`(() => {
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
    [editing, artifact, interactive, onUseElementAsContext, setFileError]
  )

  useEffect(() => {
    setSelectedElementRect(null)
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
    if (typeof wv?.executeJavaScript !== 'function') return
    void wv
      .executeJavaScript(AI_SECTION_QUERY)
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

  const titleBarHeight = Math.min(28, screenHeight * 0.06)
  const webviewUrl = fileUrl ? `${fileUrl}${fileUrl.includes('?') ? '&' : '?'}rev=${revision}` : ''

  useEffect(() => {
    if (!webviewUrl || artifactKind !== 'html' || !artifact?.id || !artifactRelativePath) return
    const wv = webviewRef.current
    if (typeof wv?.executeJavaScript !== 'function') return
    const executeJavaScript = wv.executeJavaScript.bind(wv)
    let cancelled = false
    let timer = 0
    const queueAudit = (): void => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (cancelled) return
        void executeJavaScript(buildDesignRuntimeQualityAuditScript())
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
  }, [artifact?.id, artifactKind, artifactRelativePath, onRuntimeQualityFindings, shape.id, webviewUrl])

  if (screenWidth < 20 || screenHeight < 20) return <></>

  const drawingActive = parallelState?.status === 'queued' || parallelState?.status === 'running'
  const drawingLabel = parallelState?.status === 'queued' ? 'AI 排队中…' : 'AI 正在绘制…'
  const failedMessage = parallelState?.status === 'failed'
    ? parallelState.error || '生成失败'
    : ''
  const qualityStatus = summarizeDesignHtmlQualityStatus(qualityFindings, qualityChecked)
  const qualityDetails = summarizeDesignHtmlQualityDetails(qualityFindings, qualityChecked)
  const qualityPanelWidth = Math.max(170, Math.min(300, screenWidth - 20))
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
      className="absolute overflow-hidden"
      style={{
        left: screenX,
        top: screenY,
        width: screenWidth,
        height: screenHeight,
        pointerEvents: panning ? 'none' : active || interactive ? 'auto' : 'none',
        borderRadius: Math.min(8, screenWidth * 0.01)
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-1 border-b px-2 text-ds-muted"
        style={{
          height: titleBarHeight,
          fontSize: Math.min(11, titleBarHeight * 0.42),
          borderColor: active ? 'var(--ds-accent)' : 'var(--ds-border)',
          backgroundColor: active
            ? 'color-mix(in srgb, var(--ds-accent) 8%, white)'
            : 'rgba(255,255,255,0.94)'
        }}
      >
        <Monitor style={{ width: titleBarHeight * 0.45, height: titleBarHeight * 0.45 }} strokeWidth={1.8} />
        <span className="min-w-0 flex-1 truncate font-medium">{shape.name}</span>
        <span className="shrink-0 opacity-60">
          {Math.round(shape.width)}x{Math.round(shape.height)}
        </span>
      </div>

      {/* Content */}
      <div style={{ height: screenHeight - titleBarHeight }} className="relative bg-white">
        {webviewUrl ? (
          <webview
            key={webviewUrl}
            ref={webviewRef as React.Ref<WebviewElement>}
            src={webviewUrl}
            partition="kun-proto"
            webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes"
            className="h-full w-full border-0"
            style={{ pointerEvents: interactive ? 'auto' : 'none' }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-ds-faint">
            <div
              className="flex flex-col items-center gap-2 text-center"
              style={{ fontSize: Math.min(12, screenWidth * 0.028) }}
            >
              {drawingActive ? (
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
        {webviewUrl && active && !interactive && !drawingActive && !failedMessage && screenWidth > 190 ? (
          <div className="pointer-events-none absolute left-2.5 top-2.5 z-20 flex flex-col items-start gap-1.5">
            <button
              type="button"
              className={`pointer-events-auto flex max-w-[min(210px,60%)] items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10.5px] font-semibold shadow-sm backdrop-blur-md transition hover:shadow-md ${qualityBadgeClasses(qualityStatus.kind)}`}
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
                className="pointer-events-auto rounded-md border border-ds-border bg-white/95 p-2.5 text-left text-[11px] leading-snug text-ds-ink shadow-[0_16px_40px_rgba(20,47,95,0.18)] backdrop-blur-md"
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
                        className="rounded-md border border-ds-border/80 bg-white/75 p-1.5"
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
        {webviewUrl && active && !interactive && !drawingActive && !failedMessage && screenWidth > 160 ? (
          <div className="pointer-events-none absolute right-2.5 top-2.5 z-20 flex items-center gap-1.5">
            {editing ? (
              <span className="rounded-full border border-accent/30 bg-white/88 px-2 py-1 text-[10.5px] font-medium text-accent shadow-sm backdrop-blur-md">
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
              className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-[0_10px_30px_rgba(20,47,95,0.14)] backdrop-blur-md transition ${
                editing
                  ? 'border-accent bg-accent text-white hover:opacity-90'
                  : 'border-ds-border bg-white/90 text-ds-ink hover:bg-white'
              }`}
            >
              {editing ? (
                <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              ) : (
                <PenLine className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
              )}
              {editing ? '完成' : '修改'}
            </button>
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
              left: selectedElementRect.left,
              top: selectedElementRect.top,
              width: selectedElementRect.width,
              height: selectedElementRect.height
            }}
          />
        ) : null}
        {aiCursor ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {/* Glow on the section the agent just wrote */}
            <div
              className="absolute rounded-[3px] border"
              style={{
                left: aiCursor.left,
                top: aiCursor.top,
                width: aiCursor.width,
                height: aiCursor.height,
                borderColor: 'color-mix(in srgb, var(--ds-accent) 75%, transparent)',
                background: 'color-mix(in srgb, var(--ds-accent) 9%, transparent)',
                boxShadow:
                  '0 0 0 1px color-mix(in srgb, var(--ds-accent) 30%, transparent), 0 8px 26px color-mix(in srgb, var(--ds-accent) 22%, transparent)',
                transition:
                  'left 360ms cubic-bezier(0.22,1,0.36,1), top 360ms cubic-bezier(0.22,1,0.36,1), width 360ms ease, height 360ms ease'
              }}
            />
            {/* Animated AI cursor + label, clamped to stay visible */}
            <div
              className="absolute flex items-center gap-1"
              style={{
                left: Math.min(aiCursor.left + aiCursor.width - 8, screenWidth - 8),
                top: Math.max(2, Math.min(aiCursor.top - 2, screenHeight - titleBarHeight - 22)),
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
  )
}

const ScreenOverlay = memo(ScreenOverlayInner)

type Props = {
  workspaceRoot: string
  onUseElementAsContext?: (context: DesignHtmlElementContext | null, promptSeed?: string) => void
  onRuntimeQualityFindings?: (payload: DesignRuntimeQualityPayload) => void
  onRequestQualityRepair?: (payload: DesignRuntimeQualityPayload) => void
}

export function HtmlFrameOverlay({
  workspaceRoot,
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

  const [interactiveId, setInteractiveId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

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

  const onDoubleClick = useCallback((shapeId: string) => {
    // Browsing the live page and 修改 (element-pick) are mutually exclusive.
    setEditingId(null)
    setInteractiveId((prev) => (prev === shapeId ? null : shapeId))
  }, [])

  const onToggleModify = useCallback((shapeId: string) => {
    setInteractiveId(null)
    setEditingId((prev) => (prev === shapeId ? null : shapeId))
  }, [])

  // Exit interactive / 修改 modes on selection change
  useEffect(() => {
    if (interactiveId && !selectedIds.has(interactiveId)) {
      setInteractiveId(null)
    }
    if (editingId && !selectedIds.has(editingId)) {
      setEditingId(null)
    }
  }, [selectedIds, interactiveId, editingId])

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
            active={active}
            interactive={interactiveId === shape.id}
            panning={panning}
            editing={editingId === shape.id}
            onDoubleClick={onDoubleClick}
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
