import type { CanvasDocument } from '../canvas/canvas-types'
import { isHtmlFrame, isRunningAppFrame } from '../canvas/canvas-types'
import type { DesignSystem } from '../canvas/design-system-types'
import {
  formatLiveAppBindingCandidateSummary,
  summarizeLiveAppBindingCandidates
} from '../code-binding/live-app-binding-candidates'
import type { DesignTarget } from '../design-context'
import type { DesignArtifact, DesignDocument, DesignIntentMode } from '../design-types'
import { summarizeDesignSystemForGraph } from '../graph/design-system-graph'
import {
  buildDesignModeSurfaceManifest,
  designModeSurfaceSummaryLines
} from '../design-mode/design-mode-surface'
import {
  buildDesignModeWorkflowRecommendation,
  designModeWorkflowSummaryLines,
  type DesignModeWorkflowPhase,
  type DesignModeWorkflowStep
} from '../design-mode/design-mode-workflow'

export type DesignAgentActionId =
  | 'workflow-next-step'
  | 'explore-directions'
  | 'extract-design-system'
  | 'critique-selection'
  | 'componentize-selection'
  | 'prototype-flow'
  | 'bind-live-app'
  | 'repair-code-bridge'

export type DesignAgentAction = {
  id: DesignAgentActionId
  labelKey: string
  detailKey: string
  intentMode: DesignIntentMode
  prompt: string
  disabledReasonKey?: string
}

type BuildDesignAgentActionsInput = {
  doc: CanvasDocument
  selectedIds: ReadonlySet<string>
  designTarget: DesignTarget
  designSystem?: DesignSystem
}

type BuildRecommendedWorkflowActionInput = BuildDesignAgentActionsInput & {
  document: DesignDocument | null
  artifacts?: readonly DesignArtifact[]
}

function htmlFrameCount(doc: CanvasDocument): number {
  return Object.values(doc.objects).filter((shape) => shape && isHtmlFrame(shape)).length
}

function runningAppFrames(doc: CanvasDocument, selectedIds?: ReadonlySet<string>): string[] {
  const frames = Object.values(doc.objects).filter((shape) => shape && isRunningAppFrame(shape))
  const selected = selectedIds && selectedIds.size > 0
    ? frames.filter((shape) => selectedIds.has(shape.id))
    : []
  const source = selected.length > 0 ? selected : frames
  return source
    .map((shape) => {
      const app = shape.runningApp!
      return [
        `${shape.name} (${shape.id})`,
        `url=${app.url}`,
        app.routePath ? `route=${app.routePath}` : '',
        app.sourceFile ? `source=${app.sourceFile}` : '',
        app.componentName ? `component=${app.componentName}` : ''
      ].filter(Boolean).join(' · ')
    })
    .slice(0, 6)
}

function selectedShapeNames(doc: CanvasDocument, selectedIds: ReadonlySet<string>): string[] {
  return [...selectedIds]
    .map((id) => doc.objects[id]?.name)
    .filter((name): name is string => Boolean(name))
    .slice(0, 8)
}

function promptContext(input: BuildDesignAgentActionsInput): string {
  const names = selectedShapeNames(input.doc, input.selectedIds)
  return [
    `Design target: ${input.designTarget}.`,
    names.length > 0 ? `Selected objects: ${names.join(', ')}.` : 'No explicit canvas selection.',
    'Tool protocol: mutate the canvas through design.ops with validated ShapeOp payloads so the Design Operation Journal stays replayable.'
  ].join('\n')
}

function designSystemContext(input: BuildDesignAgentActionsInput): string {
  const summary = summarizeDesignSystemForGraph(input.designSystem, input.doc)
  if (!summary || (summary.tokenCount === 0 && summary.componentCount === 0)) {
    return 'Design-system graph: no project tokens or reusable components yet.'
  }
  const tokens = summary.tokens.slice(0, 8).map((token) => (
    `- token ${token.name} (${token.kind}) · ${token.usageCount} bound use(s)`
  ))
  const components = summary.components.slice(0, 6).map((component) => (
    `- component ${component.name} v${component.version} · ${component.slotCount} slot(s) · ${component.usageCount} instance(s)`
  ))
  return [
    `Design-system graph: ${summary.tokenCount} token(s), ${summary.componentCount} component(s), ${summary.tokenUsageCount} token binding(s), ${summary.componentInstanceCount} component instance(s).`,
    ...tokens,
    ...components
  ].join('\n')
}

function disabledAction(
  action: Omit<DesignAgentAction, 'disabledReasonKey'>,
  disabledReasonKey?: string
): DesignAgentAction {
  return disabledReasonKey ? { ...action, disabledReasonKey } : action
}

function workflowIntentMode(phase: DesignModeWorkflowPhase): DesignIntentMode {
  return phase === 'planning' || phase === 'generation' ? 'generate' : 'modify'
}

function workflowInstruction(step: DesignModeWorkflowStep): string {
  switch (step.id) {
    case 'plan-directions':
      return 'Clarify the product goal and create named design directions before generating many one-off screens.'
    case 'generate-first-screen':
      return 'Generate the first useful screen frame on the canvas and keep it editable through structured design operations.'
    case 'generate-directions':
      return 'Create or refine multiple meaningful directions and keep each direction clearly named for comparison.'
    case 'extract-design-system':
      return 'Extract semantic tokens and reusable components from the current screens, then apply them back to repeated UI patterns.'
    case 'critique-current-direction':
      return 'Critique the current direction and attach precise agent notes or lint findings to the affected canvas objects.'
    case 'repair-review-notes':
      return 'Resolve the current agent notes with focused repair operations while preserving the accepted direction.'
    case 'bind-code':
      return 'Create or refresh code bindings between the design graph and the running app or source files without guessing ambiguous matches.'
    case 'implement-bound-changes':
      return 'Use existing code bindings and the operation journal to prepare precise implementation changes.'
    case 'export-handoff':
      return 'Prepare the design for handoff with DESIGN.md-ready decisions, tokens, assets, and implementation notes.'
    default:
      return 'Execute the recommended design-mode workflow step using structured design operations and explain any missing input.'
  }
}

export function buildRecommendedDesignWorkflowAction(
  input: BuildRecommendedWorkflowActionInput
): DesignAgentAction | null {
  const manifest = buildDesignModeSurfaceManifest({
    document: input.document,
    canvasDocument: input.doc,
    designSystem: input.designSystem ?? { tokens: {}, components: {} },
    artifacts: input.artifacts
  })
  const recommendation = buildDesignModeWorkflowRecommendation(manifest.workflow)
  if (!recommendation) return null
  const step = recommendation.step
  const context = promptContext(input)
  const counts = manifest.counts
  const prompt = [
    context,
    '',
    recommendation.promptHeading,
    recommendation.promptScopeLine,
    `Reason: ${recommendation.reason}`,
    `Inputs: ${recommendation.inputSummary}.`,
    `Outputs: ${recommendation.outputSummary}.`,
    recommendation.toolCallLine,
    ...recommendation.promptInstructionLines,
    `Current counts: ${counts.screenCount} screen(s), ${counts.directionCount} direction(s), ${counts.tokenCount} token(s), ${counts.componentCount} component(s), ${counts.agentNoteCount} open note(s), ${counts.activeBindingCount} active binding(s), ${counts.staleBindingCount} stale binding(s), ${counts.missingBindingCount} missing binding(s).`,
    '',
    workflowInstruction(step),
    'Use the Design Graph as the source of truth. Prefer design.ops, reusable tokens/components, clear direction names, and agent notes for unresolved questions.',
    '',
    'Surface health:',
    ...designModeSurfaceSummaryLines(manifest),
    '',
    'Workflow:',
    ...designModeWorkflowSummaryLines(manifest.workflow)
  ].join('\n')
  return {
    id: 'workflow-next-step',
    labelKey: 'designAgentActionWorkflowNext',
    detailKey: 'designAgentActionWorkflowNextDetail',
    intentMode: workflowIntentMode(step.phase),
    prompt
  }
}

export function buildDesignAgentActions(input: BuildDesignAgentActionsInput): DesignAgentAction[] {
  const context = promptContext(input)
  const systemContext = designSystemContext(input)
  const selectedCount = input.selectedIds.size
  const screenCount = htmlFrameCount(input.doc)
  const liveAppFrames = runningAppFrames(input.doc, input.selectedIds)
  const liveAppContext = liveAppFrames.length > 0
    ? `Live app frames:\n${liveAppFrames.map((frame) => `- ${frame}`).join('\n')}`
    : 'No running app frames.'
  const liveBindingContext = formatLiveAppBindingCandidateSummary(summarizeLiveAppBindingCandidates({
    doc: input.doc,
    selectedIds: input.selectedIds,
    limit: 6
  }))
  const activeBindings = (input.doc.codeBindings ?? []).filter((binding) => binding.status === 'active')
  const hasJournal = (input.doc.operationJournal ?? []).length > 0

  return [
    disabledAction({
      id: 'explore-directions',
      labelKey: 'designAgentActionExploreDirections',
      detailKey: 'designAgentActionExploreDirectionsDetail',
      intentMode: 'generate',
      prompt: `${context}\n\nCreate three distinct UI directions for this product. Put each direction on its own screen frame, name the directions clearly, keep the same design target, and make the differences meaningful in layout, information hierarchy, component treatment, and visual system.`
    }),
    disabledAction({
      id: 'extract-design-system',
      labelKey: 'designAgentActionExtractSystem',
      detailKey: 'designAgentActionExtractSystemDetail',
      intentMode: 'modify',
      prompt: `${context}\n${systemContext}\n\nExtract or update the project design system from the selected objects and nearby screens. Define semantic tokens for palette, typography, spacing, radius, and shadows; apply tokens to repeated styling; define reusable components with named slots for repeated UI patterns; and use design-system-template or lint-design-system when useful. Prefer structured operations such as define-token, apply-token, define-component, update-component, instantiate, and variant-matrix. Keep one-off styling only when it is genuinely unique.`
    }),
    disabledAction({
      id: 'componentize-selection',
      labelKey: 'designAgentActionComponentize',
      detailKey: 'designAgentActionComponentizeDetail',
      intentMode: 'modify',
      prompt: `${context}\n\nTurn the selected canvas objects into a reusable design pattern. Normalize spacing, typography, tokens, variants, and component slots. Preserve the current visual intent while making it easier to reuse across screens.`
    }, selectedCount > 0 ? undefined : 'designAgentActionNeedsSelection'),
    disabledAction({
      id: 'critique-selection',
      labelKey: 'designAgentActionCritiqueSelection',
      detailKey: 'designAgentActionCritiqueSelectionDetail',
      intentMode: 'modify',
      prompt: `${context}\n\nCritique the selected frame, screen, or canvas objects for layout, hierarchy, interaction clarity, token usage, responsive behavior, accessibility, and implementation readiness. For each actionable issue, add a text note on the whiteboard with an agentNote payload: kind "critique", source "critic", severity "warning" or "error", body with the finding, and targetIds pointing at the affected object ids. Keep findings precise and repairable.`
    }, selectedCount > 0 ? undefined : 'designAgentActionNeedsSelection'),
    disabledAction({
      id: 'prototype-flow',
      labelKey: 'designAgentActionPrototypeFlow',
      detailKey: 'designAgentActionPrototypeFlowDetail',
      intentMode: 'modify',
      prompt: `${context}\n\nConnect the existing screens into a clickable prototype flow. Add or repair navigation states, obvious primary actions, back/close paths, and any missing intermediate screens needed for a coherent user journey.`
    }, screenCount >= 2 ? undefined : 'designAgentActionNeedsScreens'),
    disabledAction({
      id: 'bind-live-app',
      labelKey: 'designAgentActionBindLiveApp',
      detailKey: 'designAgentActionBindLiveAppDetail',
      intentMode: 'modify',
      prompt: `${context}\n${liveAppContext}\n${liveBindingContext}\n\nCreate or refresh code bindings for the running app frame(s). Inspect route, DOM/source identifiers, React/Tailwind component names, and stable element ids. Add active codeBindings for confident matches, mark stale or missing bindings instead of guessing, and add agentNote critique/todo notes for ambiguous elements that need user review. Keep all updates as structured design operations.`
    }, liveAppFrames.length > 0 ? undefined : 'designAgentActionNeedsLiveApp'),
    disabledAction({
      id: 'repair-code-bridge',
      labelKey: 'designAgentActionRepairCodeBridge',
      detailKey: 'designAgentActionRepairCodeBridgeDetail',
      intentMode: 'modify',
      prompt: `${context}\n\nUse the current codeBindings and recent operation journal to reconcile this canvas with the React/Tailwind source. Prefer precise bound DOM/component edits, mark ambiguous bindings stale instead of guessing, and report any code changes that need manual review.`
    }, activeBindings.length > 0 && hasJournal ? undefined : 'designAgentActionNeedsCodeBindings')
  ]
}
