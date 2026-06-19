import type { ReactElement } from 'react'
import { useEffect } from 'react'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'
import { DesignAgentPanel } from './DesignAgentPanel'
import { DesignCanvas } from './DesignCanvas'

type Props = {
  leftSidebarCollapsed: boolean
  onToggleLeftSidebar: () => void
  input: string
  setInput: (value: string) => void
  onSubmitPrompt?: (prompt: string) => void
  onOpenAgentSettings?: () => void
}

/**
 * Design-mode main surface: the live canvas (center) + the design agent (right).
 */
export function DesignWorkspaceView({
  input,
  setInput,
  onSubmitPrompt,
  onOpenAgentSettings
}: Props): ReactElement {
  const agentPanelOpen = useDesignWorkspaceStore((s) => s.agentPanelOpen)
  const loadDesignSettings = useDesignWorkspaceStore((s) => s.loadDesignSettings)

  useEffect(() => {
    void loadDesignSettings()
  }, [loadDesignSettings])

  return (
    <div className="flex min-h-0 flex-1">
      <DesignCanvas />
      {agentPanelOpen ? (
        <div className="min-h-0 w-[360px] shrink-0 shadow-[inset_1px_0_0_var(--ds-sidebar-row-ring)]">
          <DesignAgentPanel
            value={input}
            onChange={setInput}
            onSubmit={(value) => onSubmitPrompt?.(value)}
            onOpenSettings={onOpenAgentSettings}
          />
        </div>
      ) : null}
    </div>
  )
}
