import type { ReactElement } from 'react'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('common')
  const agentPanelOpen = useDesignWorkspaceStore((s) => s.agentPanelOpen)
  const implementOpen = useDesignWorkspaceStore((s) => s.implementOpen)
  const loadDesignSettings = useDesignWorkspaceStore((s) => s.loadDesignSettings)
  const fileError = useDesignWorkspaceStore((s) => s.fileError)
  const setFileError = useDesignWorkspaceStore((s) => s.setFileError)

  useEffect(() => {
    void loadDesignSettings()
  }, [loadDesignSettings])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {fileError ? (
        <div className="ds-no-drag flex shrink-0 items-center justify-between gap-2 bg-[#c0392b]/10 px-3 py-1.5 text-[12px] text-[#c0392b] shadow-[inset_0_-1px_0_rgba(192,57,43,0.25)] dark:text-[#f0a0a0]">
          <span className="min-w-0 flex-1 truncate">{fileError}</span>
          <button
            type="button"
            onClick={() => setFileError(null)}
            aria-label={t('close')}
            className="shrink-0 transition-opacity hover:opacity-70"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1">
        <DesignCanvas />
        {agentPanelOpen && !implementOpen ? (
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
    </div>
  )
}
