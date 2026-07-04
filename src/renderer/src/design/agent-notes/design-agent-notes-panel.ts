import type { CanvasAgentNoteKind, CanvasDocument, CanvasShape } from '../canvas/canvas-types'
import { listAgentNoteShapes } from './agent-note-shapes'
import {
  buildAgentNoteToolAction,
  type AgentNoteToolAction
} from './agent-note-tool-actions'

export type DesignAgentNotePanelItem = {
  id: string
  name: string
  kind: CanvasAgentNoteKind
  body: string
  resolved: boolean
  severity?: 'info' | 'warning' | 'error'
  source?: string
  directionId?: string
  targetIds: string[]
  targetNames: string[]
  active: boolean
  toolAction: AgentNoteToolAction
  repairPrompt: string
}

export type DesignAgentNotesPanelModel = {
  items: DesignAgentNotePanelItem[]
  totalCount: number
  unresolvedCount: number
  selectedCount: number
  countsByKind: Record<CanvasAgentNoteKind, number>
}

type BuildDesignAgentNotesPanelModelInput = {
  doc: CanvasDocument
  selectedIds?: ReadonlySet<string>
  limit?: number
}

const EMPTY_COUNTS: Record<CanvasAgentNoteKind, number> = {
  critique: 0,
  decision: 0,
  todo: 0,
  question: 0,
  rationale: 0
}

const KIND_PRIORITY: Record<CanvasAgentNoteKind, number> = {
  critique: 0,
  todo: 1,
  question: 2,
  decision: 3,
  rationale: 4
}

function targetNames(doc: CanvasDocument, targetIds: readonly string[]): string[] {
  return targetIds
    .map((id) => doc.objects[id]?.name ?? id)
    .filter(Boolean)
    .slice(0, 4)
}

function selectedHits(shape: CanvasShape, selectedIds: ReadonlySet<string> | undefined): boolean {
  if (!selectedIds || selectedIds.size === 0) return false
  if (selectedIds.has(shape.id)) return true
  return (shape.agentNote?.targetIds ?? []).some((id) => selectedIds.has(id))
}

function noteSort(a: DesignAgentNotePanelItem, b: DesignAgentNotePanelItem): number {
  return (
    Number(a.resolved) - Number(b.resolved) ||
    Number(b.active) - Number(a.active) ||
    KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind] ||
    a.name.localeCompare(b.name)
  )
}

export function buildDesignAgentNotesPanelModel({
  doc,
  selectedIds,
  limit = 8
}: BuildDesignAgentNotesPanelModelInput): DesignAgentNotesPanelModel {
  const countsByKind = { ...EMPTY_COUNTS }
  const shapes = listAgentNoteShapes(doc)
  const items = shapes.map((shape) => {
    const targetIds = shape.agentNote.targetIds ?? []
    const names = targetNames(doc, targetIds)
    const item = {
      id: shape.id,
      name: shape.name,
      kind: shape.agentNote.kind,
      body: shape.agentNote.body,
      resolved: shape.agentNote.resolved === true,
      ...(shape.agentNote.severity ? { severity: shape.agentNote.severity } : {}),
      ...(shape.agentNote.source ? { source: shape.agentNote.source } : {}),
      ...(shape.agentNote.directionId ? { directionId: shape.agentNote.directionId } : {}),
      targetIds,
      targetNames: names,
      active: selectedHits(shape, selectedIds),
      toolAction: buildAgentNoteToolAction({
        id: shape.id,
        kind: shape.agentNote.kind,
        body: shape.agentNote.body,
        resolved: shape.agentNote.resolved === true,
        targetIds,
        targetNames: names,
        ...(shape.agentNote.directionId ? { directionId: shape.agentNote.directionId } : {})
      }),
      repairPrompt: ''
    }
    countsByKind[item.kind] += 1
    return {
      ...item,
      repairPrompt: item.toolAction.prompt
    }
  })
  const selectedCount = items.filter((item) => item.active).length
  return {
    items: items.sort(noteSort).slice(0, Math.max(0, limit)),
    totalCount: shapes.length,
    unresolvedCount: items.filter((item) => !item.resolved).length,
    selectedCount,
    countsByKind
  }
}
