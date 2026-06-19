import type { ReactElement, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  Code2,
  ExternalLink,
  Eye,
  Globe,
  Monitor,
  Moon,
  RotateCw,
  Smartphone,
  Sun,
  Tablet,
  type LucideIcon
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useChatStore } from '../../store/chat-store'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'
import { DESIGN_VIEWPORT_WIDTHS, type DesignViewport } from '../../design/design-types'
import { startWriteWorkspaceFileWatch } from '../../write/write-file-watch'
import { highlightCodeHtml, renderFallbackCodeHtml } from '../../lib/code-highlighting'

type WebviewEl = HTMLElement & { reload?: () => void }

const VIEWPORTS: { id: DesignViewport; icon: LucideIcon; labelKey: string }[] = [
  { id: 'mobile', icon: Smartphone, labelKey: 'designViewportMobile' },
  { id: 'tablet', icon: Tablet, labelKey: 'designViewportTablet' },
  { id: 'desktop', icon: Monitor, labelKey: 'designViewportDesktop' }
]

const DEVICE_HEIGHTS: Record<DesignViewport, number> = { mobile: 740, tablet: 1000, desktop: 0 }
const MAX_WATCH_RETRIES = 40

function isCompleteHtml(content: string): boolean {
  return content.trim().toLowerCase().endsWith('</html>')
}

/**
 * Live design canvas. The active artifact file is watched (write-file-watch),
 * so the agent's incremental writes refresh the canvas in place — the webview
 * is reloaded (not remounted) once a complete document exists. Preview/code/live
 * are the discriminated-union seam for P2/P3 surfaces.
 */
export function DesignCanvas(): ReactElement {
  const { t } = useTranslation('common')
  const busy = useChatStore((s) => s.busy)
  const workspaceRoot = useDesignWorkspaceStore((s) => s.workspaceRoot)
  const artifacts = useDesignWorkspaceStore((s) => s.artifacts)
  const activeArtifactId = useDesignWorkspaceStore((s) => s.activeArtifactId)
  const canvasView = useDesignWorkspaceStore((s) => s.canvasView)
  const viewport = useDesignWorkspaceStore((s) => s.viewport)
  const devPreviewUrl = useDesignWorkspaceStore((s) => s.devPreviewUrl)
  const canvasBackground = useDesignWorkspaceStore((s) => s.canvasBackground)
  const liveRefresh = useDesignWorkspaceStore((s) => s.liveRefresh)
  const deviceFrame = useDesignWorkspaceStore((s) => s.deviceFrame)
  const setCanvasView = useDesignWorkspaceStore((s) => s.setCanvasView)
  const setViewport = useDesignWorkspaceStore((s) => s.setViewport)
  const setCanvasBackground = useDesignWorkspaceStore((s) => s.setCanvasBackground)

  const activeArtifact = artifacts.find((item) => item.id === activeArtifactId) ?? null
  const relativePath = activeArtifact?.relativePath ?? ''

  const [fileUrl, setFileUrl] = useState('')
  const [highlightHtml, setHighlightHtml] = useState(() => renderFallbackCodeHtml(''))
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const webviewRef = useRef<WebviewEl | null>(null)
  const authorizedPathRef = useRef('')
  const sourceRef = useRef('')

  // Watch the artifact file: live-refresh preview (reload, not remount) and the
  // code view as the agent writes. Retries while the file is not yet created.
  useEffect(() => {
    authorizedPathRef.current = ''
    sourceRef.current = ''
    setFileUrl('')
    setReady(false)
    setError('')
    if (canvasView === 'live' || !relativePath || !workspaceRoot) return
    if (typeof window.kunGui?.watchWorkspaceFile !== 'function') {
      setError(t('designCanvasUnavailable'))
      return
    }
    let cancelled = false
    let stop = (): void => {}
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let attempts = 0

    const onContent = (content: string): void => {
      if (cancelled) return
      sourceRef.current = content
      if (canvasView === 'code') {
        void highlightCodeHtml(content, 'html').then((html) => {
          if (!cancelled) setHighlightHtml(html)
        })
      }
      if (!isCompleteHtml(content)) return
      setReady(true)
      if (canvasView !== 'preview') return
      if (authorizedPathRef.current === relativePath && webviewRef.current?.reload) {
        if (liveRefresh) webviewRef.current.reload()
        return
      }
      void window.kunGui
        .authorizeWritePrototype({ path: relativePath, workspaceRoot })
        .then((res) => {
          if (cancelled) return
          if (res.ok) {
            authorizedPathRef.current = relativePath
            setFileUrl(res.fileUrl)
          } else {
            setError(res.message)
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e))
        })
    }

    const start = (): void => {
      stop = startWriteWorkspaceFileWatch({
        api: window.kunGui,
        workspaceRoot,
        path: relativePath,
        kind: 'text',
        onTextSnapshot: (snapshot) => {
          if (typeof snapshot.content === 'string') onContent(snapshot.content)
        },
        onImageChanged: () => {},
        onError: () => {
          // Most often the agent has not created the file yet — retry briefly.
          stop()
          if (cancelled) return
          attempts += 1
          if (attempts <= MAX_WATCH_RETRIES) {
            retryTimer = setTimeout(start, 1500)
          }
        }
      })
    }
    start()
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      stop()
    }
  }, [relativePath, workspaceRoot, canvasView, liveRefresh, t])

  // Re-highlight the cached source when switching into code view.
  useEffect(() => {
    if (canvasView !== 'code') return
    void highlightCodeHtml(sourceRef.current, 'html').then(setHighlightHtml)
  }, [canvasView])

  const openExternal = (): void => {
    if (canvasView === 'live') {
      if (devPreviewUrl) void window.kunGui?.openExternal?.(devPreviewUrl)
      return
    }
    if (relativePath && workspaceRoot && typeof window.kunGui?.openWritePrototype === 'function') {
      void window.kunGui.openWritePrototype({ path: relativePath, workspaceRoot })
    }
  }
  const reload = (): void => {
    if (webviewRef.current?.reload) webviewRef.current.reload()
  }
  const copyCode = (): void => {
    void navigator?.clipboard?.writeText?.(sourceRef.current)
  }

  const framed = viewport !== 'desktop' && deviceFrame
  const viewportWidth = DESIGN_VIEWPORT_WIDTHS[viewport]
  const isWebViewSurface = canvasView === 'preview' || canvasView === 'live'

  const toolbarButton = (active: boolean): string =>
    `inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
      active
        ? 'bg-white text-[#1f2733] shadow-[0_1px_2px_rgba(20,47,95,0.12)] dark:bg-white/[0.14] dark:text-white'
        : 'text-[#8b95a3] hover:text-[#1f2733] dark:text-white/45 dark:hover:text-white/85'
    }`
  const actionButton =
    'inline-flex h-7 w-7 items-center justify-center rounded-md text-[#8b95a3] transition-colors hover:text-[#1f2733] dark:text-white/45 dark:hover:text-white/85'

  const deviceWrap = (children: ReactNode): ReactElement => (
    <div
      className={`flex h-full justify-center overflow-auto p-4 ${
        canvasBackground === 'dark' ? 'bg-[#1b1b1d]' : 'bg-[#eef1f5]'
      }`}
    >
      <div
        className={
          framed
            ? 'shrink-0 overflow-hidden rounded-[26px] border-[5px] border-[#222731] bg-white shadow-2xl'
            : 'h-full w-full overflow-hidden rounded-lg bg-white shadow-sm'
        }
        style={framed ? { width: viewportWidth ?? undefined, height: DEVICE_HEIGHTS[viewport] } : undefined}
      >
        {children}
      </div>
    </div>
  )

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-ds-main">
      <div className="ds-no-drag flex shrink-0 items-center gap-2 px-3 py-2 shadow-[inset_0_-1px_0_var(--ds-sidebar-row-ring)]">
        {canvasView !== 'code' ? (
          <div className="flex items-center gap-0.5 rounded-lg bg-black/[0.04] p-0.5 dark:bg-white/[0.05]">
            {VIEWPORTS.map(({ id, icon: Icon, labelKey }) => (
              <button
                key={id}
                type="button"
                aria-label={t(labelKey)}
                title={t(labelKey)}
                onClick={() => setViewport(id)}
                className={toolbarButton(viewport === id)}
              >
                <Icon className="h-4 w-4" strokeWidth={1.9} />
              </button>
            ))}
          </div>
        ) : null}
        <div className="ml-auto flex items-center gap-0.5 rounded-lg bg-black/[0.04] p-0.5 dark:bg-white/[0.05]">
          <button
            type="button"
            aria-label={t('designViewPreview')}
            title={t('designViewPreview')}
            onClick={() => setCanvasView('preview')}
            className={toolbarButton(canvasView === 'preview')}
          >
            <Eye className="h-4 w-4" strokeWidth={1.9} />
          </button>
          <button
            type="button"
            aria-label={t('designViewCode')}
            title={t('designViewCode')}
            onClick={() => setCanvasView('code')}
            className={toolbarButton(canvasView === 'code')}
          >
            <Code2 className="h-4 w-4" strokeWidth={1.9} />
          </button>
          {devPreviewUrl ? (
            <button
              type="button"
              aria-label={t('designViewLive')}
              title={t('designViewLive')}
              onClick={() => setCanvasView('live')}
              className={toolbarButton(canvasView === 'live')}
            >
              <Globe className="h-4 w-4" strokeWidth={1.9} />
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-0.5">
          {isWebViewSurface ? (
            <button
              type="button"
              aria-label={t('designToggleBackground')}
              title={t('designToggleBackground')}
              onClick={() => setCanvasBackground(canvasBackground === 'dark' ? 'light' : 'dark')}
              className={actionButton}
            >
              {canvasBackground === 'dark' ? (
                <Sun className="h-4 w-4" strokeWidth={1.9} />
              ) : (
                <Moon className="h-4 w-4" strokeWidth={1.9} />
              )}
            </button>
          ) : null}
          {canvasView === 'code' ? (
            <button type="button" aria-label={t('designCopyCode')} title={t('designCopyCode')} onClick={copyCode} className={actionButton}>
              <Code2 className="h-4 w-4" strokeWidth={1.9} />
            </button>
          ) : null}
          {isWebViewSurface ? (
            <button type="button" aria-label={t('designOpenExternal')} title={t('designOpenExternal')} onClick={openExternal} className={actionButton}>
              <ExternalLink className="h-4 w-4" strokeWidth={1.9} />
            </button>
          ) : null}
          {canvasView !== 'live' ? (
            <button type="button" aria-label={t('designCanvasReload')} title={t('designCanvasReload')} onClick={reload} className={actionButton}>
              <RotateCw className="h-4 w-4" strokeWidth={1.9} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {canvasView === 'live' ? (
          devPreviewUrl ? (
            deviceWrap(
              <webview
                key={`design-live:${devPreviewUrl}`}
                src={devPreviewUrl}
                partition="kun-proto"
                webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes"
                className="h-full w-full border-0"
              />
            )
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-[#646e7c] dark:text-white/55">
              {t('designLiveNoServer')}
            </div>
          )
        ) : !activeArtifact ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-[#646e7c] dark:text-white/55">
            {t('designCanvasPlaceholder')}
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-[#c0392b] dark:text-[#ff8f8f]">
            {error}
          </div>
        ) : canvasView === 'code' ? (
          <div
            className="h-full overflow-auto text-[12px] leading-relaxed [&>pre]:min-h-full [&>pre]:!m-0 [&>pre]:!p-4"
            dangerouslySetInnerHTML={{ __html: highlightHtml }}
          />
        ) : fileUrl ? (
          deviceWrap(
            <webview
              ref={(node) => {
                webviewRef.current = (node as WebviewEl) ?? null
              }}
              src={fileUrl}
              partition="kun-proto"
              webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes"
              className="h-full w-full border-0"
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-[#646e7c] dark:text-white/55">
            {busy || !ready ? t('designCanvasGenerating') : t('designCanvasLoading')}
          </div>
        )}
      </div>
    </div>
  )
}
