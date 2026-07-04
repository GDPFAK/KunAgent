import type { LintFinding } from '../canvas/design-lint'
import type { ExecuteResult, OpError } from '../canvas/shape-ops/schema'

export type RepairMode = 'auto' | 'explicit'

export type RepairCategoryId = 'design-system' | 'accessibility' | 'interaction' | 'note-resolution'

export type RepairCategory = {
  id: RepairCategoryId
  findingCount: number
  repairedCount: number
}

export type RepairOperationSummary = {
  index: number
  op: string
  targetIds: string[]
}

export type RepairRecommendation = {
  toolId: string
  reason: string
  inputHint: string
}

export type DesignRepairReport = {
  status: 'applied' | 'partial' | 'blocked'
  mode: RepairMode
  opCount: number
  affectedCount: number
  findingCount: number
  repairedFindingCount: number
  unresolvedFindingCount: number
  noteResolutionCount: number
  categories: RepairCategory[]
  operationSummaries: RepairOperationSummary[]
  unresolvedFindings: LintFinding[]
  recommendations: RepairRecommendation[]
}

export type BuildDesignRepairReportOptions = {
  mode: RepairMode
  ops: readonly unknown[]
  findings: readonly LintFinding[]
  repairedFindings: readonly LintFinding[]
  unresolvedFindings: readonly LintFinding[]
  noteResolutionCount: number
  result: ExecuteResult
  errors: readonly OpError[]
}

function opRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function targetIdsForOp(op: unknown): string[] {
  const record = opRecord(op)
  if (!record) return []
  if (Array.isArray(record.ids)) return record.ids.filter((id): id is string => typeof id === 'string')
  if (typeof record.id === 'string') return [record.id]
  if (typeof record.parentId === 'string') return [record.parentId]
  return []
}

function opName(op: unknown): string {
  const record = opRecord(op)
  return typeof record?.op === 'string' ? record.op : 'unknown'
}

function categoryForFinding(finding: LintFinding): Exclude<RepairCategoryId, 'note-resolution'> {
  if (finding.code === 'off-token-color') return 'design-system'
  if (finding.code === 'low-contrast') return 'accessibility'
  return 'interaction'
}

function countByCategory(
  findings: readonly LintFinding[],
  category: Exclude<RepairCategoryId, 'note-resolution'>
): number {
  return findings.filter((finding) => categoryForFinding(finding) === category).length
}

function repairCategories(options: BuildDesignRepairReportOptions): RepairCategory[] {
  const categories: RepairCategory[] = []
  for (const id of ['design-system', 'accessibility', 'interaction'] as const) {
    const findingCount = countByCategory(options.findings, id)
    const repairedCount = countByCategory(options.repairedFindings, id)
    if (findingCount > 0 || repairedCount > 0) categories.push({ id, findingCount, repairedCount })
  }
  if (options.noteResolutionCount > 0) {
    categories.push({
      id: 'note-resolution',
      findingCount: options.noteResolutionCount,
      repairedCount: options.noteResolutionCount
    })
  }
  return categories
}

function operationSummaries(ops: readonly unknown[]): RepairOperationSummary[] {
  return ops.map((op, index) => ({
    index,
    op: opName(op),
    targetIds: targetIdsForOp(op)
  }))
}

function recommendations(options: BuildDesignRepairReportOptions): RepairRecommendation[] {
  if (options.errors.length > 0 || options.unresolvedFindings.length > 0) {
    return [{
      toolId: 'design.ops',
      reason: 'Some repair work could not be applied automatically.',
      inputHint: 'Pass explicit ShapeOp repairs for unresolved findings or failed operation targets.'
    }]
  }
  return [{
    toolId: 'design.critique',
    reason: 'Repair operations were applied; run critique again to verify the design state.',
    inputHint: 'Use the affectedIds from this repair result as scopeIds.'
  }]
}

export function buildDesignRepairReport(options: BuildDesignRepairReportOptions): DesignRepairReport {
  const blocked = options.ops.length === 0 || (
    options.repairedFindings.length === 0 && options.findings.length > 0
  )
  const status = options.errors.length > 0 || options.unresolvedFindings.length > 0
    ? 'partial'
    : blocked
      ? 'blocked'
      : 'applied'
  return {
    status,
    mode: options.mode,
    opCount: options.ops.length,
    affectedCount: options.result.affectedIds.length,
    findingCount: options.findings.length,
    repairedFindingCount: options.repairedFindings.length,
    unresolvedFindingCount: options.unresolvedFindings.length,
    noteResolutionCount: options.noteResolutionCount,
    categories: repairCategories(options),
    operationSummaries: operationSummaries(options.ops),
    unresolvedFindings: options.unresolvedFindings.map((finding) => ({ ...finding })),
    recommendations: recommendations(options)
  }
}
