import { AlertCircle, CheckCircle2, Circle, CircleDashed, PlayCircle, type LucideIcon } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import {
  buildDesignModeWorkflowRecommendation,
  type DesignModeWorkflowPlan,
  type DesignModeWorkflowStep,
  type DesignModeWorkflowStepStatus
} from '../../design/design-mode/design-mode-workflow'

type Props = {
  workflow: DesignModeWorkflowPlan
}

const MAX_VISIBLE_STEPS = 4

const STATUS_ICON: Record<DesignModeWorkflowStepStatus, LucideIcon> = {
  complete: CheckCircle2,
  recommended: PlayCircle,
  available: CircleDashed,
  blocked: AlertCircle
}

function statusToneClass(status: DesignModeWorkflowStepStatus): string {
  switch (status) {
    case 'complete':
      return 'text-[#2e9e6b]'
    case 'recommended':
      return 'text-[#2f73bf]'
    case 'available':
      return 'text-[#82632a]'
    case 'blocked':
      return 'text-[#b7352b]'
  }
}

function stepToneClass(status: DesignModeWorkflowStepStatus): string {
  switch (status) {
    case 'recommended':
      return 'bg-[#3b82d8]/8 text-[#1f4f7a] dark:text-[#9ec7ec]'
    case 'complete':
      return 'text-ds-faint'
    case 'available':
      return 'text-[#4d4a43] dark:text-white/70'
    case 'blocked':
      return 'text-[#8f3a32] dark:text-[#e7aaa3]'
  }
}

function visibleWorkflowSteps(workflow: DesignModeWorkflowPlan): DesignModeWorkflowStep[] {
  const recommendedIndex = workflow.steps.findIndex((step) => step.id === workflow.recommendedStepId)
  if (recommendedIndex >= 0) {
    return workflow.steps.slice(recommendedIndex, recommendedIndex + MAX_VISIBLE_STEPS)
  }
  return workflow.steps
    .filter((step) => step.status !== 'complete')
    .slice(0, MAX_VISIBLE_STEPS)
}

function seedSummary(input: Record<string, unknown>): string {
  const pairs = Object.entries(input)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .slice(0, 2)
    .map(([key, value]) => `${key}: ${String(value)}`)
  return pairs.length > 0 ? pairs.join(' · ') : '{}'
}

function WorkflowStepRow({ step }: { step: DesignModeWorkflowStep }): ReactElement {
  const Icon = STATUS_ICON[step.status] ?? Circle
  return (
    <li className={`flex min-h-[30px] items-center gap-2 rounded-[8px] px-2 py-1.5 text-[11.5px] ${stepToneClass(step.status)}`}>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${statusToneClass(step.status)}`} strokeWidth={1.9} />
      <span className="min-w-0 flex-1 truncate">{step.id}</span>
      <span className="max-w-[104px] shrink-0 truncate text-[10.5px] text-ds-faint">{step.toolId}</span>
    </li>
  )
}

export function DesignModeWorkflowPanel({ workflow }: Props): ReactElement {
  const { t } = useTranslation('common')
  const recommendation = buildDesignModeWorkflowRecommendation(workflow)
  const steps = visibleWorkflowSteps(workflow)
  const seed = recommendation ? seedSummary(recommendation.toolInputSeed.input) : ''

  return (
    <div className="px-2.5 pt-1.5">
      {recommendation ? (
        <div className="rounded-[8px] bg-[var(--ds-sidebar-row-hover)] px-2.5 py-2 text-[11.5px] leading-5">
          <div className="flex items-center gap-2 text-[#273244] dark:text-white/80">
            <PlayCircle className="h-3.5 w-3.5 shrink-0 text-[#2f73bf]" strokeWidth={1.9} />
            <span className="min-w-0 flex-1 truncate">
              {t('designModeWorkflowNext', { step: recommendation.stepId, tool: recommendation.toolId })}
            </span>
          </div>
          <div className="mt-1 truncate text-ds-faint">
            {t('designModeWorkflowSeed', { seed })}
          </div>
          <div className="truncate text-ds-faint">
            {t('designModeWorkflowNextReason', { reason: recommendation.reason })}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-[8px] bg-[var(--ds-sidebar-row-hover)] px-2.5 py-2 text-[11.5px] text-ds-faint">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#2e9e6b]" strokeWidth={1.9} />
          <span>{t('designModeWorkflowComplete')}</span>
        </div>
      )}
      {steps.length > 0 ? (
        <ul className="mt-1 space-y-0.5">
          {steps.map((step) => (
            <WorkflowStepRow key={step.id} step={step} />
          ))}
        </ul>
      ) : null}
    </div>
  )
}
