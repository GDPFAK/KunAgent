import { useDesignSystemStore } from '../canvas/design-system-store'
import { executeOps } from '../canvas/shape-ops'
import type { OpError } from '../canvas/shape-ops/schema'
import { summarizeDesignSystemForGraph } from '../graph/design-system-graph'
import {
  invalidToolResult,
  invocationInputRecord,
  labelForInvocation,
  type DesignToolInvocation,
  type DesignToolInvocationResult
} from './protocol-types'
import { latestJournalEntry } from './ops-executor'
import { readDesignToolState } from './tool-state'

const SYSTEM_OPS = new Set([
  'define-token',
  'apply-token',
  'define-component',
  'update-component',
  'instantiate',
  'instantiate-many',
  'detach',
  'variant-matrix',
  'design-system-template',
  'lint-design-system'
])

function operationRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function normalizeSystemOps(input: unknown): unknown[] | null {
  if (Array.isArray(input)) return input
  const record = invocationInputRecord(input)
  if (!record) return null
  if (typeof record.op === 'string') return [record]
  const rawOps = Array.isArray(record.ops) ? record.ops : record.operations
  if (Array.isArray(rawOps)) {
    return rawOps.map((op) => {
      const wrapped = operationRecord(op)
      return wrapped && 'payload' in wrapped ? wrapped.payload : op
    })
  }
  const action = typeof record.action === 'string' ? record.action : record.operation
  if (action === 'validate' || action === 'lint') {
    return [{
      op: 'lint-design-system',
      targetIds: Array.isArray(record.targetIds) ? record.targetIds : record.scopeIds
    }]
  }
  if (action === 'template' || action === 'create-template' || record.template) {
    return [{
      op: 'design-system-template',
      operation: record.operation === 'apply' || record.operation === 'update' ? record.operation : 'create',
      name: record.name,
      seedColor: record.seedColor,
      mode: record.mode,
      template: record.template,
      tone: record.tone,
      sections: record.sections,
      targetIds: record.targetIds,
      x: record.x,
      y: record.y,
      width: record.width,
      height: record.height,
      dryRun: record.dryRun
    }]
  }
  return null
}

function invalidSystemOpMessage(ops: readonly unknown[]): string | null {
  for (let index = 0; index < ops.length; index += 1) {
    const op = operationRecord(ops[index])
    const opName = typeof op?.op === 'string' ? op.op : ''
    if (!opName || !SYSTEM_OPS.has(opName)) {
      return `design.system only accepts design-system operations; op #${index} was "${opName || 'unknown'}".`
    }
  }
  return null
}

function systemCounts(): { tokenCount: number; componentCount: number } {
  const system = useDesignSystemStore.getState().system
  return {
    tokenCount: Object.keys(system.tokens).length,
    componentCount: Object.keys(system.components).length
  }
}

export function executeDesignSystemInvocation(invocation: DesignToolInvocation): DesignToolInvocationResult {
  const ops = normalizeSystemOps(invocation.input)
  if (!ops) {
    return invalidToolResult(invocation, {
      code: 'INVALID_INPUT',
      message: 'design.system expects system ops, DesignOperation payloads, or a validate/template action.',
      suggestion: 'Use define-token, apply-token, define-component, instantiate, design-system-template, or lint-design-system.'
    })
  }
  const invalidMessage = invalidSystemOpMessage(ops)
  if (invalidMessage) {
    return invalidToolResult(invocation, {
      code: 'INVALID_SYSTEM_OP',
      message: invalidMessage,
      suggestion: 'Route geometry edits through design.ops instead of design.system.'
    })
  }

  const before = systemCounts()
  const beforeJournalId = latestJournalEntry()?.id
  const result = executeOps(ops, labelForInvocation(invocation, 'design.system'))
  const journalEntry = latestJournalEntry()
  const entryChanged = journalEntry && journalEntry.id !== beforeJournalId
  const after = systemCounts()
  const state = readDesignToolState()
  const summary = summarizeDesignSystemForGraph(state.designSystem, state.canvasDocument)
  const errors = result.errors.map((error: OpError) => ({ ...error }))

  return {
    ok: result.ok,
    toolId: invocation.toolId,
    status: result.ok ? 'applied' : 'partial',
    affectedIds: result.affectedIds,
    errors,
    ...(entryChanged ? { journalEntry } : {}),
    output: {
      before,
      after,
      designSystem: summary,
      opCount: ops.length
    },
    summaryLines: [
      `${invocation.toolId}: ${result.ok ? 'applied' : 'partial'} ${ops.length} system op(s)`,
      `tokens: ${before.tokenCount} -> ${after.tokenCount}`,
      `components: ${before.componentCount} -> ${after.componentCount}`,
      `affected: ${result.affectedIds.length}`
    ]
  }
}
