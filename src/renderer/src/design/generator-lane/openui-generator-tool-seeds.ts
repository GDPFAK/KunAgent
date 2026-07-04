import type { DesignTarget } from '../design-context'
import type { OpenUiGeneratorLaneActionId } from './openui-generator-lane'

export type OpenUiGeneratorToolSeed = {
  toolId: string
  input: Record<string, unknown>
  followUpToolIds?: string[]
}

export type BuildOpenUiGeneratorToolSeedOptions = {
  actionId: OpenUiGeneratorLaneActionId
  designTarget: DesignTarget
  selectedIds: readonly string[]
}

function selectedScope(selectedIds: readonly string[]): Record<string, unknown> {
  return selectedIds.length > 0 ? { scopeIds: selectedIds } : {}
}

export function compactToolSeedJson(seed: OpenUiGeneratorToolSeed): string {
  return JSON.stringify(seed.input)
}

export function toolCallLine(seed: OpenUiGeneratorToolSeed): string {
  return `Suggested tool call: ${seed.toolId} ${compactToolSeedJson(seed)}`
}

export function buildOpenUiGeneratorToolSeed(
  options: BuildOpenUiGeneratorToolSeedOptions
): OpenUiGeneratorToolSeed {
  switch (options.actionId) {
    case 'quick-screen':
      return {
        toolId: 'design.generate_screen',
        input: {
          prompt: 'Generate one polished OpenUI-style screen as a graph-backed HTML frame.',
          designTarget: options.designTarget,
          name: 'Generated screen'
        },
        followUpToolIds: ['design.system', 'design.critique']
      }
    case 'three-directions':
      return {
        toolId: 'design.generate_directions',
        input: {
          prompt: 'Create three distinct OpenUI-style directions for the same product idea.',
          count: 3,
          designTarget: options.designTarget
        },
        followUpToolIds: ['design.system', 'design.critique']
      }
    case 'annotate-refine':
      return {
        toolId: 'design.critique',
        input: {
          ...selectedScope(options.selectedIds),
          attachNotes: true,
          maxFindings: 8
        },
        followUpToolIds: ['design.repair']
      }
    case 'normalize-system':
      return {
        toolId: 'design.system',
        input: {
          ...selectedScope(options.selectedIds),
          action: 'template',
          operation: 'create',
          name: 'OpenUI normalized design system',
          mode: 'light'
        },
        followUpToolIds: ['design.export']
      }
  }
}

export function toolSeedPromptLines(seed: OpenUiGeneratorToolSeed): string[] {
  return [
    toolCallLine(seed),
    `Default generator-lane tool: ${seed.toolId}.`,
    ...(seed.followUpToolIds?.length
      ? [`Follow-up tools: ${seed.followUpToolIds.join(' -> ')}.`]
      : []),
    'Keep generated output attached to the Design Graph, operation journal, and screen DESIGN.md notes.'
  ]
}
