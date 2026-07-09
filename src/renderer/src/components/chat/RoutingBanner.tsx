import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { Sparkles, X } from 'lucide-react'

export type RoutingBannerProps = {
  /** Recommended role id. */
  recommendedRole: string
  /** Display name for the recommended role. */
  recommendedRoleName: string
  /** Confidence score (0.0–1.0). Only shown when below threshold. */
  confidence: number
  /** Called when user accepts the recommendation. */
  onAccept: () => void
  /** Called when user wants to pick a different role. */
  onOverride: () => void
  /** Called when user dismisses the banner. */
  onDismiss: () => void
  /** Auto-dismiss timeout in ms (default 8000). */
  autoDismissMs?: number
}

const ROLE_EMOJI_RECORD: Record<string, string> = {
  coder: '💻',
  planner: '🧠',
  reviewer: '🔍',
  researcher: '📚',
  title: '🏷️',
  summarizer: '📝',
  explore: '🔎'
}

/**
 * Non-blocking inline banner for AI routing recommendations.
 *
 * Design (per Aesthetic Constraints):
 * - bg-ds-surface-subtle background with rounded-lg
 * - Sparkles icon + recommendation text
 * - Accept / Override action buttons
 * - Auto-dismiss after 8s or on user action
 * - MUST NOT block user input or hide behind overlay
 */
export function RoutingBanner({
  recommendedRole,
  recommendedRoleName,
  confidence,
  onAccept,
  onOverride,
  onDismiss,
  autoDismissMs = 8000
}: RoutingBannerProps): ReactElement | null {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onDismiss()
    }, autoDismissMs)
    return () => clearTimeout(timer)
  }, [autoDismissMs, onDismiss])

  if (!visible) return null

  const emoji = ROLE_EMOJI_RECORD[recommendedRole] ?? '🤖'
  const confidencePct = Math.round(confidence * 100)

  return (
    <div className="mx-2 mb-2 flex items-center gap-3 rounded-lg bg-ds-surface-subtle px-4 py-2.5 text-xs text-ds-muted shadow-sm">
      <Sparkles className="h-4 w-4 shrink-0 text-ds-accent" strokeWidth={1.5} />
      <span className="flex-1">
        AI 建议切换到 <strong className="text-ds-ink">{emoji} {recommendedRoleName}</strong>
        {confidence < 0.7 ? <span className="ml-1 text-ds-faint">(确信度 {confidencePct}%)</span> : null}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => { setVisible(false); onAccept() }}
          className="rounded-full bg-ds-accent/10 px-3 py-1 text-[11px] font-medium text-ds-accent transition hover:bg-ds-accent/20"
        >
          接受
        </button>
        <button
          type="button"
          onClick={() => { setVisible(false); onOverride() }}
          className="rounded-full px-3 py-1 text-[11px] text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink"
        >
          选其他
        </button>
        <button
          type="button"
          onClick={() => { setVisible(false); onDismiss() }}
          className="ml-1 rounded-full p-1 text-ds-faint transition hover:bg-ds-hover hover:text-ds-muted"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
