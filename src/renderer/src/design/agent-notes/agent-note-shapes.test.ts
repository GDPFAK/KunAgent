import { describe, expect, it } from 'vitest'
import { parseCanvasDocument, serializeCanvasDocument } from '../canvas/canvas-persistence'
import { createEmptyDocument } from '../canvas/canvas-types'
import { snapshotCanvas } from '../canvas/canvas-snapshot'
import { buildDesignGraphFromCanvasDocument } from '../graph/design-graph-from-canvas'
import {
  agentNoteBounds,
  createAgentNoteShape,
  isAgentNoteShape,
  summarizeAgentNotes
} from './agent-note-shapes'

const createdAt = '2026-07-02T00:00:00.000Z'

function documentWithNote() {
  const doc = createEmptyDocument()
  const note = createAgentNoteShape(
    {
      kind: 'critique',
      body: 'Primary CTA is buried below the fold.',
      source: 'critic',
      severity: 'warning',
      targetIds: ['hero-frame'],
      directionId: 'dir_hero'
    },
    { x: 48, y: 72, createdAt }
  )
  doc.objects[note.id] = { ...note, parentId: doc.rootId }
  doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [note.id] }
  return { doc, note }
}

describe('agent note shapes', () => {
  it('creates text-backed whiteboard notes for agent rationale and critique', () => {
    const { note } = documentWithNote()

    expect(isAgentNoteShape(note)).toBe(true)
    expect(note).toMatchObject({
      type: 'text',
      name: 'Critique note',
      textContent: 'Critique: Primary CTA is buried below the fold.',
      agentNote: {
        kind: 'critique',
        source: 'critic',
        severity: 'warning',
        targetIds: ['hero-frame'],
        createdAt
      }
    })
    expect(agentNoteBounds(note)).toEqual({ x: 48, y: 72, width: 280, height: 96 })
  })

  it('persists agent notes and projects them into graph, snapshot, and summaries', () => {
    const { doc, note } = documentWithNote()
    const parsed = parseCanvasDocument(serializeCanvasDocument(doc))

    expect(parsed?.objects[note.id].agentNote).toMatchObject({
      kind: 'critique',
      body: 'Primary CTA is buried below the fold.',
      targetIds: ['hero-frame']
    })

    const graph = buildDesignGraphFromCanvasDocument(parsed!, { projectId: 'project_1', updatedAt: createdAt })
    expect(graph.objects[note.id]).toMatchObject({
      kind: 'agent-note',
      text: { content: 'Critique: Primary CTA is buried below the fold.' },
      metadata: {
        agentNote: {
          kind: 'critique',
          severity: 'warning',
          directionId: 'dir_hero'
        }
      }
    })

    expect(snapshotCanvas(parsed!).shapes[0]).toMatchObject({
      id: note.id,
      textContent: 'Critique: Primary CTA is buried below the fold.',
      agentNote: {
        kind: 'critique',
        source: 'critic',
        severity: 'warning',
        targetIds: ['hero-frame'],
        directionId: 'dir_hero'
      }
    })
    expect(summarizeAgentNotes(parsed!)).toEqual([
      {
        id: note.id,
        name: 'Critique note',
        kind: 'critique',
        body: 'Primary CTA is buried below the fold.',
        targetIds: ['hero-frame'],
        resolved: false,
        createdAt,
        directionId: 'dir_hero'
      }
    ])
  })
})
