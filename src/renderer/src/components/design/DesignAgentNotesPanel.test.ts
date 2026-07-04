import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAgentNoteShape } from '../../design/agent-notes/agent-note-shapes'
import { useCanvasSelectionStore } from '../../design/canvas/canvas-selection-store'
import { useCanvasShapeStore } from '../../design/canvas/canvas-shape-store'
import { createDefaultShape, createEmptyDocument } from '../../design/canvas/canvas-types'
import { DesignAgentNotesPanel } from './DesignAgentNotesPanel'

describe('DesignAgentNotesPanel', () => {
  beforeEach(() => {
    useCanvasSelectionStore.setState({
      selectedIds: new Set(),
      editingId: null,
      hoverTargetId: null,
      marqueeRect: null,
      activeSnapGuides: []
    })
  })

  it('renders repairable notes with their design tool action', () => {
    const doc = createEmptyDocument()
    const frame = createDefaultShape('frame', 0, 0)
    frame.name = 'Checkout frame'
    const note = createAgentNoteShape({
      kind: 'critique',
      body: 'CTA contrast is too low.',
      source: 'critic',
      severity: 'warning',
      targetIds: [frame.id]
    }, { x: 40, y: 60 })
    doc.objects[frame.id] = { ...frame, parentId: doc.rootId }
    doc.objects[note.id] = { ...note, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [frame.id, note.id] }

    const html = renderToStaticMarkup(createElement(DesignAgentNotesPanel, {
      canvasDocument: doc,
      onSeedPrompt: () => {}
    }))

    expect(html).toContain('Review notes')
    expect(html).toContain('CTA contrast is too low.')
    expect(html).toContain('design.repair')
    expect(html).toContain('aria-label="Repair this note"')
  })

  it('renders nothing when there are no agent notes', () => {
    useCanvasShapeStore.setState({ document: createEmptyDocument(), documentKey: null })

    expect(renderToStaticMarkup(createElement(DesignAgentNotesPanel, {}))).toBe('')
  })
})
