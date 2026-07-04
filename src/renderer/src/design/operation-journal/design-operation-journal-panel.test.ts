import { describe, expect, it } from 'vitest'
import {
  createDefaultShape,
  createEmptyDocument,
  type CanvasDocument
} from '../canvas/canvas-types'
import type { DesignOperationJournalEntry } from '../graph/design-graph-types'
import { buildDesignOperationJournalPanelModel } from './design-operation-journal-panel'

const now = '2026-07-02T00:00:00.000Z'

function addToRoot(doc: CanvasDocument, ...shapes: ReturnType<typeof createDefaultShape>[]): void {
  for (const shape of shapes) {
    doc.objects[shape.id] = { ...shape, parentId: doc.rootId }
  }
  doc.objects[doc.rootId] = {
    ...doc.objects[doc.rootId],
    children: shapes.map((shape) => shape.id)
  }
}

function journalEntry(
  id: string,
  label: string,
  affectedIds: string[],
  status: DesignOperationJournalEntry['status'] = 'applied'
): DesignOperationJournalEntry {
  return {
    id,
    label,
    createdAt: now,
    status,
    affectedIds,
    errors: status === 'partial' ? [{ code: 'WARN', message: 'Partial operation' }] : [],
    operations: [{
      id: `${id}_op`,
      type: id === 'entry_2' ? 'apply_token' : 'create_shape',
      label,
      source: 'agent',
      createdAt: now,
      targetIds: affectedIds,
      payload: {}
    }]
  }
}

describe('buildDesignOperationJournalPanelModel', () => {
  it('summarizes recent journal entries newest-first and marks selected affected objects', () => {
    const doc = createEmptyDocument()
    const card = createDefaultShape('rect', 20, 32)
    card.name = 'Pricing card'
    const badge = createDefaultShape('text', 50, 64)
    badge.name = 'Status badge'
    addToRoot(doc, card, badge)
    doc.operationJournal = [
      journalEntry('entry_1', 'Create card', [card.id]),
      journalEntry('entry_2', 'Apply token', [badge.id], 'partial')
    ]

    const model = buildDesignOperationJournalPanelModel({
      doc,
      selectedIds: new Set([badge.id])
    })

    expect(model).toMatchObject({ totalCount: 2, appliedCount: 1, partialCount: 1 })
    expect(model.items.map((item) => item.id)).toEqual(['entry_2', 'entry_1'])
    expect(model.items[0]).toMatchObject({
      label: 'Apply token',
      operationTypes: ['apply_token'],
      affectedNames: ['Status badge'],
      errorCount: 1,
      active: true
    })
    expect(model.items[1].active).toBe(false)
  })

  it('limits the visible journal rows without changing total counts', () => {
    const doc = createEmptyDocument()
    doc.operationJournal = [
      journalEntry('entry_1', 'One', []),
      journalEntry('entry_2', 'Two', []),
      journalEntry('entry_3', 'Three', [])
    ]

    const model = buildDesignOperationJournalPanelModel({ doc, limit: 2 })

    expect(model.totalCount).toBe(3)
    expect(model.items.map((item) => item.label)).toEqual(['Three', 'Two'])
  })
})
