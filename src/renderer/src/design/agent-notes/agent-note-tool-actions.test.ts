import { describe, expect, it } from 'vitest'
import { buildAgentNoteToolAction } from './agent-note-tool-actions'

describe('agent note tool actions', () => {
  it('builds a repair action for unresolved critique notes', () => {
    const action = buildAgentNoteToolAction({
      id: 'note_1',
      kind: 'critique',
      body: 'CTA contrast is too low.',
      resolved: false,
      targetIds: ['frame_1'],
      targetNames: ['Checkout frame'],
      directionId: 'dir_checkout'
    })

    expect(action).toMatchObject({
      id: 'repair-note',
      labelKey: 'designAgentNotesRepair',
      intentMode: 'modify',
      toolId: 'design.repair',
      toolInputSeed: {
        noteIds: ['note_1'],
        scopeIds: ['frame_1'],
        directionId: 'dir_checkout',
        maxFindings: 8
      }
    })
    expect(action.prompt).toContain('Suggested tool call: design.repair')
  })

  it('builds a review action for resolved decisions', () => {
    const action = buildAgentNoteToolAction({
      id: 'note_2',
      kind: 'decision',
      body: 'Keep compact checkout summary.',
      resolved: true,
      targetIds: [],
      targetNames: []
    })

    expect(action).toMatchObject({
      id: 'review-note',
      labelKey: 'designAgentNotesReview',
      intentMode: 'modify',
      toolId: 'design.critique',
      toolInputSeed: {
        noteIds: ['note_2'],
        attachNotes: true,
        maxFindings: 8
      }
    })
    expect(action.toolCallLine).toContain('Suggested tool call: design.critique')
  })
})
