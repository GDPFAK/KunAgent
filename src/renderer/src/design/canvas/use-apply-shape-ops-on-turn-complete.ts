import { useEffect, useRef } from 'react'
import { useChatStore } from '../../store/chat-store'
import { collectAssistantTextForTurn } from '../../store/chat-store-runtime-helpers'
import { applyShapeOpsFromText } from './apply-shape-ops'
import { useCanvasSelectionStore } from './canvas-selection-store'
import { useCanvasShapeStore } from './canvas-shape-store'
import { isHtmlFrame } from './canvas-types'
import { useDesignAssistantStore } from '../design-assistant-store'

/**
 * Apply any `design_canvas` / legacy ```shapeops``` blocks the chat agent
 * emitted once a turn fully completes. The `currentTurnId` non-null→null edge is the unambiguous
 * completion signal (set once per turn), so it sidesteps `busy` flicker.
 *
 * Used in both design mode (DesignCanvas canvas branch) and code mode
 * (CodeCanvasPanel) — wherever a CanvasViewport is rendered alongside a chat
 * thread that may emit canvas operations.
 */
export function useApplyShapeOpsOnTurnComplete(
  enabled: boolean,
  onScreenCreated?: (shapeId: string, userPrompt: string) => void
): void {
  const currentTurnId = useChatStore((s) => s.currentTurnId)
  const prevTurnIdRef = useRef(currentTurnId)
  const lastAppliedRef = useRef<string | null>(null)
  const onScreenCreatedRef = useRef(onScreenCreated)
  onScreenCreatedRef.current = onScreenCreated

  useEffect(() => {
    const prev = prevTurnIdRef.current
    prevTurnIdRef.current = currentTurnId
    if (!enabled) return
    if (!(prev && !currentTurnId)) return // only the completion edge

    const s = useChatStore.getState()
    let userId: string | null = null
    for (let i = s.blocks.length - 1; i >= 0; i -= 1) {
      if (s.blocks[i].kind === 'user') {
        userId = s.blocks[i].id
        break
      }
    }
    if (!userId || lastAppliedRef.current === userId) return

    const text = collectAssistantTextForTurn(s.blocks, userId, s.liveAssistant)
    const { affectedIds, batchCount } = applyShapeOpsFromText(text)
    if (batchCount > 0) {
      lastAppliedRef.current = userId
      if (affectedIds.length > 0) {
        useCanvasSelectionStore.getState().select(affectedIds)
        // Glow the touched shapes + pan/zoom to them if they landed off-screen,
        // so the edit is visible instead of happening somewhere out of view.
        useDesignAssistantStore.getState().markAiAffected(affectedIds)
      }

      if (onScreenCreatedRef.current) {
        const doc = useCanvasShapeStore.getState().document
        const userBlock = s.blocks.find((b) => b.id === userId)
        const userPrompt = userBlock?.kind === 'user' ? (userBlock.text ?? '') : ''
        for (const id of affectedIds) {
          const shape = doc.objects[id]
          if (shape && isHtmlFrame(shape)) {
            onScreenCreatedRef.current(id, userPrompt)
            break
          }
        }
      }
    }
  }, [currentTurnId, enabled])
}
