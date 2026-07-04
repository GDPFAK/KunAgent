import type { CanvasDocument } from '../canvas/canvas-types'
import type { DesignSystem } from '../canvas/design-system-types'
import type { DesignTarget } from '../design-context'
import type { DesignIntentMode } from '../design-types'
import { summarizeDesignSystemForGraph } from '../graph/design-system-graph'

export type DesignSystemPanelActionId = 'extract-system' | 'validate-system' | 'apply-system'

export type DesignSystemPanelAction = {
  id: DesignSystemPanelActionId
  labelKey: string
  detailKey: string
  intentMode: DesignIntentMode
  toolId: 'design.system'
  toolInputSeed: Record<string, unknown>
  toolCallLine: string
  prompt: string
  disabledReasonKey?: string
}

export type BuildDesignSystemPanelActionsInput = {
  doc: CanvasDocument
  designSystem: DesignSystem
  selectedIds: ReadonlySet<string>
  designTarget: DesignTarget
}

function toolCallLine(input: Record<string, unknown>): string {
  return `Suggested tool call: design.system ${JSON.stringify(input)}`
}

function selectedScope(doc: CanvasDocument, selectedIds: ReadonlySet<string>): string[] {
  return [...selectedIds].filter((id) => Boolean(doc.objects[id]) && id !== doc.rootId)
}

function designTargetTemplate(target: DesignTarget): string {
  if (target === 'app') return 'app'
  return 'saas'
}

function objectCount(doc: CanvasDocument): number {
  return Object.keys(doc.objects).filter((id) => id !== doc.rootId).length
}

function systemExists(system: DesignSystem): boolean {
  return Object.keys(system.tokens).length > 0 || Object.keys(system.components).length > 0
}

function actionPrompt({
  body,
  input,
  summaryLines
}: {
  body: string
  input: Record<string, unknown>
  summaryLines: string[]
}): string {
  return [
    body,
    '',
    'Design-system context:',
    ...summaryLines,
    '',
    'Use the Design Graph as the source of truth. Keep styling reusable through semantic tokens, component definitions, variants, states, and lint findings.',
    toolCallLine(input)
  ].join('\n')
}

function disabledAction(
  action: Omit<DesignSystemPanelAction, 'disabledReasonKey'>,
  disabledReasonKey?: string
): DesignSystemPanelAction {
  return disabledReasonKey ? { ...action, disabledReasonKey } : action
}

function summaryLines(input: BuildDesignSystemPanelActionsInput): string[] {
  const summary = summarizeDesignSystemForGraph(input.designSystem, input.doc)
  if (!summary) return ['No design-system graph is loaded.']
  const selected = selectedScope(input.doc, input.selectedIds)
  return [
    `${summary.tokenCount} token(s), ${summary.componentCount} component(s), ${summary.tokenUsageCount} token binding(s), ${summary.componentInstanceCount} component instance(s).`,
    selected.length > 0 ? `Selected scope ids: ${selected.join(', ')}.` : 'No explicit selection; operate on the current board.',
    `Canvas objects: ${objectCount(input.doc)}.`
  ]
}

export function buildDesignSystemPanelActions(
  input: BuildDesignSystemPanelActionsInput
): DesignSystemPanelAction[] {
  const selected = selectedScope(input.doc, input.selectedIds)
  const hasContent = objectCount(input.doc) > 0
  const hasSystem = systemExists(input.designSystem)
  const lines = summaryLines(input)
  const extractInput = {
    action: 'template',
    operation: hasSystem ? 'update' : 'create',
    name: 'Project design system',
    template: designTargetTemplate(input.designTarget),
    mode: 'light',
    ...(selected.length > 0 ? { scopeIds: selected, targetIds: selected } : {})
  }
  const validateInput = {
    action: 'validate',
    ...(selected.length > 0 ? { scopeIds: selected, targetIds: selected } : {})
  }
  const applyInput = {
    action: 'template',
    operation: 'apply',
    name: 'Project design system',
    mode: 'light',
    scopeIds: selected,
    targetIds: selected
  }

  return [
    disabledAction({
      id: 'extract-system',
      labelKey: hasSystem ? 'designSystemPanelUpdate' : 'designSystemPanelCreate',
      detailKey: 'designSystemPanelCreateDetail',
      intentMode: 'modify',
      toolId: 'design.system',
      toolInputSeed: extractInput,
      toolCallLine: toolCallLine(extractInput),
      prompt: actionPrompt({
        body: hasSystem
          ? 'Update the project design system from the current canvas and keep existing token/component names stable where possible.'
          : 'Create the first project design system from the current canvas.',
        input: extractInput,
        summaryLines: lines
      })
    }, hasContent ? undefined : 'designSystemPanelNeedsContent'),
    disabledAction({
      id: 'validate-system',
      labelKey: 'designSystemPanelValidate',
      detailKey: 'designSystemPanelValidateDetail',
      intentMode: 'modify',
      toolId: 'design.system',
      toolInputSeed: validateInput,
      toolCallLine: toolCallLine(validateInput),
      prompt: actionPrompt({
        body: 'Validate the current design system against the selected scope or whole canvas.',
        input: validateInput,
        summaryLines: lines
      })
    }, hasContent ? undefined : 'designSystemPanelNeedsContent'),
    disabledAction({
      id: 'apply-system',
      labelKey: 'designSystemPanelApplySelection',
      detailKey: 'designSystemPanelApplySelectionDetail',
      intentMode: 'modify',
      toolId: 'design.system',
      toolInputSeed: applyInput,
      toolCallLine: toolCallLine(applyInput),
      prompt: actionPrompt({
        body: 'Apply the project design system to the selected canvas objects and normalize one-off styling into reusable tokens/components.',
        input: applyInput,
        summaryLines: lines
      })
    }, selected.length === 0
      ? 'designSystemPanelNeedsSelection'
      : hasSystem
        ? undefined
        : 'designSystemPanelNeedsSystem')
  ]
}
