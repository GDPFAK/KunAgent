import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * A minimal role badge rendered inline with the model tag on assistant messages.
 * Uses a small color dot + role name, rendered in the same row as ModelMetaTag.
 *
 * Design tokens (per Aesthetic Constraints):
 * - No new colors — role color passed as prop
 * - No new border-radius — uses existing rounded-full
 * - No increase to message height — inline with text
 * - Error boundary safe — renders nothing on error
 */

export type AgentRoleBadgeProps = {
  /** Role identifier (e.g. "coder", "reviewer"). Used for i18n label lookup. */
  roleId: string
  /** Display name for the role. Falls back to roleId. */
  name?: string
  /** Hex color for the dot indicator. */
  color?: string
}

const ROLE_EMOJI: Record<string, string> = {
  coder: '💻',
  planner: '🧠',
  reviewer: '🔍',
  researcher: '📚',
  title: '🏷️',
  summarizer: '📝',
  explore: '🔎'
}

export function AgentRoleBadge({ roleId, name, color }: AgentRoleBadgeProps): ReactElement | null {
  try {
    const { t } = useTranslation('common')
    const dotColor = color ?? '#3b82f6'
    const displayName = t(roleId) !== roleId ? t(roleId) : (name ?? roleId)
    const emoji = ROLE_EMOJI[roleId]

    return (
      <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-ds-faint">
        {emoji ? <span className="text-[11px]">{emoji}</span> : (
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: dotColor }}
          />
        )}
        <span className="max-w-[80px] truncate">{displayName}</span>
      </span>
    )
  } catch {
    return null
  }
}
