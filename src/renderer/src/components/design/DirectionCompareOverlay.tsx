import { memo, useEffect, useMemo, useState } from 'react'
import { GitCompareArrows, ListFilter, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  buildDesignDirectionScreenMatrix,
  type DesignDirectionGroup
} from '../../design/design-artifact-actions'
import type { DesignArtifact } from '../../design/design-types'
import { useDesignHtmlPreview } from './DesignHtmlPreviewHost'

type Props = {
  open: boolean
  workspaceRoot: string
  directions: readonly DesignDirectionGroup[]
  onClose: () => void
}

type DirectionPreviewProps = {
  workspaceRoot: string
  artifact: DesignArtifact | null
}

function DirectionPreview({ workspaceRoot, artifact }: DirectionPreviewProps) {
  const { t } = useTranslation('common')
  const partitionId = artifact?.id
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  const preview = useDesignHtmlPreview({
    workspaceRoot,
    relativePath: artifact?.kind === 'html' ? artifact.relativePath : undefined,
    enabled: Boolean(workspaceRoot && artifact?.kind === 'html'),
    partition: `kun-direction-compare-${partitionId || 'empty'}`
  })

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-[8px] border border-ds-border bg-white">
      {preview.state.webviewUrl ? (
        preview.renderWebview({ className: 'h-full w-full border-0' })
      ) : (
        <div className="flex h-full min-h-[260px] items-center justify-center px-4 text-center text-[13px] text-ds-faint">
          {preview.state.error || t('designCanvasLoading')}
        </div>
      )}
      {preview.state.error && preview.state.webviewUrl ? (
        <div className="absolute inset-x-3 top-3 rounded-[8px] border border-red-200 bg-white/92 px-3 py-2 text-[12px] text-red-600 shadow-sm backdrop-blur">
          {preview.state.error}
        </div>
      ) : null}
    </div>
  )
}

function DirectionCompareOverlayInner({ open, workspaceRoot, directions, onClose }: Props) {
  const { t } = useTranslation('common')
  const visibleDirections = useMemo(
    () => directions.filter((direction) => direction.artifacts.length > 0),
    [directions]
  )
  const screenMatrix = useMemo(
    () => buildDesignDirectionScreenMatrix(visibleDirections),
    [visibleDirections]
  )
  const [selectedByDirection, setSelectedByDirection] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setSelectedByDirection((current) => {
      const next: Record<string, string> = {}
      for (const direction of visibleDirections) {
        const selected = current[direction.id]
        next[direction.id] = direction.artifacts.some((artifact) => artifact.id === selected)
          ? selected
          : direction.artifacts[0]?.id ?? ''
      }
      return next
    })
  }, [open, visibleDirections])

  if (!open) return null

  const columnCount = Math.max(1, Math.min(visibleDirections.length, 4))

  return (
    <div className="ds-no-drag fixed inset-0 z-[80] flex items-center justify-center bg-[#111827]/34 p-5 backdrop-blur-sm">
      <div className="flex h-[min(860px,calc(100%-2rem))] w-[min(1440px,calc(100%-2rem))] flex-col overflow-hidden rounded-[8px] border border-ds-border bg-[#f6f8fb] text-ds-ink shadow-[0_30px_90px_rgba(15,23,42,0.32)] dark:bg-[#111318]">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-ds-border bg-white/86 px-4 dark:bg-ds-card/88">
          <GitCompareArrows className="h-4 w-4 text-accent" strokeWidth={1.9} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">{t('designDirectionCompareTitle')}</div>
            <div className="truncate text-[10.5px] text-ds-faint">
              {t('designDirectionCompareVisualSubtitle', { count: visibleDirections.length })}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink"
            title={t('designDirectionCompareClose')}
            aria-label={t('designDirectionCompareClose')}
          >
            <X className="h-4 w-4" strokeWidth={1.9} />
          </button>
        </header>

        {screenMatrix.length > 0 ? (
          <div className="flex shrink-0 items-center gap-2 border-b border-ds-border bg-white/72 px-3 py-2 dark:bg-ds-card/72">
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-ds-muted">
              <ListFilter className="h-3.5 w-3.5" strokeWidth={1.9} />
              {t('designDirectionCompareMatchScreens')}
            </span>
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5">
              {screenMatrix.map((row) => {
                const active = Object.entries(row.artifactIdsByDirectionId).every(
                  ([directionId, artifactId]) => selectedByDirection[directionId] === artifactId
                )
                const coverageLabel = t('designDirectionCompareScreenCoverage', {
                  covered: row.coverageCount,
                  total: visibleDirections.length
                })
                return (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() =>
                      setSelectedByDirection((current) => ({
                        ...current,
                        ...row.artifactIdsByDirectionId
                      }))
                    }
                    className={`flex h-8 max-w-[190px] shrink-0 items-center gap-1.5 rounded-[8px] px-2 text-[11px] transition ${
                      active
                        ? 'bg-[#1f2733] text-white shadow-[0_4px_12px_rgba(15,23,42,0.18)]'
                        : row.shared
                          ? 'bg-[#3b82d8]/10 text-[#266eb8] hover:bg-[#3b82d8]/16 dark:text-[#8abcf0]'
                          : 'bg-ds-hover/50 text-ds-muted hover:bg-ds-hover hover:text-ds-ink'
                    }`}
                    title={`${row.title} - ${coverageLabel}`}
                    aria-label={`${row.title} - ${coverageLabel}`}
                  >
                    <span className="min-w-0 truncate">{row.title}</span>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                        active
                          ? 'bg-white/18 text-white'
                          : row.shared
                            ? 'bg-[#3b82d8]/12 text-[#266eb8] dark:text-[#8abcf0]'
                            : 'bg-white/70 text-ds-faint dark:bg-white/8'
                      }`}
                    >
                      {row.coverageCount}/{visibleDirections.length}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        <div
          className="grid min-h-0 flex-1 gap-3 overflow-auto p-3"
          style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(300px, 1fr))` }}
        >
          {visibleDirections.map((direction) => {
            const selectedId = selectedByDirection[direction.id] || direction.artifacts[0]?.id
            const selectedArtifact = direction.artifacts.find((artifact) => artifact.id === selectedId) ?? null
            return (
              <section
                key={direction.id}
                className="flex min-h-[520px] min-w-0 flex-col overflow-hidden rounded-[8px] border border-ds-border bg-white/88 shadow-[0_10px_30px_rgba(15,23,42,0.08)] dark:bg-ds-card/88"
              >
                <div className="shrink-0 border-b border-ds-border px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{direction.name}</span>
                    {direction.status !== 'active' ? (
                      <span className="rounded-full bg-[#2e9e6b]/10 px-1.5 py-0.5 text-[10.5px] leading-none text-[#2e9e6b]">
                        {t('designDirectionAccepted')}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex gap-1 overflow-x-auto pb-0.5">
                    {direction.artifacts.map((artifact) => {
                      const active = artifact.id === selectedId
                      return (
                        <button
                          key={artifact.id}
                          type="button"
                          onClick={() =>
                            setSelectedByDirection((current) => ({
                              ...current,
                              [direction.id]: artifact.id
                            }))
                          }
                          className={`h-7 max-w-[150px] shrink-0 truncate rounded-[8px] px-2 text-[11px] transition ${
                            active
                              ? 'bg-[#1f2733] text-white shadow-[0_4px_12px_rgba(15,23,42,0.18)]'
                              : 'bg-ds-hover/45 text-ds-muted hover:bg-ds-hover hover:text-ds-ink'
                          }`}
                          title={artifact.title}
                        >
                          {artifact.title}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <DirectionPreview workspaceRoot={workspaceRoot} artifact={selectedArtifact} />
                {selectedArtifact ? (
                  <div className="shrink-0 border-t border-ds-border px-3 py-2 text-[10.5px] text-ds-faint">
                    <div className="truncate">{selectedArtifact.relativePath}</div>
                    <div className="mt-0.5">
                      {t('designDirectionCompareFlows', {
                        count: selectedArtifact.prototypeLinks?.length ?? 0
                      })}
                    </div>
                  </div>
                ) : null}
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export const DirectionCompareOverlay = memo(DirectionCompareOverlayInner)
