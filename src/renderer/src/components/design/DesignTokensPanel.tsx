import { useMemo, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Layers, RefreshCw, X } from 'lucide-react'
import type { NamedPalette, Ramp, TypeRow } from '../../design/design-tokens'

type Props = {
  palette: NamedPalette
  typeRows: TypeRow[]
  title?: string
  status: 'idle' | 'extracting' | 'error'
  lastExtractedAt?: number
  onRefresh: () => void
  onClose?: () => void
  /** Click a swatch hex → copy to clipboard / hand to the eyedropper sink. */
  onSelectColor?: (hex: string) => void
}

const ROLE_LABEL_KEYS: { role: keyof NamedPalette; key: string; fallback: string }[] = [
  { role: 'primary', key: 'designTokensPrimary', fallback: 'Primary' },
  { role: 'secondary', key: 'designTokensSecondary', fallback: 'Secondary' },
  { role: 'tertiary', key: 'designTokensTertiary', fallback: 'Tertiary' },
  { role: 'neutral', key: 'designTokensNeutral', fallback: 'Neutral' }
]

/** Stitch-style right rail: named palette + type scale, refresh-on-demand. */
export function DesignTokensPanel({
  palette,
  typeRows,
  title,
  status,
  lastExtractedAt,
  onRefresh,
  onClose,
  onSelectColor
}: Props): ReactElement {
  const { t } = useTranslation('common')
  const hasPalette = ROLE_LABEL_KEYS.some((r) => palette[r.role])
  const updatedLabel = useMemo((): string => {
    if (!lastExtractedAt) return ''
    const seconds = Math.max(0, Math.round((Date.now() - lastExtractedAt) / 1000))
    if (seconds < 5) return t('designTokensJustNow', '刚刚')
    const ago = t('designTokensAgo', '前')
    if (seconds < 60) return `${seconds}s ${ago}`
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes}m ${ago}`
    const hours = Math.round(minutes / 60)
    return `${hours}h ${ago}`
  }, [lastExtractedAt, t])

  return (
    <aside
      className="pointer-events-auto flex w-72 max-w-[18rem] flex-col gap-3 overflow-hidden rounded-[14px] border border-ds-border bg-white/96 p-3 text-[12px] text-ds-muted shadow-[0_18px_46px_rgba(20,47,95,0.18)] backdrop-blur-xl"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ds-ink">
            <Layers className="h-3.5 w-3.5 text-accent" strokeWidth={2} aria-hidden="true" />
            <span className="truncate" title={title}>
              {title || t('designTokensTitle', '设计系统')}
            </span>
          </div>
          {updatedLabel ? (
            <div className="mt-0.5 truncate text-[11px] text-ds-faint">{updatedLabel}</div>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRefresh}
            disabled={status === 'extracting'}
            aria-label={t('designTokensRefresh', '重新提取')}
            title={t('designTokensRefresh', '重新提取')}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ds-faint transition hover:bg-ds-hover hover:text-ds-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${status === 'extracting' ? 'animate-spin' : ''}`}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('designElementInspectClose', '关闭')}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ds-faint transition hover:bg-ds-hover hover:text-ds-ink"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.8} />
            </button>
          ) : null}
        </div>
      </header>

      {!hasPalette && status !== 'extracting' ? (
        <div className="rounded-lg border border-dashed border-ds-border-muted px-3 py-4 text-center text-[11px] text-ds-faint">
          {status === 'error'
            ? t('designTokensExtractFailed', '提取失败,请刷新重试')
            : t('designTokensEmpty', '运行原型后会自动提取设计令牌')}
        </div>
      ) : null}

      {hasPalette ? (
        <section className="flex flex-col gap-2.5">
          {ROLE_LABEL_KEYS.map(({ role, key, fallback }) => {
            const slot = palette[role]
            if (!slot) return null
            return (
              <PaletteRow
                key={role}
                label={t(key, fallback)}
                base={slot.base}
                ramp={slot.ramp}
                onSelect={onSelectColor}
              />
            )
          })}
        </section>
      ) : null}

      {typeRows.length > 0 ? (
        <section>
          <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ds-faint">
            {t('designTokensTypography', '字体刻度')}
          </div>
          <div className="flex flex-col gap-2">
            {typeRows.map((row) => (
              <TypeRowView key={`${row.sample}:${row.fontSize}:${row.fontWeight}`} row={row} />
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  )
}

function PaletteRow({
  label,
  base,
  ramp,
  onSelect
}: {
  label: string
  base: string
  ramp: Ramp
  onSelect?: (hex: string) => void
}): ReactElement {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-ds-ink">{label}</span>
        <span className="font-mono text-[10.5px] uppercase text-ds-faint">{base}</span>
      </div>
      <div className="flex h-8 overflow-hidden rounded-md border border-ds-border">
        {ramp.map((swatch) => (
          <button
            key={swatch.stop}
            type="button"
            title={`${swatch.stop} · ${swatch.hex}`}
            onClick={() => onSelect?.(swatch.hex)}
            className={`flex-1 transition focus:outline-none ${swatch.isBase ? 'ring-2 ring-inset ring-white' : ''}`}
            style={{ background: swatch.hex }}
            aria-label={`${label} ${swatch.stop} ${swatch.hex}`}
          />
        ))}
      </div>
    </div>
  )
}

function TypeRowView({ row }: { row: TypeRow }): ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-ds-border-muted/60 pb-1.5 last:border-b-0 last:pb-0">
      <span
        className="min-w-0 flex-1 truncate text-ds-ink"
        style={{
          fontFamily: row.fontFamily,
          fontWeight: row.fontWeight,
          fontSize: clampPreviewPx(row.px)
        }}
      >
        {row.label}
      </span>
      <span className="shrink-0 font-mono text-[10.5px] text-ds-faint">
        {row.fontSize} · {row.fontWeight}
      </span>
    </div>
  )
}

function clampPreviewPx(px: number): string {
  if (!Number.isFinite(px) || px <= 0) return '14px'
  return `${Math.min(28, Math.max(11, px))}px`
}
