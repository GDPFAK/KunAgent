import {
  designToolProtocolById,
  type DesignToolProtocolTool
} from '../tool-protocol/design-tool-protocol'
import type {
  DesignModeSurfaceId,
  DesignModeSurfaceManifest,
  DesignModeSurfaceStatus
} from './design-mode-surface'

export type DesignModeWorkflowPhase = 'planning' | 'generation' | 'system' | 'review' | 'code' | 'handoff'

export type DesignModeWorkflowStepStatus = 'complete' | 'recommended' | 'available' | 'blocked'

export type DesignModeWorkflowStep = {
  id: string
  phase: DesignModeWorkflowPhase
  surfaceId: DesignModeSurfaceId
  toolId: string
  status: DesignModeWorkflowStepStatus
  reason: string
  inputs: string[]
  outputs: string[]
}

export type DesignModeWorkflowPlan = {
  version: 1
  kind: 'kun.design.mode-workflow'
  recommendedStepId: string | null
  steps: DesignModeWorkflowStep[]
}

export type DesignModeWorkflowToolInputSeed = {
  toolId: string
  input: Record<string, unknown>
}

export type DesignModeWorkflowRecommendation = {
  step: DesignModeWorkflowStep
  stepId: string
  phase: DesignModeWorkflowPhase
  surfaceId: DesignModeSurfaceId
  toolId: string
  status: DesignModeWorkflowStepStatus
  reason: string
  inputSummary: string
  outputSummary: string
  promptHeading: string
  promptScopeLine: string
  toolInputSeed: DesignModeWorkflowToolInputSeed
  toolCallLine: string
  promptInstructionLines: string[]
}

type ManifestSnapshot = Pick<
  DesignModeSurfaceManifest,
  'counts' | 'document' | 'recommendedSurfaceId' | 'surfaces'
>

type StepDraft = Omit<DesignModeWorkflowStep, 'inputs' | 'outputs'>

function toolInputs(tool: DesignToolProtocolTool | undefined): string[] {
  return tool?.inputs ?? []
}

function toolOutputs(tool: DesignToolProtocolTool | undefined): string[] {
  return tool?.outputs ?? []
}

function surfaceStatus(manifest: ManifestSnapshot, id: DesignModeSurfaceId): DesignModeSurfaceStatus | undefined {
  return manifest.surfaces.find((surface) => surface.id === id)?.status
}

function withTool(draft: StepDraft): DesignModeWorkflowStep {
  const tool = designToolProtocolById(draft.toolId)
  return {
    ...draft,
    inputs: toolInputs(tool),
    outputs: toolOutputs(tool)
  }
}

function completeOrNext(done: boolean, next: DesignModeWorkflowStepStatus): DesignModeWorkflowStepStatus {
  return done ? 'complete' : next
}

function planningStep(manifest: ManifestSnapshot): DesignModeWorkflowStep {
  const counts = manifest.counts
  const hasDocument = Boolean(manifest.document)
  const status = !hasDocument
    ? 'blocked'
    : completeOrNext(counts.directionCount > 0, 'recommended')
  return withTool({
    id: 'plan-directions',
    phase: 'planning',
    surfaceId: 'agent',
    toolId: 'design.plan',
    status,
    reason: hasDocument
      ? `${counts.directionCount} direction(s) and ${counts.screenCount} screen(s) in the active design.`
      : 'No active design document is available.'
  })
}

function generationStep(manifest: ManifestSnapshot): DesignModeWorkflowStep {
  const counts = manifest.counts
  const hasDocument = Boolean(manifest.document)
  const status = !hasDocument
    ? 'blocked'
    : completeOrNext(counts.screenCount > 0, 'recommended')
  return withTool({
    id: 'generate-first-screen',
    phase: 'generation',
    surfaceId: 'canvas',
    toolId: 'design.generate_screen',
    status,
    reason: hasDocument
      ? `${counts.screenCount} screen frame(s) are available on the board.`
      : 'Create a design document before generating screens.'
  })
}

function directionStep(manifest: ManifestSnapshot): DesignModeWorkflowStep {
  const counts = manifest.counts
  const hasDocument = Boolean(manifest.document)
  const status = !hasDocument
    ? 'blocked'
    : completeOrNext(counts.directionCount > 0, counts.screenCount > 0 ? 'available' : 'recommended')
  return withTool({
    id: 'generate-directions',
    phase: 'generation',
    surfaceId: 'agent',
    toolId: 'design.generate_directions',
    status,
    reason: `${counts.directionCount} active direction(s) and ${counts.screenCount} screen(s).`
  })
}

function systemStep(manifest: ManifestSnapshot): DesignModeWorkflowStep {
  const counts = manifest.counts
  const systemCount = counts.tokenCount + counts.componentCount
  const status = completeOrNext(systemCount > 0, counts.screenCount > 0 ? 'recommended' : 'blocked')
  return withTool({
    id: 'extract-design-system',
    phase: 'system',
    surfaceId: 'design-tools',
    toolId: 'design.system',
    status,
    reason: `${counts.tokenCount} token(s), ${counts.componentCount} component(s), and ${counts.screenCount} screen(s).`
  })
}

function critiqueStep(manifest: ManifestSnapshot): DesignModeWorkflowStep {
  const counts = manifest.counts
  const status = completeOrNext(counts.critiqueEntryCount > 0, counts.screenCount > 0 ? 'recommended' : 'blocked')
  return withTool({
    id: 'critique-current-direction',
    phase: 'review',
    surfaceId: 'whiteboard',
    toolId: 'design.critique',
    status,
    reason: `${counts.critiqueEntryCount} critique pass(es) and ${counts.agentNoteCount} open note(s).`
  })
}

function repairStep(manifest: ManifestSnapshot): DesignModeWorkflowStep {
  const counts = manifest.counts
  const status = counts.agentNoteCount > 0
    ? 'recommended'
    : counts.critiqueEntryCount > 0
      ? 'available'
      : 'blocked'
  return withTool({
    id: 'repair-review-notes',
    phase: 'review',
    surfaceId: 'whiteboard',
    toolId: 'design.repair',
    status,
    reason: `${counts.agentNoteCount} unresolved agent note(s).`
  })
}

function bindCodeStep(manifest: ManifestSnapshot): DesignModeWorkflowStep {
  const counts = manifest.counts
  const codeSurface = surfaceStatus(manifest, 'code-bridge')
  const hasBinding = counts.activeBindingCount > 0
  const hasStaleBinding = counts.staleBindingCount > 0 || counts.missingBindingCount > 0
  const status = !manifest.document
    ? 'blocked'
    : hasBinding && !hasStaleBinding
    ? 'complete'
    : counts.runningAppFrameCount > 0 || counts.screenCount > 0 || codeSurface === 'needs-setup'
      ? 'recommended'
      : 'blocked'
  return withTool({
    id: 'bind-code',
    phase: 'code',
    surfaceId: 'code-bridge',
    toolId: 'design.bind_code',
    status,
    reason: `${counts.activeBindingCount} active, ${counts.staleBindingCount} stale, ${counts.missingBindingCount} missing binding(s).`
  })
}

function implementStep(manifest: ManifestSnapshot): DesignModeWorkflowStep {
  const counts = manifest.counts
  const status = counts.activeBindingCount > 0
    ? counts.operationCount > 0 ? 'available' : 'blocked'
    : 'blocked'
  return withTool({
    id: 'implement-bound-changes',
    phase: 'code',
    surfaceId: 'code-bridge',
    toolId: 'design.implement',
    status,
    reason: `${counts.operationCount} operation journal entry(s) and ${counts.activeBindingCount} active binding(s).`
  })
}

function exportStep(manifest: ManifestSnapshot): DesignModeWorkflowStep {
  const counts = manifest.counts
  const hasContent = counts.screenCount > 0 || counts.objectCount > 0 || counts.tokenCount > 0 || counts.assetCount > 0
  return withTool({
    id: 'export-handoff',
    phase: 'handoff',
    surfaceId: 'handoff',
    toolId: 'design.export',
    status: manifest.document && hasContent ? 'available' : 'blocked',
    reason: `${counts.screenCount} screen(s), ${counts.objectCount} object(s), and ${counts.assetCount} asset(s).`
  })
}

function selectRecommendedStep(steps: readonly DesignModeWorkflowStep[]): string | null {
  return steps.find((step) => step.status === 'recommended')?.id ??
    steps.find((step) => step.status === 'available')?.id ??
    null
}

function applySingleRecommendation(steps: readonly DesignModeWorkflowStep[]): DesignModeWorkflowStep[] {
  const recommendedStepId = selectRecommendedStep(steps)
  return steps.map((step) => (
    step.status === 'recommended' && step.id !== recommendedStepId
      ? { ...step, status: 'available' }
      : step
  ))
}

export function buildDesignModeWorkflowPlan(manifest: ManifestSnapshot): DesignModeWorkflowPlan {
  const steps = applySingleRecommendation([
    planningStep(manifest),
    generationStep(manifest),
    directionStep(manifest),
    systemStep(manifest),
    critiqueStep(manifest),
    repairStep(manifest),
    bindCodeStep(manifest),
    implementStep(manifest),
    exportStep(manifest)
  ])
  return {
    version: 1,
    kind: 'kun.design.mode-workflow',
    recommendedStepId: selectRecommendedStep(steps),
    steps
  }
}

function listSummary(items: readonly string[]): string {
  return items.length > 0 ? items.join(', ') : 'none'
}

function toolInputSeedForStep(step: DesignModeWorkflowStep): DesignModeWorkflowToolInputSeed {
  switch (step.id) {
    case 'plan-directions':
      return {
        toolId: step.toolId,
        input: {
          goal: 'Plan named design directions and the next tool sequence for the active product goal.',
          focus: step.reason
        }
      }
    case 'generate-first-screen':
      return {
        toolId: step.toolId,
        input: {
          prompt: 'Generate the first editable screen for the active product goal.',
          name: 'First screen'
        }
      }
    case 'generate-directions':
      return {
        toolId: step.toolId,
        input: {
          prompt: 'Create three named UI directions for the active product goal.',
          count: 3
        }
      }
    case 'extract-design-system':
      return {
        toolId: step.toolId,
        input: {
          action: 'template',
          operation: 'create',
          name: 'Project design system',
          mode: 'light'
        }
      }
    case 'critique-current-direction':
      return {
        toolId: step.toolId,
        input: {
          attachNotes: true,
          maxFindings: 8
        }
      }
    case 'repair-review-notes':
      return {
        toolId: step.toolId,
        input: {
          maxFindings: 8
        }
      }
    case 'bind-code':
      return {
        toolId: step.toolId,
        input: {
          selectedIds: []
        }
      }
    case 'implement-bound-changes':
      return {
        toolId: step.toolId,
        input: {
          source: 'latest-operation-journal'
        }
      }
    case 'export-handoff':
      return {
        toolId: step.toolId,
        input: {
          format: 'package'
        }
      }
    default:
      return {
        toolId: step.toolId,
        input: {}
      }
  }
}

function compactJson(value: unknown): string {
  return JSON.stringify(value)
}

function toolCallLine(seed: DesignModeWorkflowToolInputSeed): string {
  return `Suggested tool call: ${seed.toolId} ${compactJson(seed.input)}`
}

function promptInstructionLines(
  step: DesignModeWorkflowStep,
  seed: DesignModeWorkflowToolInputSeed
): string[] {
  return [
    `Default workflow tool: ${seed.toolId}.`,
    `Tool input seed: ${compactJson(seed.input)}.`,
    `Keep the step bounded to the ${step.surfaceId} surface and write outputs back to the Design Graph.`
  ]
}

export function getRecommendedDesignModeWorkflowStep(
  plan: DesignModeWorkflowPlan
): DesignModeWorkflowStep | null {
  if (!plan.recommendedStepId) return null
  return plan.steps.find((step) => step.id === plan.recommendedStepId) ?? null
}

export function buildDesignModeWorkflowRecommendation(
  plan: DesignModeWorkflowPlan
): DesignModeWorkflowRecommendation | null {
  const step = getRecommendedDesignModeWorkflowStep(plan)
  return step ? buildDesignModeWorkflowRecommendationForStep(step) : null
}

export function buildDesignModeWorkflowStepRecommendation(
  plan: DesignModeWorkflowPlan,
  stepId: string
): DesignModeWorkflowRecommendation | null {
  const step = plan.steps.find((item) => item.id === stepId)
  return step ? buildDesignModeWorkflowRecommendationForStep(step) : null
}

function buildDesignModeWorkflowRecommendationForStep(
  step: DesignModeWorkflowStep
): DesignModeWorkflowRecommendation {
  const toolInputSeed = toolInputSeedForStep(step)
  return {
    step,
    stepId: step.id,
    phase: step.phase,
    surfaceId: step.surfaceId,
    toolId: step.toolId,
    status: step.status,
    reason: step.reason,
    inputSummary: listSummary(step.inputs),
    outputSummary: listSummary(step.outputs),
    promptHeading: `Recommended design-mode workflow step: ${step.id}.`,
    promptScopeLine: `Phase: ${step.phase}. Surface: ${step.surfaceId}. Tool: ${step.toolId}. Status: ${step.status}.`,
    toolInputSeed,
    toolCallLine: toolCallLine(toolInputSeed),
    promptInstructionLines: promptInstructionLines(step, toolInputSeed)
  }
}

export function designModeWorkflowSummaryLines(plan: DesignModeWorkflowPlan): string[] {
  return plan.steps.map((step) =>
    `- ${step.id} (${step.status}): ${step.toolId}; surface ${step.surfaceId}; ${step.reason}`
  )
}
