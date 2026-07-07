import type { ReactElement } from 'react'
import { useState } from 'react'
import { Bot, ChevronDown, ChevronUp, Cpu, Loader2 } from 'lucide-react'
import type { GuiAgentRoleInfo } from '@shared/agent-role'

export type AgentStatusPanelProps = {
  /** Currently active role info. */
  activeRole?: GuiAgentRoleInfo
  /** All available roles. */
  roles: GuiAgentRoleInfo[]
  /** Whether any sub-agent is currently running. */
  hasRunningSubAgents?: boolean
  /** Running sub-agent count. */
  runningSubAgentCount?: number
  /** Total sub-agents executed this session. */
  totalSubAgentCount?: number
}

/**
 * Collapsible bottom bar showing agent role status and sub-agent progress.
 *
 * Design (per Aesthetic Constraints):
 * - Collapsible bottom bar (reuse terminal toggle pattern)
 * - NOT a side panel
 * - Uses existing ds-bg-main + border-t border-ds-border
 * - Thin collapsed bar with click-to-expand affordance
 */
export function AgentStatusPanel({
  activeRole,
  roles,
  hasRunningSubAgents = false,
  runningSubAgentCount = 0,
  totalSubAgentCount = 0
}: AgentStatusPanelProps): ReactElement | null {
  const [expanded, setExpanded] = useState(false)

  if (roles.length === 0 && !activeRole) return null

  const roleColor = activeRole?.color ?? '#3b82f6'
  const roleName = activeRole?.name ?? activeRole?.id ?? 'default'

  // Collapsed bar
  if (!expanded) {
    return (
      <div className="border-t border-ds-border">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center gap-2 bg-ds-main px-4 py-1.5 text-[11px] text-ds-muted transition hover:bg-ds-hover"
        >
          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: roleColor }} />
          <span className="font-medium text-ds-ink">{roleName}</span>
          {hasRunningSubAgents ? (
            <span className="inline-flex items-center gap-1 text-ds-accent">
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
              {runningSubAgentCount} running
            </span>
          ) : totalSubAgentCount > 0 ? (
            <span className="text-ds-faint">{totalSubAgentCount} sub-agents</span>
          ) : null}
          <span className="ml-auto flex items-center gap-1 text-ds-faint">
            <Cpu className="h-3 w-3" strokeWidth={1.5} />
            Agent
            <ChevronUp className="h-3 w-3" strokeWidth={1.5} />
          </span>
        </button>
      </div>
    )
  }

  // Expanded panel
  return (
    <div className="border-t border-ds-border bg-ds-main">
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="flex w-full items-center gap-2 px-4 py-2 text-[11px] text-ds-muted transition hover:bg-ds-hover"
      >
        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: roleColor }} />
        <span className="font-medium text-ds-ink">{roleName}</span>
        {hasRunningSubAgents && (
          <span className="inline-flex items-center gap-1 text-ds-accent">
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
            {runningSubAgentCount} running
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 text-ds-faint">
          <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
        </span>
      </button>

      <div className="max-h-48 overflow-y-auto border-t border-ds-border px-4 py-2 text-[12px]">
        {roles.length > 0 && (
          <div className="mb-2">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-ds-faint">Available Roles</div>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <span
                  key={role.id}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                    role.id === activeRole?.id
                      ? 'bg-ds-accent/10 text-ds-accent font-medium'
                      : 'bg-ds-subtle text-ds-muted'
                  }`}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: role.color ?? '#3b82f6' }}
                  />
                  {role.name ?? role.id}
                  {role.isDefault && <span className="text-ds-faint">(default)</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 text-ds-muted">
          <span className="inline-flex items-center gap-1">
            <Bot className="h-3 w-3" strokeWidth={1.5} />
            Sub-agents: {totalSubAgentCount}
          </span>
          {hasRunningSubAgents && (
            <span className="inline-flex items-center gap-1 text-ds-accent">
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
              {runningSubAgentCount} running
            </span>
          )}
          {activeRole?.model && (
            <span className="text-ds-faint">
              Model: {activeRole.model}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
