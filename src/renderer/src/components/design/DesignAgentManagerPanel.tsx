import { useMemo, type ComponentType, type ReactElement } from 'react'
import { Cable, FileCheck2, GitBranch, Play, SearchCheck, WandSparkles, Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCanvasShapeStore } from '../../design/canvas/canvas-shape-store'
import { useDesignSystemStore } from '../../design/canvas/design-system-store'
import type { DesignDocument } from '../../design/design-types'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'
import {
  buildDesignAgentManagerModel,
  type DesignAgentManagerRole,
  type DesignAgentManagerRoleId,
  type DesignAgentManagerStatus
} from '../../design/agent-manager/design-agent-manager'
import { SidebarIconButton, SidebarSectionHeader } from '../sidebar/SidebarPrimitives'
import { useDesignAgentActionRunner } from './useDesignAgentActionRunner'

type Props = {
  document: DesignDocument | null
  onSeedPrompt?: (prompt: string) => void
}

const ROLE_ICONS: Record<DesignAgentManagerRoleId, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  planner: GitBranch,
  generator: WandSparkles,
  systemizer: Wrench,
  critic: SearchCheck,
  'code-binder': Cable,
  exporter: FileCheck2
}

function statusLabelKey(status: DesignAgentManagerStatus): string {
  switch (status) {
    case 'running':
      return 'designAgentManagerStatusRunning'
    case 'ready':
      return 'designAgentManagerStatusReady'
    case 'idle':
      return 'designAgentManagerStatusIdle'
    case 'blocked':
      return 'designAgentManagerStatusBlocked'
  }
}

function statusToneClass(status: DesignAgentManagerStatus): string {
  switch (status) {
    case 'running':
      return 'bg-[#3b82d8]/10 text-[#2f73bf]'
    case 'ready':
      return 'bg-[#2e9e6b]/10 text-[#2e9e6b]'
    case 'blocked':
      return 'bg-[#c98a3a]/12 text-[#a56d25]'
    case 'idle':
      return 'bg-ds-hover/55 text-ds-faint'
  }
}

function AgentProgress({ role }: { role: DesignAgentManagerRole }): ReactElement | null {
  const progress = role.progress
  if (!progress || progress.total <= 0) return null
  const width = Math.max(4, Math.min(100, Math.round((progress.done / progress.total) * 100)))
  return (
    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-[var(--ds-sidebar-row-ring)]">
      <span className="block h-full rounded-full bg-[#3b82d8]" style={{ width: `${width}%` }} />
    </span>
  )
}

function AgentRoleRow({
  role,
  onSeedPrompt
}: {
  role: DesignAgentManagerRole
  onSeedPrompt?: (prompt: string) => void
}): ReactElement {
  const { t } = useTranslation('common')
  const Icon = ROLE_ICONS[role.id]
  const runAgentAction = useDesignAgentActionRunner(onSeedPrompt)
  const runnable = Boolean(role.actionPrompt && role.intentMode)
  return (
    <li className="flex min-h-[38px] items-start gap-2 rounded-[8px] px-2.5 py-2 text-[12.5px] text-[#343434] transition hover:bg-[var(--ds-sidebar-row-hover)] dark:text-white/75">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ds-muted" strokeWidth={1.9} />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{t(role.labelKey)}</span>
        <span className="mt-0.5 block text-[10.5px] leading-4 text-ds-faint">
          {t(role.detailKey, role.detailOptions)}
        </span>
        {role.workflowStepId && role.workflowToolId ? (
          <span className="mt-0.5 block truncate text-[10.5px] leading-4 text-ds-faint">
            {role.workflowStepId} · {role.workflowToolId}
          </span>
        ) : null}
        <AgentProgress role={role} />
      </span>
      <span
        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] leading-none ${statusToneClass(role.status)}`}
      >
        {t(statusLabelKey(role.status))}
      </span>
      <SidebarIconButton
        title={runnable ? t('designAgentManagerRunRole') : t('designAgentManagerRoleUnavailable')}
        ariaLabel={runnable ? t('designAgentManagerRunRole') : t('designAgentManagerRoleUnavailable')}
        disabled={!runnable}
        onClick={() => {
          if (!role.actionPrompt || !role.intentMode) return
          runAgentAction({
            intentMode: role.intentMode,
            prompt: role.actionPrompt
          })
        }}
        tone="accent"
        className="-mr-1 -mt-1 h-6 w-6"
      >
        <Play className="h-3 w-3" strokeWidth={1.9} />
      </SidebarIconButton>
    </li>
  )
}

export function DesignAgentManagerPanel({ document, onSeedPrompt }: Props): ReactElement | null {
  const { t } = useTranslation('common')
  const canvasDocument = useCanvasShapeStore((s) => s.document)
  const designSystem = useDesignSystemStore((s) => s.system)
  const artifacts = useDesignWorkspaceStore((s) => s.artifacts)
  const pagesRun = useDesignWorkspaceStore((s) => s.pagesRun)
  const parallelPageStates = useDesignWorkspaceStore((s) => s.parallelPageStates)
  const model = useMemo(
    () =>
      buildDesignAgentManagerModel({
        document,
        canvasDocument,
        designSystem,
        artifacts,
        pagesRun,
        parallelPageStates
      }),
    [artifacts, canvasDocument, designSystem, document, pagesRun, parallelPageStates]
  )

  if (!document) return null

  return (
    <section>
      <SidebarSectionHeader label={t('designAgentManagerTitle')} />
      <ul className="space-y-1">
        {model.roles.map((role) => (
          <AgentRoleRow key={role.id} role={role} onSeedPrompt={onSeedPrompt} />
        ))}
      </ul>
      <div className="px-2.5 pt-1 text-[11.5px] leading-5 text-ds-faint">
        {t('designAgentManagerSummary', {
          ready: model.readyCount,
          running: model.runningCount,
          blocked: model.blockedCount
        })}
      </div>
    </section>
  )
}
