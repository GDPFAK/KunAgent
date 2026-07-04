import { isRunningAppFrame, type CanvasDocument } from '../canvas/canvas-types'
import type { DesignIntentMode } from '../design-types'
import { buildLatestDesignCodeChangePlan } from './design-code-sync'
import {
  formatLiveAppBindingCandidateSummary,
  summarizeLiveAppBindingCandidates
} from './live-app-binding-candidates'

export type DesignCodeBridgeToolAction = {
  id: 'bind-code' | 'implement-code'
  labelKey: string
  detailKey: string
  intentMode: DesignIntentMode
  toolId: string
  toolInputSeed: Record<string, unknown>
  toolCallLine: string
  prompt: string
}

function runningAppFrameIds(doc: CanvasDocument): string[] {
  return Object.values(doc.objects)
    .filter((shape) => shape && isRunningAppFrame(shape))
    .map((shape) => shape.id)
}

function toolCallLine(toolId: string, input: Record<string, unknown>): string {
  return `Suggested tool call: ${toolId} ${JSON.stringify(input)}`
}

function bindingCounts(doc: CanvasDocument): {
  active: number
  stale: number
  missing: number
} {
  const bindings = doc.codeBindings ?? []
  return {
    active: bindings.filter((binding) => binding.status === 'active').length,
    stale: bindings.filter((binding) => binding.status === 'stale').length,
    missing: bindings.filter((binding) => binding.status === 'missing').length
  }
}

function bindCodeAction(doc: CanvasDocument): DesignCodeBridgeToolAction {
  const frameIds = runningAppFrameIds(doc)
  const summary = summarizeLiveAppBindingCandidates({ doc, limit: 6 })
  const toolInputSeed = {
    ...(frameIds.length > 0 ? { selectedIds: frameIds } : {}),
    source: 'running-app-or-dom-snapshot'
  }
  const callLine = toolCallLine('design.bind_code', toolInputSeed)
  return {
    id: 'bind-code',
    labelKey: 'designCodeSyncPrepareBindings',
    detailKey: 'designCodeSyncPrepareBindingsDetail',
    intentMode: 'modify',
    toolId: 'design.bind_code',
    toolInputSeed,
    toolCallLine: callLine,
    prompt: [
      'Prepare the design code bridge for this board.',
      formatLiveAppBindingCandidateSummary(summary),
      '',
      'Create or refresh code bindings from running app frames, DOM/source ids, routes, and components.',
      'Mark stale or missing bindings instead of guessing ambiguous matches.',
      callLine
    ].join('\n')
  }
}

function implementAction(doc: CanvasDocument): DesignCodeBridgeToolAction {
  const counts = bindingCounts(doc)
  const latest = buildLatestDesignCodeChangePlan(doc)
  const toolInputSeed = {
    source: 'latest-operation-journal',
    ...(latest.journalEntry ? { journalEntryId: latest.journalEntry.id } : {})
  }
  const callLine = toolCallLine('design.implement', toolInputSeed)
  return {
    id: 'implement-code',
    labelKey: 'designCodeSyncPrepareImplementation',
    detailKey: 'designCodeSyncPrepareImplementationDetail',
    intentMode: 'modify',
    toolId: 'design.implement',
    toolInputSeed,
    toolCallLine: callLine,
    prompt: [
      'Prepare bound design changes for implementation.',
      `Latest journal: ${latest.journalEntry?.label ?? 'none'}.`,
      `Code requests: ${latest.plan.requests.length}; skipped: ${latest.plan.skipped.length}.`,
      `Bindings: ${counts.active} active, ${counts.stale} stale, ${counts.missing} missing.`,
      '',
      'Use active CodeBinding entries and the operation journal to prepare precise React/Tailwind change requests.',
      'If bindings are stale or missing, refresh bindings before proposing source edits.',
      callLine
    ].join('\n')
  }
}

export function buildDesignCodeBridgeToolAction(doc: CanvasDocument): DesignCodeBridgeToolAction {
  const counts = bindingCounts(doc)
  const liveSummary = summarizeLiveAppBindingCandidates({ doc, limit: 1 })
  const latest = buildLatestDesignCodeChangePlan(doc)
  if (counts.active > 0 && counts.stale === 0 && counts.missing === 0 && latest.plan.requests.length > 0) {
    return implementAction(doc)
  }
  if (counts.active === 0 || counts.stale > 0 || counts.missing > 0 || liveSummary.candidateCount > 0) {
    return bindCodeAction(doc)
  }
  return implementAction(doc)
}
