import { describe, expect, it } from 'vitest'
import { createDefaultShape, createEmptyDocument } from '../canvas/canvas-types'
import { createAgentNoteShape } from './agent-note-shapes'
import { buildDesignAgentNotesPanelModel } from './design-agent-notes-panel'

function makeDoc() {
  const doc = createEmptyDocument()
  const frame = createDefaultShape('frame', 100, 120)
  frame.name = 'Checkout frame'
  const critique = createAgentNoteShape(
    {
      kind: 'critique',
      body: 'CTA contrast is too low.',
      source: 'critic',
      severity: 'warning',
      targetIds: [frame.id]
    },
    { x: 40, y: 60 }
  )
  const decision = createAgentNoteShape(
    {
      kind: 'decision',
      body: 'Keep the compact checkout summary.',
      source: 'agent',
      resolved: true
    },
    { x: 40, y: 180 }
  )
  doc.objects[frame.id] = { ...frame, parentId: doc.rootId }
  doc.objects[critique.id] = { ...critique, parentId: doc.rootId }
  doc.objects[decision.id] = { ...decision, parentId: doc.rootId }
  doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [frame.id, critique.id, decision.id] }
  return { doc, frame, critique, decision }
}

describe('design agent notes panel model', () => {
  it('summarizes unresolved notes, target names, active selection, and repair prompts', () => {
    const { doc, frame, critique } = makeDoc()
    const model = buildDesignAgentNotesPanelModel({ doc, selectedIds: new Set([frame.id]) })

    expect(model).toMatchObject({
      totalCount: 2,
      unresolvedCount: 1,
      selectedCount: 1,
      countsByKind: {
        critique: 1,
        decision: 1,
        todo: 0,
        question: 0,
        rationale: 0
      }
    })
    expect(model.items[0]).toMatchObject({
      id: critique.id,
      kind: 'critique',
      body: 'CTA contrast is too low.',
      severity: 'warning',
      targetNames: ['Checkout frame'],
      active: true
    })
    expect(model.items[0].repairPrompt).toContain(`Note id: ${critique.id}.`)
    expect(model.items[0].repairPrompt).toContain(`Checkout frame (${frame.id})`)
    expect(model.items[0].repairPrompt).toContain('Use structured design operations.')
    expect(model.items[0].toolAction).toMatchObject({
      id: 'repair-note',
      toolId: 'design.repair',
      toolInputSeed: {
        noteIds: [critique.id],
        scopeIds: [frame.id]
      }
    })
    expect(model.items[0].repairPrompt).toContain('Suggested tool call: design.repair')
  })

  it('limits visible notes after sorting unresolved notes first', () => {
    const { doc } = makeDoc()
    const model = buildDesignAgentNotesPanelModel({ doc, limit: 1 })

    expect(model.items).toHaveLength(1)
    expect(model.items[0].kind).toBe('critique')
  })

  it('maps resolved decision notes to review actions', () => {
    const { doc, decision } = makeDoc()
    const model = buildDesignAgentNotesPanelModel({ doc, selectedIds: new Set([decision.id]) })
    const item = model.items.find((candidate) => candidate.id === decision.id)

    expect(item?.toolAction).toMatchObject({
      id: 'review-note',
      labelKey: 'designAgentNotesReview',
      toolId: 'design.critique',
      toolInputSeed: {
        noteIds: [decision.id],
        attachNotes: true
      }
    })
  })
})
