import { useCallback, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import {
  formatBoxSides,
  formatPx,
  hasVisibleFill,
  rgbToHex,
  type DesignElementMetrics
} from '../../design/design-element-metrics'

type Props = {
  selector: string
  tagName: string
  metrics: DesignElementMetrics
  style: {
    fontFamily: string
    fontSize: string
    fontWeight: string
    lineHeight: string
  }
  onClose: () => void
  /** Optional sink for the color chips, used by the eyedropper / tokens panel. */
  onPickColor?: (hex: string, channel: 'color' | 'backgroundColor' | 'borderColor') => void
}

/** Read-only Stitch-style inspector for the selected HTML element. */
export function ElementInspectorPanel({
  selector,
  tagName,
  metrics,
  style,
  onClose,
  onPickColor
}: Props): ReactElement {
  const { t } = useTranslation('common')

  const copyHex = useCallback(
    (hex: string, channel: 'color' | 'backgroundColor' | 'borderColor'): void => {
      if (!hex) return
      void navigator.clipboard?.writeText?.(hex)
      onPickColor?.(hex, channel)
    },
    [onPickColor]
  )

  const tag = tagName.toLowerCase()
  const idLabel = metrics.id ? `#${metrics.id}` : ''
  const classLabel = metrics.className
    ? '.' + metrics.className.split(/\s+/).filter(Boolean).slice(0, 3).join('.')
    : ''
  const heading = [tag, idLabel, classLabel].filter(Boolean).join(' ')

  return (
    <div
      className="pointer-events-auto flex w-72 max-w-[18rem] flex-col gap-3 overflow-hidden rounded-[14px] border border-ds-border bg-white/96 p-3 text-[12px] text-ds-muted shadow-[0_18px_46px_rgba(20,47,95,0.18)] backdrop-blur-xl"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-[12.5px] font-medium text-ds-ink" title={heading}>
            {heading || tag}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-ds-faint" title={selector}>
            {selector}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('designElementInspectClose', '关闭')}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ds-faint transition hover:bg-ds-hover hover:text-ds-ink"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.8} />
        </button>
      </header>

      <section>
        <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ds-faint">
          {t('designElementInspectSize', '尺寸 / 间距')}
        </div>
        <div className="rounded-lg border border-ds-border bg-ds-hover/40 p-2 font-mono text-[11px] leading-5 text-ds-ink">
          <BoxModelDiagram metrics={metrics} />
        </div>
      </section>

      <section>
        <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ds-faint">
          {t('designElementInspectTypography', '字体')}
        </div>
        <div className="font-mono text-[11px] leading-5 text-ds-ink">
          <div className="truncate" title={style.fontFamily}>{style.fontFamily}</div>
          <div className="text-ds-muted">
            {style.fontSize} · {style.fontWeight} · {style.lineHeight}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ds-faint">
          {t('designElementInspectColors', '颜色')}
        </div>
        <div className="flex flex-col gap-1.5">
          <ColorRow
            label={t('designElementInspectText', '文本')}
            value={metrics.color}
            onClick={(hex) => copyHex(hex, 'color')}
          />
          <ColorRow
            label={t('designElementInspectBackground', '背景')}
            value={metrics.backgroundColor}
            onClick={(hex) => copyHex(hex, 'backgroundColor')}
          />
          <ColorRow
            label={t('designElementInspectBorder', '描边')}
            value={metrics.borderColor}
            onClick={(hex) => copyHex(hex, 'borderColor')}
          />
        </div>
        <div className="mt-1.5 text-[10.5px] text-ds-faint">
          {t('designElementInspectCopyHint', '点击色块复制 HEX')}
        </div>
      </section>
    </div>
  )
}

function BoxModelDiagram({ metrics }: { metrics: DesignElementMetrics }): ReactElement {
  const w = formatPx(metrics.width)
  const h = formatPx(metrics.height)
  return (
    <div className="flex flex-col gap-1">
      <Row label="W × H" value={`${w} × ${h}`} />
      <Row label="margin" value={formatBoxSides(metrics.margin)} />
      <Row label="border" value={formatBoxSides(metrics.border)} />
      <Row label="padding" value={formatBoxSides(metrics.padding)} />
      <Row label="box-sizing" value={metrics.boxSizing} muted />
    </div>
  )
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }): ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-ds-faint">{label}</span>
      <span className={muted ? 'text-ds-muted' : 'text-ds-ink'}>{value}</span>
    </div>
  )
}

function ColorRow({
  label,
  value,
  onClick
}: {
  label: string
  value: string
  onClick: (hex: string) => void
}): ReactElement {
  const hex = rgbToHex(value)
  const visible = hasVisibleFill(value)
  return (
    <button
      type="button"
      disabled={!hex}
      onClick={() => onClick(hex)}
      className="flex w-full items-center gap-2 rounded-md border border-transparent px-1 py-0.5 text-left transition hover:border-ds-border hover:bg-ds-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
    >
      <span
        className="inline-block h-4 w-4 shrink-0 rounded-[4px] border border-ds-border"
        style={{ background: visible ? value : 'repeating-linear-gradient(45deg,#eee 0 4px,#fff 4px 8px)' }}
        aria-hidden="true"
      />
      <span className="w-12 shrink-0 text-[11px] text-ds-faint">{label}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ds-ink">
        {hex || (value || '—')}
      </span>
    </button>
  )
}
