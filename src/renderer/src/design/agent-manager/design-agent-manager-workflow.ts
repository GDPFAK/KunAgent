import {
  buildDesignModeWorkflowStepRecommendation,
  type DesignModeWorkflowPlan,
  type DesignModeWorkflowStep
} from '../design-mode/design-mode-workflow'
import type {
  DesignAgentManagerRole,
  DesignAgentManagerRoleId
} from './design-agent-manager'

const ROLE_WORKFLOW_STEPS: Record<DesignAgentManagerRoleId, string[]> = {
  planner: ['plan-directions'],
  generator: ['generate-first-screen', 'generate-directions'],
  systemizer: ['extract-design-system'],
  critic: ['critique-current-direction', 'repair-review-notes'],
  'code-binder': ['bind-code', 'implement-bound-changes'],
  exporter: ['export-handoff']
}

function stepPriority(step: DesignModeWorkflowStep): number {
  switch (step.status) {
    case 'recommended':
      return 0
    case 'available':
      return 1
    case 'blocked':
      return 2
    case 'complete':
      return 3
  }
}

function workflowStepForRole(
  workflow: DesignModeWorkflowPlan,
  roleId: DesignAgentManagerRoleId
): DesignModeWorkflowStep | null {
  const ids = new Set(ROLE_WORKFLOW_STEPS[roleId])
  const candidates = workflow.steps.filter((step) => ids.has(step.id))
  return candidates.sort((a, b) => stepPriority(a) - stepPriority(b))[0] ?? null
}

function appendWorkflowPrompt(role: DesignAgentManagerRole, lines: readonly string[]): string | undefined {
  if (!role.actionPrompt) return undefined
  return [
    role.actionPrompt,
    '',
    'Workflow contract:',
    ...lines
  ].join('\n')
}

export function attachWorkflowToAgentRoles(
  roles: readonly DesignAgentManagerRole[],
  workflow: DesignModeWorkflowPlan
): DesignAgentManagerRole[] {
  return roles.map((role) => {
    const step = workflowStepForRole(workflow, role.id)
    const recommendation = step
      ? buildDesignModeWorkflowStepRecommendation(workflow, step.id)
      : null
    if (!recommendation) return role
    const promptLines = [
      recommendation.promptHeading,
      recommendation.promptScopeLine,
      recommendation.toolCallLine,
      ...recommendation.promptInstructionLines
    ]
    return {
      ...role,
      workflowStepId: recommendation.stepId,
      workflowToolId: recommendation.toolId,
      workflowToolCallLine: recommendation.toolCallLine,
      ...(role.actionPrompt
        ? { actionPrompt: appendWorkflowPrompt(role, promptLines) }
        : {})
    }
  })
}
