import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  createDefaultShape,
  createEmptyDocument,
  type CanvasDocument
} from '../../design/canvas/canvas-types'
import type { DesignOperationJournalEntry } from '../../design/graph/design-graph-types'
import { DesignOperationJournalPanel } from './DesignOperationJournalPanel'

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

function entry(id: string, affectedIds: string[], status: DesignOperationJournalEntry['status']): DesignOperationJournalEntry {
  return {
    id,
    label: id === 'entry_2' ? 'Apply brand token' : 'Create hero card',
    createdAt: now,
    status,
    affectedIds,
    errors: status === 'partial' ? [{ code: 'BAD_OP', message: 'Could not resize' }] : [],
    operations: [{
      id: `${id}_op`,
      type: id === 'entry_2' ? 'apply_token' : 'create_shape',
      label: 'Operation',
      source: 'agent',
      createdAt: now,
      targetIds: affectedIds,
      payload: {}
    }]
  }
}

describe('DesignOperationJournalPanel', () => {
  it('renders recent operation journal entries and summary counts', () => {
    const doc = createEmptyDocument()
    const card = createDefaultShape('rect', 20, 32)
    card.name = 'Hero card'
    addToRoot(doc, card)
    doc.operationJournal = [
      entry('entry_1', [card.id], 'applied'),
      entry('entry_2', [card.id], 'partial')
    ]

    const html = renderToStaticMarkup(createElement(DesignOperationJournalPanel, {
      canvasDocument: doc,
      selectedIds: new Set([card.id])
    }))

    expect(html).toContain('designOperationJournalTitle')
    expect(html).toContain('Apply brand token')
    expect(html).toContain('Create hero card')
    expect(html).toContain('apply_token')
    expect(html).toContain('Hero card')
    expect(html).toContain('designOperationJournalSummary')
  })

  it('renders nothing without journal entries', () => {
    const html = renderToStaticMarkup(createElement(DesignOperationJournalPanel, {
      canvasDocument: createEmptyDocument(),
      selectedIds: new Set<string>()
    }))

    expect(html).toBe('')
  })
})
