import type { CanvasDocument } from '../canvas/canvas-types'
import type { DesignOperationJournalEntry } from '../graph/design-graph-types'

export type DesignOperationJournalPanelItem = {
  id: string
  label: string
  status: DesignOperationJournalEntry['status']
  createdAt: string
  operationTypes: string[]
  operationCount: number
  affectedIds: string[]
  affectedNames: string[]
  errorCount: number
  active: boolean
}

export type DesignOperationJournalPanelModel = {
  items: DesignOperationJournalPanelItem[]
  totalCount: number
  appliedCount: number
  partialCount: number
}

export type BuildDesignOperationJournalPanelModelInput = {
  doc: CanvasDocument
  selectedIds?: ReadonlySet<string>
  limit?: number
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function affectedNames(doc: CanvasDocument, ids: readonly string[]): string[] {
  return ids
    .map((id) => doc.objects[id]?.name ?? id)
    .filter(Boolean)
    .slice(0, 4)
}

function itemActive(ids: readonly string[], selectedIds: ReadonlySet<string> | undefined): boolean {
  if (!selectedIds || selectedIds.size === 0) return false
  return ids.some((id) => selectedIds.has(id))
}

function toPanelItem(
  doc: CanvasDocument,
  entry: DesignOperationJournalEntry,
  selectedIds: ReadonlySet<string> | undefined
): DesignOperationJournalPanelItem {
  const affectedIds = unique(entry.affectedIds)
  return {
    id: entry.id,
    label: entry.label,
    status: entry.status,
    createdAt: entry.createdAt,
    operationTypes: unique(entry.operations.map((operation) => operation.type)),
    operationCount: entry.operations.length,
    affectedIds,
    affectedNames: affectedNames(doc, affectedIds),
    errorCount: entry.errors.length,
    active: itemActive(affectedIds, selectedIds)
  }
}

export function buildDesignOperationJournalPanelModel({
  doc,
  selectedIds,
  limit = 6
}: BuildDesignOperationJournalPanelModelInput): DesignOperationJournalPanelModel {
  const entries = doc.operationJournal ?? []
  const items = entries
    .slice(-Math.max(0, limit))
    .reverse()
    .map((entry) => toPanelItem(doc, entry, selectedIds))
  return {
    items,
    totalCount: entries.length,
    appliedCount: entries.filter((entry) => entry.status === 'applied').length,
    partialCount: entries.filter((entry) => entry.status === 'partial').length
  }
}
