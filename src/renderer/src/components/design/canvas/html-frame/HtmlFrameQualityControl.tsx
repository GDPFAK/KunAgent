import type { Dispatch, SetStateAction } from 'react'
import { AlertTriangle, Brush, CheckCircle2, ShieldCheck } from 'lucide-react'
import {
  summarizeDesignHtmlQualityDetails,
  summarizeDesignHtmlQualityStatus,
  type DesignHtmlQualityFinding,
  type DesignRuntimeQualityPayload
} from '../../../../design/design-html-quality'
import { qualityBadgeClasses, qualityFindingClasses, qualityFindingLabel } from './html-frame-helpers'

type Props = {
  available: boolean
  open: boolean
  onOpenChange: Dispatch<SetStateAction<boolean>>
  screenWidth: number
  artifactId?: string
  artifactRelativePath?: string
  shapeId: string
  qualityChecked: boolean
  qualityFindings: DesignHtmlQualityFinding[]
  onRequestQualityRepair?: (payload: DesignRuntimeQualityPayload) => void
}

export function HtmlFrameQualityControl({
  available,
  open,
  onOpenChange,
  screenWidth,
  artifactId,
  artifactRelativePath,
  shapeId,
  qualityChecked,
  qualityFindings,
  onRequestQualityRepair
}: Props): React.JSX.Element | null {
  if (!available) return null

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
    <div className="relative">
      <button
        type="button"
        className={`flex max-w-[180px] items-center gap-1.5 rounded-full border px-2 py-1 text-[10.5px] font-semibold shadow-sm backdrop-blur-md transition hover:shadow-md ${qualityBadgeClasses(qualityStatus.kind)}`}
        title={qualityStatus.title}
        aria-expanded={open}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onOpenChange((current) => !current)
        }}
      >
        <QualityIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
        <span className="min-w-0 truncate">{qualityStatus.label}</span>
      </button>
      {open ? (
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
              {artifactId && artifactRelativePath && onRequestQualityRepair ? (
                <button
                  type="button"
                  className="mt-0.5 inline-flex w-fit items-center gap-1.5 rounded-md border border-accent/30 bg-accent px-2 py-1 text-[10.5px] font-semibold text-white shadow-sm transition hover:opacity-90"
                  onPointerDown={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRequestQualityRepair({
                      artifactId,
                      artifactRelativePath,
                      shapeId,
                      findings: qualityFindings
                    })
                    onOpenChange(false)
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
  )
}
