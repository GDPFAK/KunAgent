import { MousePointer2 } from 'lucide-react'

export type HtmlFrameAiCursor = {
  label: string
  left: number
  top: number
  width: number
  height: number
}

type Props = {
  cursor: HtmlFrameAiCursor | null
  zoom: number
  screenWidth: number
  visualScreenHeight: number
}

export function HtmlFrameAiCursorOverlay({
  cursor,
  zoom,
  screenWidth,
  visualScreenHeight
}: Props): React.JSX.Element | null {
  if (!cursor) return null

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute rounded-[3px] border"
        style={{
          left: cursor.left * zoom,
          top: cursor.top * zoom,
          width: cursor.width * zoom,
          height: cursor.height * zoom,
          borderColor: 'color-mix(in srgb, var(--ds-accent) 75%, transparent)',
          background: 'color-mix(in srgb, var(--ds-accent) 9%, transparent)',
          boxShadow:
            '0 0 0 1px color-mix(in srgb, var(--ds-accent) 30%, transparent), 0 8px 26px color-mix(in srgb, var(--ds-accent) 22%, transparent)',
          transition:
            'left 360ms cubic-bezier(0.22,1,0.36,1), top 360ms cubic-bezier(0.22,1,0.36,1), width 360ms ease, height 360ms ease'
        }}
      />
      <div
        className="absolute flex items-center gap-1"
        style={{
          left: Math.min(cursor.left * zoom + cursor.width * zoom - 8, screenWidth - 8),
          top: Math.max(2, Math.min(cursor.top * zoom - 2, visualScreenHeight - 22)),
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
          {cursor.label || 'AI 正在生成…'}
        </span>
      </div>
    </div>
  )
}
