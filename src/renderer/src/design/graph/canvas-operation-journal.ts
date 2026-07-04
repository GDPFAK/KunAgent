import type { CanvasDocument } from '../canvas/canvas-types'
import type { DesignOperationJournalEntry } from './design-graph-types'

const CANVAS_OPERATION_JOURNAL_LIMIT = 120

export function appendOperationJournalEntryToCanvasDocument(
  doc: CanvasDocument,
  entry: DesignOperationJournalEntry
): CanvasDocument {
  const existing = doc.operationJournal ?? []
  const operationJournal = [...existing.filter((item) => item.id !== entry.id), entry]
    .slice(-CANVAS_OPERATION_JOURNAL_LIMIT)
  return {
    ...doc,
    graph: {
      version: 1,
      ...doc.graph,
      updatedAt: entry.createdAt,
      lastJournalEntryId: entry.id
    },
    operationJournal
  }
}

export function summarizeCanvasOperationJournal(
  doc: CanvasDocument,
  limit = 6
): Array<{
  label: string
  status: DesignOperationJournalEntry['status']
  operationTypes: string[]
  affectedCount: number
  errorCount: number
}> {
  return (doc.operationJournal ?? [])
    .slice(-Math.max(0, limit))
    .map((entry) => ({
      label: entry.label,
      status: entry.status,
      operationTypes: [...new Set(entry.operations.map((operation) => operation.type))],
      affectedCount: entry.affectedIds.length,
      errorCount: entry.errors.length
    }))
}
