import { isRunningAppFrame, type CanvasDocument } from '../canvas/canvas-types'
import { buildLatestDesignCodeChangePlan } from './design-code-sync'
import {
  buildDesignCodeBridgeToolAction,
  type DesignCodeBridgeToolAction
} from './design-code-bridge-tool-action'
import { summarizeLiveAppBindingCandidates } from './live-app-binding-candidates'

export type DesignCodeSyncDisabledReason =
  | 'no-workspace'
  | 'no-journal'
  | 'no-active-bindings'
  | 'no-requests'

export type DesignCodeSyncViewModel = {
  visible: boolean
  canApply: boolean
  disabledReason?: DesignCodeSyncDisabledReason
  bindingCount: number
  activeBindingCount: number
  staleBindingCount: number
  missingBindingCount: number
  boundObjectCount: number
  runningAppFrameCount: number
  liveBindingCandidateCount: number
  liveBindingHighConfidenceCount: number
  requestCount: number
  skippedPlanCount: number
  toolAction: DesignCodeBridgeToolAction
  journalLabel?: string
}

export function buildDesignCodeSyncViewModel({
  doc,
  workspaceRoot
}: {
  doc: CanvasDocument
  workspaceRoot?: string
}): DesignCodeSyncViewModel {
  const bindings = doc.codeBindings ?? []
  const activeBindings = bindings.filter((binding) => binding.status === 'active')
  const runningAppFrameCount = Object.values(doc.objects).filter(isRunningAppFrame).length
  const liveBindingSummary = summarizeLiveAppBindingCandidates({ doc })
  const latest = buildLatestDesignCodeChangePlan(doc)
  const toolAction = buildDesignCodeBridgeToolAction(doc)
  const visible = bindings.length > 0 || runningAppFrameCount > 0 || Boolean(latest.journalEntry)
  const base = {
    visible,
    bindingCount: bindings.length,
    activeBindingCount: activeBindings.length,
    staleBindingCount: bindings.filter((binding) => binding.status === 'stale').length,
    missingBindingCount: bindings.filter((binding) => binding.status === 'missing').length,
    boundObjectCount: new Set(bindings.map((binding) => binding.designObjectId)).size,
    runningAppFrameCount,
    liveBindingCandidateCount: liveBindingSummary.candidateCount,
    liveBindingHighConfidenceCount: liveBindingSummary.highConfidenceCount,
    requestCount: latest.plan.requests.length,
    skippedPlanCount: latest.plan.skipped.length,
    toolAction,
    ...(latest.journalEntry?.label ? { journalLabel: latest.journalEntry.label } : {})
  }
  if (!workspaceRoot?.trim()) {
    return { ...base, canApply: false, disabledReason: 'no-workspace' }
  }
  if (!latest.journalEntry) {
    return { ...base, canApply: false, disabledReason: 'no-journal' }
  }
  if (activeBindings.length === 0) {
    return { ...base, canApply: false, disabledReason: 'no-active-bindings' }
  }
  if (latest.plan.requests.length === 0) {
    return { ...base, canApply: false, disabledReason: 'no-requests' }
  }
  return { ...base, canApply: true }
}
