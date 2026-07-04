import type { CanvasDocument, CanvasShape, Fill } from '../canvas/canvas-types'
import { contrastRatio, lintDesignSystem, type LintFinding } from '../canvas/design-lint'
import { executeOps } from '../canvas/shape-ops'
import type { OpError } from '../canvas/shape-ops/schema'
import { listAgentNoteShapes } from '../agent-notes/agent-note-shapes'
import {
  invalidToolResult,
  invocationInputRecord,
  labelForInvocation,
  type DesignToolInvocation,
  type DesignToolInvocationResult
} from './protocol-types'
import { latestJournalEntry } from './ops-executor'
import { readDesignToolState } from './tool-state'
import { buildDesignRepairReport, type RepairMode } from './repair-report'

type GeneratedRepair = {
  mode: RepairMode
  ops: unknown[]
  findings: LintFinding[]
  repairedFindings: LintFinding[]
  unresolvedFindings: LintFinding[]
  noteResolutionCount: number
}

function inputRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const ids = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
  return ids.length > 0 ? ids : undefined
}

function normalizeRepairOps(input: unknown): unknown[] | null {
  if (Array.isArray(input)) return input
  const record = invocationInputRecord(input)
  const rawOps = record && (Array.isArray(record.ops) ? record.ops : record.operations)
  if (!Array.isArray(rawOps)) return null
  return rawOps.map((op) => {
    const wrapped = inputRecord(op)
    return wrapped && 'payload' in wrapped ? wrapped.payload : op
  })
}

function solidFill(shape: CanvasShape): string | null {
  const fill = shape.fills.find((item): item is Extract<Fill, { type: 'solid' }> =>
    item.type === 'solid' && item.opacity > 0
  )
  return fill?.color ?? null
}

function nearestAncestorFill(doc: CanvasDocument, shape: CanvasShape): string | null {
  let current = shape.parentId ? doc.objects[shape.parentId] : null
  while (current && current.id !== doc.rootId) {
    const fill = solidFill(current)
    if (fill) return fill
    current = current.parentId ? doc.objects[current.parentId] : null
  }
  return null
}

function tokenFromFinding(finding: LintFinding): string | null {
  return finding.message.match(/token "([^"]+)"/)?.[1] ?? null
}

function contrastRepairColor(background: string): string {
  const dark = '#111827'
  const light = '#ffffff'
  return contrastRatio(dark, background) >= contrastRatio(light, background) ? dark : light
}

function repairOpForFinding(doc: CanvasDocument, finding: LintFinding): unknown | null {
  if (!finding.shapeId) return null
  const shape = doc.objects[finding.shapeId]
  if (!shape) return null
  if (finding.code === 'off-token-color') {
    const token = tokenFromFinding(finding)
    return token ? { op: 'apply-token', ids: [shape.id], prop: 'fill', token } : null
  }
  if (finding.code === 'small-hit-target') {
    return {
      op: 'resize',
      id: shape.id,
      bounds: {
        x: shape.x,
        y: shape.y,
        width: Math.max(44, shape.width),
        height: Math.max(44, shape.height)
      }
    }
  }
  if (finding.code === 'low-contrast') {
    const background = nearestAncestorFill(doc, shape)
    return background
      ? { op: 'set-style', ids: [shape.id], style: { fontColor: contrastRepairColor(background) } }
      : null
  }
  return null
}

function unresolvedNoteTargetIds(doc: CanvasDocument): string[] {
  const ids = new Set<string>()
  for (const note of listAgentNoteShapes(doc)) {
    if (note.agentNote.resolved === true) continue
    for (const id of note.agentNote.targetIds ?? []) ids.add(id)
  }
  return [...ids]
}

function resolveNoteOps(doc: CanvasDocument, repairedTargetIds: readonly string[]): unknown[] {
  const repaired = new Set(repairedTargetIds)
  return listAgentNoteShapes(doc)
    .filter((shape) => {
      if (shape.agentNote.resolved === true) return false
      return (shape.agentNote.targetIds ?? []).some((id) => repaired.has(id))
    })
    .map((shape) => ({
      op: 'update',
      id: shape.id,
      patch: {
        agentNote: { ...shape.agentNote, resolved: true },
        textContent: shape.textContent?.startsWith('Resolved: ')
          ? shape.textContent
          : `Resolved: ${shape.textContent ?? shape.agentNote.body}`
      }
    }))
}

function scopeIdsForAutoRepair(invocation: DesignToolInvocation, doc: CanvasDocument): string[] | undefined {
  const record = invocationInputRecord(invocation.input)
  return (
    stringArray(record?.scopeIds) ??
    stringArray(record?.targetIds) ??
    stringArray(record?.selectedIds) ??
    stringArray(record?.ids) ??
    unresolvedNoteTargetIds(doc)
  )
}

function maxFindings(invocation: DesignToolInvocation): number {
  const record = invocationInputRecord(invocation.input)
  const raw = typeof record?.maxFindings === 'number' ? record.maxFindings : 8
  return Math.max(0, Math.min(20, Math.round(raw)))
}

function autoRepairOps(invocation: DesignToolInvocation): GeneratedRepair {
  const state = readDesignToolState()
  const scopeIds = scopeIdsForAutoRepair(invocation, state.canvasDocument)
  const findings = lintDesignSystem(state.canvasDocument, state.designSystem, { scopeIds })
    .slice(0, maxFindings(invocation))
  const repairOps: unknown[] = []
  const repairedFindings: LintFinding[] = []
  const unresolvedFindings: LintFinding[] = []
  for (const finding of findings) {
    const op = repairOpForFinding(state.canvasDocument, finding)
    if (op) {
      repairOps.push(op)
      repairedFindings.push(finding)
    } else {
      unresolvedFindings.push(finding)
    }
  }
  const repairedIds = repairedFindings.map((finding) => finding.shapeId).filter((id): id is string => Boolean(id))
  const noteOps = resolveNoteOps(state.canvasDocument, repairedIds)
  return {
    mode: 'auto',
    findings,
    repairedFindings,
    unresolvedFindings,
    noteResolutionCount: noteOps.length,
    ops: [...repairOps, ...noteOps]
  }
}

export function executeRepairInvocation(invocation: DesignToolInvocation): DesignToolInvocationResult {
  const explicitOps = normalizeRepairOps(invocation.input)
  const generated: GeneratedRepair = explicitOps
    ? {
        mode: 'explicit',
        ops: explicitOps,
        findings: [],
        repairedFindings: [],
        unresolvedFindings: [],
        noteResolutionCount: 0
      }
    : autoRepairOps(invocation)
  if (generated.ops.length === 0) {
    return invalidToolResult(invocation, {
      code: 'NO_REPAIR_OPS',
      message: 'design.repair could not derive any repair operations.',
      suggestion: 'Pass explicit repair ops, or run design.critique/design.system validate to create repairable findings.'
    })
  }

  const beforeJournalId = latestJournalEntry()?.id
  const result = executeOps(generated.ops, labelForInvocation(invocation, 'design.repair'))
  const journalEntry = latestJournalEntry()
  const entryChanged = journalEntry && journalEntry.id !== beforeJournalId
  const errors = result.errors.map((error: OpError) => ({ ...error }))
  const report = buildDesignRepairReport({
    mode: generated.mode,
    ops: generated.ops,
    findings: generated.findings,
    repairedFindings: generated.repairedFindings,
    unresolvedFindings: generated.unresolvedFindings,
    noteResolutionCount: generated.noteResolutionCount,
    result,
    errors: result.errors
  })
  return {
    ok: result.ok,
    toolId: invocation.toolId,
    status: result.ok ? 'applied' : 'partial',
    affectedIds: result.affectedIds,
    errors,
    ...(entryChanged ? { journalEntry } : {}),
    output: {
      opCount: generated.ops.length,
      findingCount: generated.findings.length,
      findings: generated.findings,
      report
    },
    summaryLines: [
      `${invocation.toolId}: ${result.ok ? 'applied' : 'partial'} ${generated.ops.length} repair op(s)`,
      `repair report: ${report.status}, repaired ${report.repairedFindingCount}/${report.findingCount}`,
      `findings: ${generated.findings.length}`,
      `affected: ${result.affectedIds.length}`,
      `errors: ${errors.length}`
    ]
  }
}
