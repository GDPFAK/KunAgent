import { lintDesignSystem, type LintFinding } from '../canvas/design-lint'
import { executeOps } from '../canvas/shape-ops'
import type { CanvasDocument, CanvasShape } from '../canvas/canvas-types'
import {
  invocationInputRecord,
  labelForInvocation,
  type DesignToolInvocation,
  type DesignToolInvocationResult
} from './protocol-types'
import { latestJournalEntry } from './ops-executor'
import { readDesignToolState } from './tool-state'
import { buildDesignCritiqueReport } from './critique-report'

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const ids = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  return ids.length > 0 ? ids : undefined
}

function numberInput(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function critiqueInput(invocation: DesignToolInvocation): {
  scopeIds?: string[]
  attachNotes: boolean
  maxFindings: number
} {
  const record = invocationInputRecord(invocation.input)
  return {
    scopeIds: stringArray(record?.scopeIds) ?? stringArray(record?.targetIds) ?? stringArray(record?.selectedIds),
    attachNotes: record?.attachNotes !== false,
    maxFindings: Math.max(0, Math.min(20, Math.round(numberInput(record?.maxFindings, 8))))
  }
}

function notePositionForFinding(doc: CanvasDocument, finding: LintFinding, index: number): { x: number; y: number } {
  const target = finding.shapeId ? doc.objects[finding.shapeId] : undefined
  if (!target) return { x: 48, y: 72 + index * 112 }
  return {
    x: target.x + target.width + 24,
    y: target.y + index * 28
  }
}

function noteOpForFinding(doc: CanvasDocument, finding: LintFinding, index: number): unknown {
  const position = notePositionForFinding(doc, finding, index)
  const targetIds = finding.shapeId ? [finding.shapeId] : []
  const body = `[${finding.code}] ${finding.message}`
  return {
    op: 'add',
    shape: {
      type: 'text',
      name: 'Critique note',
      x: position.x,
      y: position.y,
      width: 300,
      height: Math.max(96, Math.ceil(body.length / 42) * 24 + 40),
      textContent: `Critique: ${body}`,
      fontSize: 14,
      fontWeight: 500,
      fontColor: '#b45309',
      agentNote: {
        kind: 'critique',
        body,
        source: 'critic',
        severity: finding.code === 'low-contrast' ? 'error' : 'warning',
        targetIds,
        createdAt: new Date().toISOString(),
        resolved: false
      }
    }
  }
}

function targetIdsFromFindings(findings: readonly LintFinding[]): string[] {
  return [...new Set(findings.map((finding) => finding.shapeId).filter((id): id is string => Boolean(id)))]
}

export function executeDesignCritiqueInvocation(invocation: DesignToolInvocation): DesignToolInvocationResult {
  const state = readDesignToolState()
  const input = critiqueInput(invocation)
  const findings = lintDesignSystem(state.canvasDocument, state.designSystem, { scopeIds: input.scopeIds })
  const scopedFindings = findings.slice(0, input.maxFindings)
  const ops: unknown[] = [{ op: 'lint-design-system', targetIds: input.scopeIds }]
  if (input.attachNotes) {
    ops.push(...scopedFindings.map((finding, index) => noteOpForFinding(state.canvasDocument, finding, index)))
  }

  const beforeJournalId = latestJournalEntry()?.id
  const result = executeOps(ops, labelForInvocation(invocation, 'design.critique'))
  const journalEntry = latestJournalEntry()
  const entryChanged = journalEntry && journalEntry.id !== beforeJournalId
  const targetIds = targetIdsFromFindings(findings)
  const report = buildDesignCritiqueReport(state, findings)

  return {
    ok: result.ok,
    toolId: invocation.toolId,
    status: result.ok ? 'applied' : 'partial',
    affectedIds: [...new Set([...targetIds, ...result.affectedIds])],
    errors: result.errors.map((error) => ({ ...error })),
    ...(entryChanged ? { journalEntry } : {}),
    output: {
      findingCount: findings.length,
      noteCount: input.attachNotes ? scopedFindings.length : 0,
      findings,
      report
    },
    summaryLines: [
      `${invocation.toolId}: ${findings.length} finding(s)`,
      `report: ${report.status}, score ${report.score}`,
      `notes: ${input.attachNotes ? scopedFindings.length : 0}`,
      `affected: ${targetIds.length} target(s), ${result.affectedIds.length} note(s)`
    ]
  }
}
