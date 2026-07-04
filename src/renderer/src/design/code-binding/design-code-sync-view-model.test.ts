import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../canvas/canvas-types'
import type { CanvasDocument } from '../canvas/canvas-types'
import { createRunningAppFrameShape } from '../canvas/running-app-frame'
import type { DesignOperationJournalEntry } from '../graph/design-graph-types'
import { buildDesignCodeSyncViewModel } from './design-code-sync-view-model'

function addJournal(doc: CanvasDocument): void {
  const entry: DesignOperationJournalEntry = {
    id: 'journal_1',
    label: 'Update CTA',
    createdAt: '2026-07-02T12:00:00.000Z',
    status: 'applied',
    affectedIds: ['shape_cta'],
    errors: [],
    operations: [
      {
        id: 'op_1',
        type: 'update_shape',
        label: 'Edit text',
        source: 'agent',
        createdAt: '2026-07-02T12:00:00.000Z',
        targetIds: ['shape_cta'],
        payload: {
          op: 'update',
          id: 'shape_cta',
          patch: { textContent: 'Launch' }
        }
      }
    ]
  }
  doc.operationJournal = [entry]
}

describe('design code sync view model', () => {
  it('is hidden for empty documents without journal or bindings', () => {
    expect(buildDesignCodeSyncViewModel({ doc: createEmptyDocument(), workspaceRoot: '/workspace' })).toMatchObject({
      visible: false,
      canApply: false,
      disabledReason: 'no-journal'
    })
  })

  it('enables apply when the latest journal has an active code binding', () => {
    const doc = createEmptyDocument()
    addJournal(doc)
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

    expect(buildDesignCodeSyncViewModel({ doc, workspaceRoot: '/workspace' })).toMatchObject({
      visible: true,
      canApply: true,
      activeBindingCount: 1,
      requestCount: 1,
      journalLabel: 'Update CTA',
      toolAction: {
        id: 'implement-code',
        toolId: 'design.implement',
        toolCallLine: expect.stringContaining('Suggested tool call: design.implement')
      }
    })
  })

  it('is visible for running app frames before code bindings are captured', () => {
    const doc = createEmptyDocument()
    const frame = createRunningAppFrameShape({
      x: 0,
      y: 0,
      url: 'localhost:5173/dashboard',
      title: 'Live dashboard',
      routePath: '/dashboard',
      sourceFile: 'src/app/dashboard/page.tsx'
    })!
    doc.objects[frame.id] = { ...frame, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [frame.id] }

    expect(buildDesignCodeSyncViewModel({ doc, workspaceRoot: '/workspace' })).toMatchObject({
      visible: true,
      canApply: false,
      disabledReason: 'no-journal',
      runningAppFrameCount: 1,
      liveBindingCandidateCount: 1,
      bindingCount: 0,
      toolAction: {
        id: 'bind-code',
        toolId: 'design.bind_code',
        toolInputSeed: {
          selectedIds: [frame.id]
        }
      }
    })
  })

  it('surfaces stale-only bindings as disabled', () => {
    const doc = createEmptyDocument()
    addJournal(doc)
    doc.codeBindings = [
      {
        id: 'binding_stale',
        designObjectId: 'shape_cta',
        kind: 'dom-node',
        status: 'stale',
        createdAt: '2026-07-02T12:00:00.000Z',
        target: { sourceFile: 'src/app/page.tsx', onlookId: 'cta' }
      }
    ]

    expect(buildDesignCodeSyncViewModel({ doc, workspaceRoot: '/workspace' })).toMatchObject({
      visible: true,
      canApply: false,
      disabledReason: 'no-active-bindings',
      staleBindingCount: 1
    })
  })
})
