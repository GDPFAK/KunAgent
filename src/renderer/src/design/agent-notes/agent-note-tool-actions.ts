import type { CanvasAgentNoteKind } from '../canvas/canvas-types'
import type { DesignIntentMode } from '../design-types'

export type AgentNoteToolAction = {
  id: 'repair-note' | 'review-note'
  labelKey: string
  intentMode: DesignIntentMode
  toolId: string
  toolInputSeed: Record<string, unknown>
  toolCallLine: string
  prompt: string
}

export type BuildAgentNoteToolActionInput = {
  id: string
  kind: CanvasAgentNoteKind
  body: string
  resolved: boolean
  targetIds: readonly string[]
  targetNames: readonly string[]
  directionId?: string
}

function targetLine(input: BuildAgentNoteToolActionInput): string {
  if (input.targetIds.length === 0) return 'Targets: this note and nearby relevant canvas objects.'
  return `Targets: ${input.targetNames.map((name, index) => `${name} (${input.targetIds[index]})`).join(', ')}.`
}

function toolCallLine(toolId: string, input: Record<string, unknown>): string {
  return `Suggested tool call: ${toolId} ${JSON.stringify(input)}`
}

function repairable(input: BuildAgentNoteToolActionInput): boolean {
  if (input.resolved) return false
  return input.kind === 'critique' || input.kind === 'todo' || input.kind === 'question'
}

export function buildAgentNoteToolAction(
  input: BuildAgentNoteToolActionInput
): AgentNoteToolAction {
  if (repairable(input)) {
    const toolInputSeed = {
      noteIds: [input.id],
      ...(input.targetIds.length > 0 ? { scopeIds: input.targetIds } : {}),
      ...(input.directionId ? { directionId: input.directionId } : {}),
      maxFindings: 8
    }
    const callLine = toolCallLine('design.repair', toolInputSeed)
    return {
      id: 'repair-note',
      labelKey: 'designAgentNotesRepair',
      intentMode: 'modify',
      toolId: 'design.repair',
      toolInputSeed,
      toolCallLine: callLine,
      prompt: [
        `Repair this ${input.kind} note on the design canvas.`,
        `Note id: ${input.id}.`,
        targetLine(input),
        `Finding: ${input.body}`,
        '',
        'Use structured design operations. Keep the note unresolved unless the visual issue is actually repaired.',
        callLine
      ].join('\n')
    }
  }

  const toolInputSeed = {
    noteIds: [input.id],
    ...(input.targetIds.length > 0 ? { scopeIds: input.targetIds } : {}),
    ...(input.directionId ? { directionId: input.directionId } : {}),
    attachNotes: true,
    maxFindings: 8
  }
  const callLine = toolCallLine('design.critique', toolInputSeed)
  return {
    id: 'review-note',
    labelKey: 'designAgentNotesReview',
    intentMode: 'modify',
    toolId: 'design.critique',
    toolInputSeed,
    toolCallLine: callLine,
    prompt: [
      `Review this ${input.kind} note on the design canvas.`,
      `Note id: ${input.id}.`,
      targetLine(input),
      `Note: ${input.body}`,
      '',
      'Validate whether this note is still true, attach follow-up findings if needed, and preserve accepted decisions.',
      callLine
    ].join('\n')
  }
}
