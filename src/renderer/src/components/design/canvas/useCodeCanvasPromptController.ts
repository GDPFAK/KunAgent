import { useTranslation } from 'react-i18next'
import type { RightPanelMode } from '../../chat/WorkbenchTopBar'
import {
  composerReasoningEffortRequestValue,
  type ComposerReasoningEffort
} from '../../chat/FloatingComposerModelPicker'
import type { SendMessageOverrides } from '../../../store/chat-store-types'
import { takeLastCanvasOpErrors } from '../../../design/canvas/apply-shape-ops'
import { useCanvasSelectionStore } from '../../../design/canvas/canvas-selection-store'
import { useCanvasShapeStore } from '../../../design/canvas/canvas-shape-store'
import { useCanvasViewportStore } from '../../../design/canvas/canvas-viewport-store'
import { buildCodeCanvasSendOverrides } from '../../../design/design-turn-dispatch'
import { useDesignWorkspaceStore } from '../../../design/design-workspace-store'
import { buildCodeCanvasOutboundText } from '../../../design/canvas/code-canvas-outbound'

export type CodeCanvasSendMessage = (
  text: string,
  mode?: string,
  overrides?: SendMessageOverrides
) => Promise<boolean>

export type CodeCanvasPromptControllerOptions = {
  rightPanelMode: RightPanelMode | null
  setRightPanelMode: (mode: RightPanelMode | null) => void
  activeCodeCanvasWorkspace: string
  activeThreadId: string | null
  composerReasoningEffort: ComposerReasoningEffort
  sendMessage: CodeCanvasSendMessage
  setError: (error: string | null) => void
}

export type CodeCanvasOutboundPromptInput = {
  baseText: string
  canvasBrief: string
}

export function useCodeCanvasPromptController({
  rightPanelMode,
  setRightPanelMode,
  activeCodeCanvasWorkspace,
  activeThreadId,
  composerReasoningEffort,
  sendMessage,
  setError
}: CodeCanvasPromptControllerOptions) {
  const { t } = useTranslation()

  async function buildCodeCanvasOutboundPrompt({
    baseText,
    canvasBrief
  }: CodeCanvasOutboundPromptInput): Promise<string> {
    if (rightPanelMode !== 'canvas') setRightPanelMode('canvas')
    return buildCodeCanvasOutboundText({
      baseText,
      canvasBrief,
      workspaceRoot: activeCodeCanvasWorkspace,
      threadId: activeThreadId,
      currentDocument: useCanvasShapeStore.getState().document,
      currentDocumentKey: useCanvasShapeStore.getState().documentKey,
      selectedIds: useCanvasSelectionStore.getState().selectedIds,
      viewBox: useCanvasViewportStore.getState().vbox,
      designContext: useDesignWorkspaceStore.getState().designContext,
      takeLastErrors: takeLastCanvasOpErrors
    })
  }

  async function sendCodeCanvasPrompt(
    value: string,
    options?: { displayText?: string }
  ): Promise<void> {
    const text = value.trim()
    if (!text) return
    if (!activeCodeCanvasWorkspace.trim()) {
      setError(t('workspaceRequiredToCreateThread'))
      return
    }
    const outboundText = await buildCodeCanvasOutboundPrompt({
      baseText: text,
      canvasBrief: text
    })
    const reasoningEffort = composerReasoningEffortRequestValue(composerReasoningEffort)
    await sendMessage(outboundText, 'agent', buildCodeCanvasSendOverrides({
      ...(options?.displayText ? { displayText: options.displayText } : {}),
      ...(reasoningEffort ? { reasoningEffort } : {})
    }))
  }

  return {
    buildCodeCanvasOutboundPrompt,
    sendCodeCanvasPrompt
  }
}
