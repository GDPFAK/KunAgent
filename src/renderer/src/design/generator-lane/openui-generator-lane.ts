import type { CanvasDocument } from '../canvas/canvas-types'
import { isHtmlFrame } from '../canvas/canvas-types'
import type { DesignTarget } from '../design-context'
import type { DesignIntentMode } from '../design-types'
import {
  buildOpenUiGeneratorToolSeed,
  toolCallLine,
  toolSeedPromptLines,
  type OpenUiGeneratorToolSeed
} from './openui-generator-tool-seeds'

export type OpenUiGeneratorLaneActionId =
  | 'quick-screen'
  | 'three-directions'
  | 'annotate-refine'
  | 'normalize-system'

export type OpenUiGeneratorLaneAction = {
  id: OpenUiGeneratorLaneActionId
  labelKey: string
  detailKey: string
  intentMode: DesignIntentMode
  prompt: string
  toolInputSeed: OpenUiGeneratorToolSeed
  toolCallLine: string
  disabledReasonKey?: string
}

export type OpenUiGeneratorLaneModel = {
  actions: OpenUiGeneratorLaneAction[]
  screenCount: number
  selectedCount: number
  hasCodeBindings: boolean
}

export type BuildOpenUiGeneratorLaneModelOptions = {
  doc: CanvasDocument
  selectedIds: ReadonlySet<string>
  designTarget: DesignTarget
}

function htmlFrameCount(doc: CanvasDocument): number {
  return Object.values(doc.objects).filter((shape) => shape && isHtmlFrame(shape)).length
}

function selectedNames(doc: CanvasDocument, selectedIds: ReadonlySet<string>): string[] {
  return [...selectedIds]
    .map((id) => doc.objects[id]?.name)
    .filter((name): name is string => Boolean(name))
    .slice(0, 8)
}

function contextLine(options: BuildOpenUiGeneratorLaneModelOptions): string {
  const names = selectedNames(options.doc, options.selectedIds)
  return [
    `Design target: ${options.designTarget}.`,
    names.length > 0 ? `Selected canvas objects: ${names.join(', ')}.` : 'No explicit canvas selection.',
    'Use any images already attached in the composer as visual references.'
  ].join('\n')
}

function disabledAction(
  action: Omit<OpenUiGeneratorLaneAction, 'disabledReasonKey'>,
  disabledReasonKey?: string
): OpenUiGeneratorLaneAction {
  return disabledReasonKey ? { ...action, disabledReasonKey } : action
}

function actionPrompt(
  context: string,
  body: string,
  seed: OpenUiGeneratorToolSeed
): string {
  return [
    context,
    '',
    body,
    '',
    'Tool protocol:',
    ...toolSeedPromptLines(seed)
  ].join('\n')
}

export function buildOpenUiGeneratorLaneModel(
  options: BuildOpenUiGeneratorLaneModelOptions
): OpenUiGeneratorLaneModel {
  const screenCount = htmlFrameCount(options.doc)
  const selectedCount = options.selectedIds.size
  const hasCodeBindings = (options.doc.codeBindings ?? []).some((binding) => binding.status === 'active')
  const context = contextLine(options)
  const selectedIdList = [...options.selectedIds]
  const quickScreenSeed = buildOpenUiGeneratorToolSeed({
    actionId: 'quick-screen',
    designTarget: options.designTarget,
    selectedIds: selectedIdList
  })
  const directionsSeed = buildOpenUiGeneratorToolSeed({
    actionId: 'three-directions',
    designTarget: options.designTarget,
    selectedIds: selectedIdList
  })
  const annotateSeed = buildOpenUiGeneratorToolSeed({
    actionId: 'annotate-refine',
    designTarget: options.designTarget,
    selectedIds: selectedIdList
  })
  const normalizeSeed = buildOpenUiGeneratorToolSeed({
    actionId: 'normalize-system',
    designTarget: options.designTarget,
    selectedIds: selectedIdList
  })

  return {
    screenCount,
    selectedCount,
    hasCodeBindings,
    actions: [
      disabledAction({
        id: 'quick-screen',
        labelKey: 'designGeneratorLaneQuickScreen',
        detailKey: 'designGeneratorLaneQuickScreenDetail',
        intentMode: 'generate',
        toolInputSeed: quickScreenSeed,
        toolCallLine: toolCallLine(quickScreenSeed),
        prompt: actionPrompt(
          context,
          'OpenUI-style fast path: generate one polished, rendered screen from this idea. Create it as a graph-backed HTML screen frame, use realistic domain content, extract reusable tokens/components where obvious, and keep the HTML as a prototype source rather than the long-term design database.',
          quickScreenSeed
        )
      }),
      disabledAction({
        id: 'three-directions',
        labelKey: 'designGeneratorLaneThreeDirections',
        detailKey: 'designGeneratorLaneThreeDirectionsDetail',
        intentMode: 'generate',
        toolInputSeed: directionsSeed,
        toolCallLine: toolCallLine(directionsSeed),
        prompt: actionPrompt(
          context,
          'OpenUI-style fast path: create three distinct visual directions for the same product idea. Put each direction on its own screen frame, name the directions, vary layout/information hierarchy/component treatment, and keep shared tokens/components consistent enough for comparison.',
          directionsSeed
        )
      }),
      disabledAction({
        id: 'annotate-refine',
        labelKey: 'designGeneratorLaneAnnotateRefine',
        detailKey: 'designGeneratorLaneAnnotateRefineDetail',
        intentMode: 'modify',
        toolInputSeed: annotateSeed,
        toolCallLine: toolCallLine(annotateSeed),
        prompt: actionPrompt(
          context,
          'OpenUI-style annotate/refine pass: inspect the selected screen or current screen frame, identify concrete visual or interaction issues as canvas annotations/agent notes, then repair them through focused design operations. Preserve the current direction and update the screen DESIGN.md handoff notes.',
          annotateSeed
        ),
      }, screenCount > 0 ? undefined : 'designGeneratorLaneNeedsScreen'),
      disabledAction({
        id: 'normalize-system',
        labelKey: 'designGeneratorLaneNormalizeSystem',
        detailKey: 'designGeneratorLaneNormalizeSystemDetail',
        intentMode: 'modify',
        toolInputSeed: normalizeSeed,
        toolCallLine: toolCallLine(normalizeSeed),
        prompt: actionPrompt(
          context,
          "Normalize this generated HTML/prototype work into Kun's Design Graph and Design System. Extract recurring tokens, components, states, prototype links, and any code-binding opportunities. Reduce one-off hardcoded styling, keep screen frames linked to their DESIGN.md notes, and report what should move toward code or Penpot.",
          normalizeSeed
        ),
      }, screenCount > 0 ? undefined : 'designGeneratorLaneNeedsScreen')
    ]
  }
}
