import type { DesignOperationJournalEntry } from '../graph/design-graph-types'

export type DesignToolInvocation = {
  toolId: string
  label?: string
  input?: unknown
}

export type DesignToolInvocationResult = {
  ok: boolean
  toolId: string
  status: 'ready' | 'applied' | 'partial' | 'invalid' | 'unsupported'
  affectedIds: string[]
  errors: Array<{ code: string; message: string; suggestion?: string }>
  journalEntry?: DesignOperationJournalEntry
  output?: unknown
  summaryLines: string[]
}

export function invocationInputRecord(input: unknown): Record<string, unknown> | null {
  return input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown>
    : null
}

export function labelForInvocation(invocation: DesignToolInvocation, fallback: string): string {
  const record = invocationInputRecord(invocation.input)
  const inputLabel = typeof record?.label === 'string' ? record.label.trim() : ''
  return invocation.label?.trim() || inputLabel || fallback
}

export function invalidToolResult(
  invocation: DesignToolInvocation,
  error: { code: string; message: string; suggestion?: string }
): DesignToolInvocationResult {
  return {
    ok: false,
    toolId: invocation.toolId,
    status: 'invalid',
    affectedIds: [],
    errors: [error],
    summaryLines: [`${invocation.toolId}: ${error.message}`]
  }
}
