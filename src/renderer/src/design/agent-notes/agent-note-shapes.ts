import {
  createDefaultShape,
  type CanvasAgentNote,
  type CanvasAgentNoteKind,
  type CanvasDocument,
  type CanvasShape,
  type Rect
} from '../canvas/canvas-types'

export type CreateAgentNoteShapeOptions = {
  x: number
  y: number
  width?: number
  height?: number
  createdAt?: string
}

export type AgentNoteSummary = {
  id: string
  name: string
  kind: CanvasAgentNoteKind
  body: string
  targetIds: string[]
  resolved: boolean
  createdAt?: string
  directionId?: string
}

const NOTE_WIDTH = 280
const NOTE_HEIGHT = 96

const NOTE_LABELS: Record<CanvasAgentNoteKind, string> = {
  critique: 'Critique',
  decision: 'Decision',
  todo: 'TODO',
  question: 'Question',
  rationale: 'Rationale'
}

const NOTE_COLORS: Record<CanvasAgentNoteKind, string> = {
  critique: '#b45309',
  decision: '#166534',
  todo: '#1d4ed8',
  question: '#7c3aed',
  rationale: '#374151'
}

export function isAgentNoteShape(shape: CanvasShape | undefined): shape is CanvasShape & { agentNote: CanvasAgentNote } {
  return Boolean(shape?.agentNote?.kind && shape.agentNote.body.trim())
}

export function createAgentNoteShape(note: CanvasAgentNote, options: CreateAgentNoteShapeOptions): CanvasShape {
  const shape = createDefaultShape('text', options.x, options.y)
  const body = note.body.trim()
  const kind = note.kind
  shape.name = `${NOTE_LABELS[kind]} note`
  shape.width = options.width ?? NOTE_WIDTH
  shape.height = options.height ?? Math.max(NOTE_HEIGHT, Math.ceil(body.length / 36) * 24 + 40)
  shape.textContent = `${NOTE_LABELS[kind]}: ${body}`
  shape.fontSize = 14
  shape.fontWeight = kind === 'decision' ? 600 : 500
  shape.fontColor = NOTE_COLORS[kind]
  shape.agentNote = {
    ...note,
    body,
    ...(options.createdAt && !note.createdAt ? { createdAt: options.createdAt } : {})
  }
  return shape
}

export function agentNoteBounds(shape: CanvasShape): Rect {
  return { x: shape.x, y: shape.y, width: shape.width, height: shape.height }
}

export function listAgentNoteShapes(doc: CanvasDocument): Array<CanvasShape & { agentNote: CanvasAgentNote }> {
  return Object.values(doc.objects).filter(isAgentNoteShape)
}

export function summarizeAgentNotes(doc: CanvasDocument, limit = 8): AgentNoteSummary[] {
  return listAgentNoteShapes(doc)
    .map((shape) => ({
      id: shape.id,
      name: shape.name,
      kind: shape.agentNote.kind,
      body: shape.agentNote.body,
      targetIds: shape.agentNote.targetIds ?? [],
      resolved: shape.agentNote.resolved === true,
      ...(shape.agentNote.createdAt ? { createdAt: shape.agentNote.createdAt } : {}),
      ...(shape.agentNote.directionId ? { directionId: shape.agentNote.directionId } : {})
    }))
    .sort((a, b) => Number(a.resolved) - Number(b.resolved) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, Math.max(0, limit))
}
