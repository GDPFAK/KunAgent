import { useCanvasShapeStore } from '../canvas/canvas-shape-store'
import { executeOps } from '../canvas/shape-ops'
import type { OpError } from '../canvas/shape-ops/schema'
import type { DesignOperationJournalEntry } from '../graph/design-graph-types'
import {
  invalidToolResult,
  invocationInputRecord,
  labelForInvocation,
  type DesignToolInvocation,
  type DesignToolInvocationResult
} from './protocol-types'

function normalizeOpsInput(input: unknown): unknown[] | null {
  if (Array.isArray(input)) return input
  const record = invocationInputRecord(input)
  const rawOps = record && (Array.isArray(record.ops) ? record.ops : record.operations)
  if (!Array.isArray(rawOps)) return null
  return rawOps.map((op) => {
    const operationRecord = invocationInputRecord(op)
    return operationRecord && 'payload' in operationRecord ? operationRecord.payload : op
  })
}

export function latestJournalEntry(): DesignOperationJournalEntry | undefined {
  return useCanvasShapeStore.getState().document.operationJournal?.at(-1)
}

export function executeDesignOpsInvocation(invocation: DesignToolInvocation): DesignToolInvocationResult {
  const ops = normalizeOpsInput(invocation.input)
  if (!ops) {
    return invalidToolResult(invocation, {
      code: 'INVALID_INPUT',
      message: 'design.ops expects an array or an object with ops/operations.',
      suggestion: 'Pass ShapeOp[] directly, or DesignOperation[] with each operation payload set to a ShapeOp.'
    })
  }
  const label = labelForInvocation(invocation, 'design.ops')
  const beforeJournalId = latestJournalEntry()?.id
  const result = executeOps(ops, label)
  const journalEntry = latestJournalEntry()
  const entryChanged = journalEntry && journalEntry.id !== beforeJournalId
  const errors = result.errors.map((error: OpError) => ({ ...error }))
  return {
    ok: result.ok,
    toolId: invocation.toolId,
    status: result.ok ? 'applied' : 'partial',
    affectedIds: result.affectedIds,
    errors,
    ...(entryChanged ? { journalEntry } : {}),
    summaryLines: [
      `${invocation.toolId}: ${result.ok ? 'applied' : 'partial'} ${ops.length} operation${ops.length === 1 ? '' : 's'}`,
      `affected: ${result.affectedIds.length}`,
      `errors: ${errors.length}`
    ]
  }
}
