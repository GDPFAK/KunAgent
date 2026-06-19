import type { ReactElement } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Code2, Eye, Globe, Monitor, RotateCw, Smartphone, Tablet, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useChatStore } from '../../store/chat-store'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'
import { DESIGN_VIEWPORT_WIDTHS, type DesignViewport } from '../../design/design-types'

const VIEWPORTS: { id: DesignViewport; icon: LucideIcon; labelKey: string }[] = [
  { id: 'mobile', icon: Smartphone, labelKey: 'designViewportMobile' },
  { id: 'tablet', icon: Tablet, labelKey: 'designViewportTablet' },
  { id: 'desktop', icon: Monitor, labelKey: 'designViewportDesktop' }
]

const MAX_PREVIEW_POLLS = 60

/**
 * Live design canvas. Preview reuses the write-prototype webview path
 * (authorizeWritePrototype → file:// allow-list → <webview partition="kun-proto">).
 * Because a turn writes the artifact incrementally, the preview polls the
 * reserved path until a complete document exists, and reloads when the turn
 * finishes (chat busy → false). The view is the seam for P2/P3 surfaces.
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
  const setCanvasView = useDesignWorkspaceStore((s) => s.setCanvasView)
  const setViewport = useDesignWorkspaceStore((s) => s.setViewport)

  const activeArtifact = artifacts.find((item) => item.id === activeArtifactId) ?? null
  const relativePath = activeArtifact?.relativePath ?? ''

  const [fileUrl, setFileUrl] = useState('')
  const [source, setSource] = useState('')
  const [error, setError] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [reloadNonce, setReloadNonce] = useState(0)
  const prevBusyRef = useRef(busy)

  // Reload the canvas when a turn finishes — picks up the agent's final write.
  useEffect(() => {
    if (prevBusyRef.current && !busy) setReloadNonce((n) => n + 1)
    prevBusyRef.current = busy
  }, [busy])

  // Preview: poll the reserved path until a complete document exists, authorize, render.
  useEffect(() => {
    if (canvasView !== 'preview' || !relativePath || !workspaceRoot) {
      setFileUrl('')
      setPreparing(false)
      return
    }
    if (
      typeof window.kunGui?.authorizeWritePrototype !== 'function' ||
      typeof window.kunGui?.readWorkspaceFile !== 'function'
    ) {
      setError(t('designCanvasUnavailable'))
      return
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let attempts = 0
    setError('')
    setPreparing(true)
    const tick = async (): Promise<void> => {
      if (cancelled) return
      try {
        const read = await window.kunGui.readWorkspaceFile({ path: relativePath, workspaceRoot })
        if (cancelled) return
        if (read.ok && read.content.trim().toLowerCase().endsWith('</html>')) {
          const auth = await window.kunGui.authorizeWritePrototype({ path: relativePath, workspaceRoot })
          if (cancelled) return
          if (auth.ok) {
            setFileUrl(auth.fileUrl)
          } else {
            setError(auth.message)
          }
          setPreparing(false)
          return
        }
      } catch {
        // not written yet — keep polling
      }
      attempts += 1
      if (attempts >= MAX_PREVIEW_POLLS) {
        setPreparing(false)
        return
      }
      timer = setTimeout(() => void tick(), 1500)
    }
    void tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [relativePath, workspaceRoot, canvasView, reloadNonce, t])

  // Code view: read the current source.
  useEffect(() => {
    if (canvasView !== 'code' || !relativePath || !workspaceRoot) return
    if (typeof window.kunGui?.readWorkspaceFile !== 'function') return
    let cancelled = false
    setError('')
    void window.kunGui
      .readWorkspaceFile({ path: relativePath, workspaceRoot })
      .then((result) => {
        if (cancelled) return
        if (!result.ok) {
          setError(result.message)
          setSource('')
          return
        }
        setSource(result.content)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [relativePath, workspaceRoot, canvasView, reloadNonce])

  const viewportWidth = DESIGN_VIEWPORT_WIDTHS[viewport]
  const toolbarButton = (active: boolean): string =>
    `inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
      active
        ? 'bg-white text-[#1f2733] shadow-[0_1px_2px_rgba(20,47,95,0.12)] dark:bg-white/[0.14] dark:text-white'
        : 'text-[#8b95a3] hover:text-[#1f2733] dark:text-white/45 dark:hover:text-white/85'
    }`

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-ds-main">
      <div className="ds-no-drag flex shrink-0 items-center gap-2 px-3 py-2 shadow-[inset_0_-1px_0_var(--ds-sidebar-row-ring)]">
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
        <button
          type="button"
          aria-label={t('designCanvasReload')}
          title={t('designCanvasReload')}
          onClick={() => setReloadNonce((n) => n + 1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#8b95a3] transition-colors hover:text-[#1f2733] dark:text-white/45 dark:hover:text-white/85"
        >
          <RotateCw className="h-4 w-4" strokeWidth={1.9} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {canvasView === 'live' ? (
          devPreviewUrl ? (
            <webview
              key={`design-live:${devPreviewUrl}`}
              src={devPreviewUrl}
              partition="kun-proto"
              webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes"
              className="h-full w-full border-0"
            />
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
          <pre className="h-full overflow-auto bg-ds-main px-4 py-3 text-[12px] leading-relaxed text-[#1f2733] dark:text-white/85">
            <code>{source}</code>
          </pre>
        ) : fileUrl ? (
          <div className="flex h-full justify-center overflow-auto bg-[#f3f5f8] p-3 dark:bg-black/30">
            <div
              className="h-full overflow-hidden rounded-lg bg-white shadow-sm"
              style={{ width: viewportWidth ? `${viewportWidth}px` : '100%', maxWidth: '100%' }}
            >
              <webview
                key={`design-canvas:${fileUrl}:${reloadNonce}`}
                src={fileUrl}
                partition="kun-proto"
                webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes"
                className="h-full w-full border-0"
              />
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-[#646e7c] dark:text-white/55">
            {preparing ? t('designCanvasGenerating') : t('designCanvasPlaceholder')}
          </div>
        )}
      </div>
    </div>
  )
}
