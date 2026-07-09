import type { ReactElement } from 'react'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import type { GuiAgentRoleInfo } from '@shared/agent-role'

export type AgentRoleSelectorProps = {
  roles: GuiAgentRoleInfo[]
  activeRoleId: string | null
  defaultRoleId: string | null
  onSelect: (roleId: string) => void
  disabled?: boolean
  compact?: boolean
}

/**
 * A minimal dropdown role selector that follows the Kun design system:
 * - Uses only ds-* tokens (ds-muted, ds-faint, ds-hover, ds-border, ds-accent)
 * - Rounded-full trigger button + rounded-xl dropdown menu
 * - Matches FloatingComposerModelPicker visual pattern
 * - No new colors, no bounce animations, no layout shift
 */
export function AgentRoleSelector({
  roles,
  activeRoleId,
  defaultRoleId,
  onSelect,
  disabled = false,
  compact = false
}: AgentRoleSelectorProps): ReactElement | null {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (roles.length === 0) return null

  const current = roles.find((r) => r.id === activeRoleId)
  const displayName = current?.name ?? current?.id ?? defaultRoleId ?? 'coder'
  const dotColor = current?.color ?? '#3b82d8'

  return (
    <div ref={ref} className={`relative shrink-0 ${compact ? '' : ''}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex h-7 items-center gap-1 rounded-full px-2 text-[12px] font-medium transition
          ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-ds-hover cursor-pointer'}
          ${open ? 'bg-ds-hover' : ''}`}
      >
        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
        <span className="max-w-[80px] truncate text-ds-muted">{displayName}</span>
        <ChevronDown className="h-3 w-3 text-ds-faint" strokeWidth={1.8} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[1000] mt-1 min-w-[160px] overflow-hidden rounded-xl border border-ds-border bg-white py-1 text-[12.5px] text-ds-muted shadow-[0_18px_50px_rgba(20,47,95,0.16)] dark:bg-ds-card">
          {roles.map((role) => {
            const isActive = role.id === activeRoleId
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => { onSelect(role.id); setOpen(false) }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition
                  ${isActive ? 'bg-ds-accent/10 text-ds-ink font-medium' : 'text-ds-muted hover:bg-ds-hover'}`}
              >
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: role.color ?? '#3b82d8' }} />
                <span className="min-w-0 flex-1 truncate">{role.name ?? role.id}</span>
                {role.isDefault && (
                  <span className="shrink-0 text-[10px] text-ds-faint/70">默认</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
