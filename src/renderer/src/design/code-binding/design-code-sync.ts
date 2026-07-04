import type { CanvasDocument } from '../canvas/canvas-types'
import type { DesignOperationJournalEntry } from '../graph/design-graph-types'
import {
  designOperationsToCodeChangePlan,
  type DesignCodeChangePlan
} from './code-change-request'
import {
  applyReactTailwindPlanToWorkspace,
  type ReactTailwindWorkspaceAdapter,
  type ReactTailwindWorkspaceApplyResult
} from './react-tailwind-workspace-adapter'

export type LatestDesignCodeChangePlan = {
  journalEntry: DesignOperationJournalEntry | null
  plan: DesignCodeChangePlan
}

export type ApplyLatestDesignCodeChangesOptions = {
  workspaceRoot: string
  document: CanvasDocument
  adapter: ReactTailwindWorkspaceAdapter
}

export type ApplyLatestDesignCodeChangesResult = LatestDesignCodeChangePlan & {
  result: ReactTailwindWorkspaceApplyResult
}

export function latestDesignOperationJournalEntry(
  doc: CanvasDocument
): DesignOperationJournalEntry | null {
  const journal = doc.operationJournal ?? []
  return journal[journal.length - 1] ?? null
}

export function buildLatestDesignCodeChangePlan(doc: CanvasDocument): LatestDesignCodeChangePlan {
  const journal = doc.operationJournal ?? []
  if (journal.length === 0) {
    return {
      journalEntry: null,
      plan: { requests: [], skipped: [] }
    }
  }
  const bindings = doc.codeBindings ?? []
  let latestFallback: LatestDesignCodeChangePlan | null = null
  for (let index = journal.length - 1; index >= 0; index -= 1) {
    const journalEntry = journal[index]
    const plan = designOperationsToCodeChangePlan(journalEntry.operations, bindings)
    const candidate = { journalEntry, plan }
    latestFallback ??= candidate
    if (plan.requests.length > 0) return candidate
  }
  return latestFallback ?? {
    journalEntry: null,
    plan: { requests: [], skipped: [] }
  }
}

export async function applyLatestDesignCodeChangesToWorkspace({
  workspaceRoot,
  document,
  adapter
}: ApplyLatestDesignCodeChangesOptions): Promise<ApplyLatestDesignCodeChangesResult> {
  const latest = buildLatestDesignCodeChangePlan(document)
  if (latest.plan.requests.length === 0) {
    return {
      ...latest,
      result: {
        written: [],
        skipped: latest.plan.skipped.map((item) => ({
          requestId: item.operationId,
          reason: item.reason
        }))
      }
    }
  }
  const result = await applyReactTailwindPlanToWorkspace({
    workspaceRoot,
    plan: latest.plan,
    adapter
  })
  return { ...latest, result }
}
