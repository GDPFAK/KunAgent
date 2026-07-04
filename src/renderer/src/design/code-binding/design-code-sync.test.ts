import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../canvas/canvas-types'
import type { DesignOperationJournalEntry } from '../graph/design-graph-types'
import {
  applyLatestDesignCodeChangesToWorkspace,
  buildLatestDesignCodeChangePlan
} from './design-code-sync'

function journalEntry(id: string, textContent: string): DesignOperationJournalEntry {
  return {
    id,
    label: 'Edit button',
    createdAt: '2026-07-02T12:00:00.000Z',
    status: 'applied',
    affectedIds: ['shape_cta'],
    errors: [],
    operations: [
      {
        id: `op_${id}`,
        type: 'update_shape',
        label: 'Edit button text',
        source: 'agent',
        createdAt: '2026-07-02T12:00:00.000Z',
        targetIds: ['shape_cta'],
        payload: {
          op: 'update',
          id: 'shape_cta',
          patch: { textContent }
        }
      }
    ]
  }
}

describe('design code sync orchestration', () => {
  it('builds a code change plan from the latest canvas journal entry', () => {
    const doc = createEmptyDocument()
    doc.operationJournal = [
      journalEntry('old', 'Old'),
      journalEntry('latest', 'Launch')
    ]
    doc.codeBindings = [
      {
        id: 'binding_cta',
        designObjectId: 'shape_cta',
        kind: 'dom-node',
        status: 'active',
        createdAt: '2026-07-02T12:00:00.000Z',
        target: {
          sourceFile: 'src/app/page.tsx',
          onlookId: 'cta'
        }
      }
    ]

    const latest = buildLatestDesignCodeChangePlan(doc)

    expect(latest.journalEntry?.id).toBe('latest')
    expect(latest.plan.requests).toMatchObject([
      {
        kind: 'edit-text',
        sourceFile: 'src/app/page.tsx',
        onlookId: 'cta',
        payload: { textContent: 'Launch' }
      }
    ])
  })

  it('skips over latest non-implementable journal entries when building code requests', () => {
    const doc = createEmptyDocument()
    doc.operationJournal = [
      journalEntry('design-edit', 'Launch'),
      {
        id: 'journal_bind',
        label: 'Bind code',
        createdAt: '2026-07-02T12:00:10.000Z',
        status: 'applied',
        affectedIds: ['shape_cta'],
        errors: [],
        operations: [{
          id: 'op_bind',
          type: 'bind_code',
          label: 'Bind code',
          source: 'code-bridge',
          createdAt: '2026-07-02T12:00:10.000Z',
          targetIds: ['shape_cta'],
          payload: { bindingIds: ['binding_cta'] }
        }]
      }
    ]
    doc.codeBindings = [
      {
        id: 'binding_cta',
        designObjectId: 'shape_cta',
        kind: 'dom-node',
        status: 'active',
        createdAt: '2026-07-02T12:00:00.000Z',
        target: {
          sourceFile: 'src/app/page.tsx',
          onlookId: 'cta'
        }
      }
    ]

    const latest = buildLatestDesignCodeChangePlan(doc)

    expect(latest.journalEntry?.id).toBe('design-edit')
    expect(latest.plan.requests).toHaveLength(1)
    expect(latest.plan.requests[0]).toMatchObject({
      kind: 'edit-text',
      payload: { textContent: 'Launch' }
    })
  })

  it('applies the latest journal changes through the React Tailwind workspace adapter', async () => {
    const doc = createEmptyDocument()
    doc.operationJournal = [journalEntry('latest', 'Launch')]
    doc.codeBindings = [
      {
        id: 'binding_cta',
        designObjectId: 'shape_cta',
        kind: 'dom-node',
        status: 'active',
        createdAt: '2026-07-02T12:00:00.000Z',
        target: {
          sourceFile: 'src/app/page.tsx',
          onlookId: 'cta'
        }
      }
    ]
    const readWorkspaceFile = vi.fn(async () => ({
      ok: true as const,
      path: 'src/app/page.tsx',
      content: '<button data-onlook-id="cta">Start</button>',
      size: 44,
      truncated: false
    }))
    const writeWorkspaceFile = vi.fn(async () => ({
      ok: true as const,
      path: 'src/app/page.tsx',
      savedAt: '2026-07-02T12:00:01.000Z'
    }))

    const result = await applyLatestDesignCodeChangesToWorkspace({
      workspaceRoot: '/workspace',
      document: doc,
      adapter: { readWorkspaceFile, writeWorkspaceFile }
    })

    expect(writeWorkspaceFile).toHaveBeenCalledWith({
      workspaceRoot: '/workspace',
      path: 'src/app/page.tsx',
      content: '<button data-onlook-id="cta">Launch</button>'
    })
    expect(result.result.written).toEqual([{ sourceFile: 'src/app/page.tsx', requestIds: expect.any(Array) }])
  })
})
