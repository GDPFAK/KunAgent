import type { DesignIntentMode } from '../design-types'
import type { DesignDirectionScorecard, DirectionScorecardRisk } from './direction-scorecard'

export type DirectionToolAction = {
  id: string
  label: string
  intentMode: DesignIntentMode
  toolId: string
  toolInputSeed: Record<string, unknown>
  toolCallLine: string
  prompt: string
}

export type BuildDirectionToolActionInput = {
  directionId: string
  directionName: string
  artifactIds: readonly string[]
  frameIds: readonly string[]
  scorecard?: DesignDirectionScorecard
}

const RISK_TOOL_PRIORITY: Array<{
  risk: DirectionScorecardRisk
  id: string
  label: string
  intentMode: DesignIntentMode
  toolId: string
  input: (input: BuildDirectionToolActionInput) => Record<string, unknown>
  instruction: string
}> = [
  {
    risk: 'preview-errors',
    id: 'repair-preview',
    label: 'Repair preview errors',
    intentMode: 'modify',
    toolId: 'design.repair',
    input: (input) => scopeInput(input, { maxFindings: 8 }),
    instruction: 'Repair preview and validation issues for this direction through focused design operations.'
  },
  {
    risk: 'unreviewed',
    id: 'critique-direction',
    label: 'Critique direction',
    intentMode: 'modify',
    toolId: 'design.critique',
    input: (input) => scopeInput(input, { attachNotes: true, maxFindings: 8 }),
    instruction: 'Critique this direction and attach precise, repairable notes to the affected screen frames.'
  },
  {
    risk: 'missing-flow',
    id: 'repair-flow',
    label: 'Repair prototype flow',
    intentMode: 'modify',
    toolId: 'design.repair',
    input: (input) => scopeInput(input, { mode: 'prototype-flow', maxFindings: 8 }),
    instruction: 'Repair missing navigation and prototype flow coverage while preserving the chosen direction.'
  },
  {
    risk: 'missing-code-bindings',
    id: 'bind-direction-code',
    label: 'Bind direction to code',
    intentMode: 'modify',
    toolId: 'design.bind_code',
    input: (input) => scopeInput(input),
    instruction: 'Create or refresh code bindings for the selected direction before implementation.'
  },
  {
    risk: 'stale-code-bindings',
    id: 'refresh-code-bindings',
    label: 'Refresh stale code bindings',
    intentMode: 'modify',
    toolId: 'design.bind_code',
    input: (input) => scopeInput(input, { refresh: true }),
    instruction: 'Refresh stale or missing code bindings before proposing code changes.'
  },
  {
    risk: 'not-implemented',
    id: 'prepare-implementation',
    label: 'Prepare implementation',
    intentMode: 'modify',
    toolId: 'design.implement',
    input: (input) => ({
      directionId: input.directionId,
      artifactIds: input.artifactIds,
      source: 'latest-direction-operation-journal'
    }),
    instruction: 'Prepare implementation requests from the direction operation journal and active bindings.'
  }
]

function scopeInput(
  input: BuildDirectionToolActionInput,
  patch: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    directionId: input.directionId,
    artifactIds: input.artifactIds,
    ...(input.frameIds.length > 0 ? { scopeIds: input.frameIds } : {}),
    ...patch
  }
}

function toolCallLine(toolId: string, input: Record<string, unknown>): string {
  return `Suggested tool call: ${toolId} ${JSON.stringify(input)}`
}

function promptFor(
  input: BuildDirectionToolActionInput,
  toolId: string,
  toolInputSeed: Record<string, unknown>,
  instruction: string
): string {
  const scorecard = input.scorecard
  const risks = scorecard?.risks.length ? scorecard.risks.join(', ') : 'none'
  return [
    `Direction: ${input.directionName} (${input.directionId}).`,
    `Artifacts: ${input.artifactIds.join(', ') || 'none'}.`,
    scorecard
      ? `Scorecard: readiness=${scorecard.readiness}, score=${scorecard.score}, implementationCost=${scorecard.implementationCost}, risks=${risks}.`
      : 'Scorecard: unavailable.',
    '',
    instruction,
    'Use the Design Graph and Design Operation Journal as the source of truth.',
    toolCallLine(toolId, toolInputSeed)
  ].join('\n')
}

export function buildDirectionToolAction(
  input: BuildDirectionToolActionInput
): DirectionToolAction {
  const rule = RISK_TOOL_PRIORITY.find((candidate) => input.scorecard?.risks.includes(candidate.risk))
  const fallback = rule ?? {
    id: 'export-direction',
    label: 'Export direction handoff',
    intentMode: 'preview' as const,
    toolId: 'design.export',
    input: (value: BuildDirectionToolActionInput) => ({
      format: 'package',
      directionId: value.directionId,
      artifactIds: value.artifactIds
    }),
    instruction: 'Prepare this direction for DESIGN.md, Penpot, code handoff, and implementation review.'
  }
  const toolInputSeed = fallback.input(input)
  return {
    id: fallback.id,
    label: fallback.label,
    intentMode: fallback.intentMode,
    toolId: fallback.toolId,
    toolInputSeed,
    toolCallLine: toolCallLine(fallback.toolId, toolInputSeed),
    prompt: promptFor(input, fallback.toolId, toolInputSeed, fallback.instruction)
  }
}
