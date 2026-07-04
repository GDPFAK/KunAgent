import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../canvas/canvas-types'
import { createRunningAppFrameShape } from '../canvas/running-app-frame'
import type { DesignOperationJournalEntry } from '../graph/design-graph-types'
import { buildDesignCodeBridgeToolAction } from './design-code-bridge-tool-action'

function addJournal(doc: ReturnType<typeof createEmptyDocument>): void {
  const entry: DesignOperationJournalEntry = {
    id: 'journal_1',
    label: 'Update CTA',
    createdAt: '2026-07-02T12:00:00.000Z',
    status: 'applied',
    affectedIds: ['shape_cta'],
    errors: [],
    operations: [{
      id: 'op_1',
      type: 'update_shape',
      label: 'Edit text',
      source: 'agent',
      createdAt: '2026-07-02T12:00:00.000Z',
      targetIds: ['shape_cta'],
      payload: { op: 'update', id: 'shape_cta', patch: { textContent: 'Launch' } }
    }]
  }
  doc.operationJournal = [entry]
}

describe('design code bridge tool action', () => {
  it('prepares bind_code for running app frames without active bindings', () => {
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

    const action = buildDesignCodeBridgeToolAction(doc)

    expect(action).toMatchObject({
      id: 'bind-code',
      intentMode: 'modify',
      toolId: 'design.bind_code',
      toolInputSeed: {
        selectedIds: [frame.id],
        source: 'running-app-or-dom-snapshot'
      }
    })
    expect(action.prompt).toContain('Suggested tool call: design.bind_code')
  })

  it('prepares implement when active bindings can produce code requests', () => {
    const doc = createEmptyDocument()
    addJournal(doc)
    doc.codeBindings = [{
      id: 'binding_cta',
      designObjectId: 'shape_cta',
      kind: 'dom-node',
      status: 'active',
      createdAt: '2026-07-02T12:00:00.000Z',
      target: { sourceFile: 'src/app/page.tsx', onlookId: 'cta' }
    }]

    const action = buildDesignCodeBridgeToolAction(doc)

    expect(action).toMatchObject({
      id: 'implement-code',
      intentMode: 'modify',
      toolId: 'design.implement',
      toolInputSeed: {
        source: 'latest-operation-journal',
        journalEntryId: 'journal_1'
      }
    })
    expect(action.toolCallLine).toContain('Suggested tool call: design.implement')
  })
})
