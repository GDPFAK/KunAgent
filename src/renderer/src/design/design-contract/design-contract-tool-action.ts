import type { DesignIntentMode } from '../design-types'
import type { DesignProjectContractSummary } from './design-project-contract'

export type DesignContractToolAction = {
  id: 'prepare-handoff-package'
  labelKey: string
  detailKey: string
  intentMode: DesignIntentMode
  toolId: string
  toolInputSeed: Record<string, unknown>
  toolCallLine: string
  prompt: string
}

export function buildDesignContractToolAction(
  summary: DesignProjectContractSummary
): DesignContractToolAction {
  const toolInputSeed = {
    format: 'package',
    title: summary.title,
    designMdPath: summary.path
  }
  const toolCallLine = `Suggested tool call: design.export ${JSON.stringify(toolInputSeed)}`
  return {
    id: 'prepare-handoff-package',
    labelKey: 'designContractPrepareHandoff',
    detailKey: 'designContractPrepareHandoffDetail',
    intentMode: 'preview',
    toolId: 'design.export',
    toolInputSeed,
    toolCallLine,
    prompt: [
      `Prepare the design handoff package for ${summary.title}.`,
      `Contract path: ${summary.path}.`,
      `Current state: ${summary.screenCount} screen(s), ${summary.directionCount} direction(s), ${summary.objectCount} graph object(s), ${summary.codeBindingCount} code binding(s), ${summary.journalEntryCount} journal entrie(s).`,
      '',
      'Use DESIGN.md as the agent contract for code, Penpot/OpenUI interop, review, and implementation handoff.',
      'Include product decisions, screens, flows, design-system tokens/components, code bindings, validation findings, and open questions.',
      toolCallLine
    ].join('\n')
  }
}
