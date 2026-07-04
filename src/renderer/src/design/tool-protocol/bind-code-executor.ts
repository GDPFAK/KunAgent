import { useCanvasShapeStore } from '../canvas/canvas-shape-store'
import type { DesignCodeBinding } from '../code-binding/code-binding-types'
import {
  liveAppBindingMatchesFromCandidates,
  summarizeLiveAppBindingCandidates,
  type LiveAppBindingCandidateSummary
} from '../code-binding/live-app-binding-candidates'
import type { DomSourceBindingMatch } from '../code-binding/dom-source-adapter'
import { appendDesignOperationJournalEntry } from '../graph/design-operation-journal'
import {
  invalidToolResult,
  labelForInvocation,
  type DesignToolInvocation,
  type DesignToolInvocationResult
} from './protocol-types'
import { latestJournalEntry } from './ops-executor'
import { readDesignToolState } from './tool-state'
import { bindInput, type BindCodeInput } from './bind-code-input'

function bindingDelta(before: readonly DesignCodeBinding[], after: readonly DesignCodeBinding[]): {
  activeIds: string[]
  staleIds: string[]
  missingIds: string[]
} {
  const beforeById = new Map(before.map((binding) => [binding.id, binding]))
  const activeIds: string[] = []
  const staleIds: string[] = []
  const missingIds: string[] = []
  for (const binding of after) {
    const previous = beforeById.get(binding.id)
    if (previous?.status === binding.status && previous.updatedAt === binding.updatedAt) continue
    if (binding.status === 'active') activeIds.push(binding.id)
    else if (binding.status === 'stale') staleIds.push(binding.id)
    else missingIds.push(binding.id)
  }
  return { activeIds, staleIds, missingIds }
}

function appendBindCodeJournal(label: string, affectedIds: string[], payload: unknown): void {
  const entry = appendDesignOperationJournalEntry({
    label,
    status: 'applied',
    operations: [{
      id: `dop_bind_${Date.now().toString(36)}`,
      type: 'bind_code',
      label,
      source: 'code-bridge',
      createdAt: new Date().toISOString(),
      targetIds: affectedIds,
      payload
    }],
    affectedIds,
    errors: []
  })
  useCanvasShapeStore.getState().appendOperationJournalEntry(entry)
}

function matchesFromInput(
  input: BindCodeInput
): { matches: DomSourceBindingMatch[]; summary?: LiveAppBindingCandidateSummary } {
  if (input.matches && input.matches.length > 0) return { matches: input.matches }
  const state = readDesignToolState()
  const summary = summarizeLiveAppBindingCandidates({
    doc: state.canvasDocument,
    selectedIds: input.selectedIds ? new Set(input.selectedIds) : undefined,
    snapshotsByFrameId: input.snapshotsByFrameId,
    limit: Number.MAX_SAFE_INTEGER
  })
  return { matches: liveAppBindingMatchesFromCandidates(summary.candidates), summary }
}

export function executeBindCodeInvocation(invocation: DesignToolInvocation): DesignToolInvocationResult {
  const input = bindInput(invocation)
  const { matches, summary } = matchesFromInput(input)
  if (matches.length === 0) {
    return invalidToolResult(invocation, {
      code: 'NO_BINDING_CANDIDATES',
      message: 'design.bind_code found no DOM/source or running-app binding candidates.',
      suggestion: 'Pass matches/snapshotsByFrameId, or add a running app frame with route/source/component metadata.'
    })
  }

  const store = useCanvasShapeStore.getState()
  const beforeBindings = store.document.codeBindings ?? []
  const beforeJournalId = latestJournalEntry()?.id
  const scopeDesignObjectIds = [...new Set(matches.map((match) => match.designObjectId))]
  store.syncDomSourceBindings({
    capturedAt: input.capturedAt,
    matches,
    scopeDesignObjectIds
  })
  const afterBindings = useCanvasShapeStore.getState().document.codeBindings ?? []
  const delta = bindingDelta(beforeBindings, afterBindings)
  appendBindCodeJournal(labelForInvocation(invocation, 'design.bind_code'), scopeDesignObjectIds, {
    matchCount: matches.length,
    activeBindingIds: delta.activeIds,
    staleBindingIds: delta.staleIds,
    missingBindingIds: delta.missingIds
  })
  const journalEntry = latestJournalEntry()
  const entryChanged = journalEntry && journalEntry.id !== beforeJournalId

  return {
    ok: true,
    toolId: invocation.toolId,
    status: 'applied',
    affectedIds: scopeDesignObjectIds,
    errors: [],
    ...(entryChanged ? { journalEntry } : {}),
    output: {
      matchCount: matches.length,
      bindingCount: afterBindings.length,
      activeBindingIds: delta.activeIds,
      staleBindingIds: delta.staleIds,
      missingBindingIds: delta.missingIds,
      ...(summary ? { candidateSummary: summary } : {})
    },
    summaryLines: [
      `${invocation.toolId}: bound ${matches.length} candidate(s)`,
      `active: ${delta.activeIds.length}`,
      `stale: ${delta.staleIds.length}`,
      `affected: ${scopeDesignObjectIds.length}`
    ]
  }
}
