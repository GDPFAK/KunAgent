import { useCanvasShapeStore } from '../canvas/canvas-shape-store'
import type { DesignCodeChangePlan, DesignCodeChangeRequest } from '../code-binding/code-change-request'
import { buildLatestDesignCodeChangePlan } from '../code-binding/design-code-sync'
import {
  invalidToolResult,
  type DesignToolInvocation,
  type DesignToolInvocationResult
} from './protocol-types'

function activeBindingCount(): number {
  return (useCanvasShapeStore.getState().document.codeBindings ?? [])
    .filter((binding) => binding.status === 'active').length
}

function uniqueDesignObjectIds(requests: readonly DesignCodeChangeRequest[]): string[] {
  return [...new Set(requests.map((request) => request.designObjectId))]
}

function requestsBySourceFile(requests: readonly DesignCodeChangeRequest[]): Array<{
  sourceFile: string
  requestCount: number
  requestIds: string[]
}> {
  const groups = new Map<string, DesignCodeChangeRequest[]>()
  for (const request of requests) {
    const sourceFile = request.sourceFile?.trim() || '(unbound source)'
    const list = groups.get(sourceFile) ?? []
    list.push(request)
    groups.set(sourceFile, list)
  }
  return [...groups.entries()].map(([sourceFile, group]) => ({
    sourceFile,
    requestCount: group.length,
    requestIds: group.map((request) => request.id)
  }))
}

function outputForPlan(plan: DesignCodeChangePlan, journalEntryId: string | null): Record<string, unknown> {
  return {
    journalEntryId,
    requestCount: plan.requests.length,
    skippedCount: plan.skipped.length,
    requests: plan.requests,
    skipped: plan.skipped,
    requestsBySourceFile: requestsBySourceFile(plan.requests)
  }
}

export function executeImplementInvocation(invocation: DesignToolInvocation): DesignToolInvocationResult {
  const latest = buildLatestDesignCodeChangePlan(useCanvasShapeStore.getState().document)
  if (!latest.journalEntry) {
    return invalidToolResult(invocation, {
      code: 'NO_JOURNAL',
      message: 'design.implement needs a design operation journal entry before it can build code requests.',
      suggestion: 'Apply a design.ops change first, then run design.bind_code if the target has no binding.'
    })
  }
  if (activeBindingCount() === 0) {
    return {
      ...invalidToolResult(invocation, {
        code: 'NO_ACTIVE_CODE_BINDINGS',
        message: 'design.implement needs at least one active CodeBinding.',
        suggestion: 'Run design.bind_code on a running app frame or DOM/source snapshot first.'
      }),
      output: outputForPlan(latest.plan, latest.journalEntry.id)
    }
  }
  if (latest.plan.requests.length === 0) {
    return {
      ...invalidToolResult(invocation, {
        code: 'NO_CODE_CHANGE_REQUESTS',
        message: 'No code change requests could be built from the latest design operations.',
        suggestion: 'Make sure the latest design changes target objects with active CodeBindings.'
      }),
      output: outputForPlan(latest.plan, latest.journalEntry.id)
    }
  }
  const affectedIds = uniqueDesignObjectIds(latest.plan.requests)
  return {
    ok: true,
    toolId: invocation.toolId,
    status: 'ready',
    affectedIds,
    errors: [],
    output: outputForPlan(latest.plan, latest.journalEntry.id),
    summaryLines: [
      `${invocation.toolId}: prepared ${latest.plan.requests.length} code request(s)`,
      `journal: ${latest.journalEntry.label}`,
      `files: ${requestsBySourceFile(latest.plan.requests).length}`,
      `skipped: ${latest.plan.skipped.length}`
    ]
  }
}
