import { Brush } from 'lucide-react'

type Props = {
  transparentGeneratingSurface: boolean
  drawingActive: boolean
  placeholderPreview: boolean
  previewError: string
  failedMessage: string
  hasArtifact: boolean
  drawingLabel: string
  screenWidth: number
}

export function HtmlFramePlaceholder({
  transparentGeneratingSurface,
  drawingActive,
  placeholderPreview,
  previewError,
  failedMessage,
  hasArtifact,
  drawingLabel,
  screenWidth
}: Props): React.JSX.Element {
  return (
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
          <Brush className="h-5 w-5 animate-pulse text-accent" strokeWidth={1.8} aria-hidden="true" />
        ) : null}
        <span>
          {previewError || failedMessage || (hasArtifact ? (drawingActive ? drawingLabel : 'Generating...') : 'No content')}
        </span>
      </div>
    </div>
  )
}
