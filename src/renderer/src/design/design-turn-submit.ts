import type { AttachmentReference } from '../agent/types'
import type { SendMessageOverrides } from '../store/chat-store-types'
import { canvasOpErrorKey, takeLastCanvasOpErrors } from './canvas/apply-shape-ops'
import { useCanvasSelectionStore } from './canvas/canvas-selection-store'
import { useCanvasShapeStore } from './canvas/canvas-shape-store'
import { useCanvasViewportStore } from './canvas/canvas-viewport-store'
import { useDesignSystemStore } from './canvas/design-system-store'
import {
  ensureDesignBoardArtifact,
  findDesignBoardArtifact
} from './design-board'
import type { DesignHtmlElementContext } from './design-composer-context'
import type { DesignPromptSource } from './design-quality-repair-dispatch'
import {
  buildDesignTurnSendOverrides,
  type DesignTurnPromptState
} from './design-turn-dispatch'
import {
  buildDesignTurnPromptPayload,
  type BuildDesignTurnPromptPayloadOptions,
  type DesignTurnPromptPayload
} from './design-turn-prompt/payload'
import {
  prepareDesignTurnFiles,
  type PrepareDesignTurnFilesOptions,
  type PrepareDesignTurnFilesResult
} from './design-turn-prompt/setup'
import {
  resolveDesignTurnTarget,
  type ResolvedDesignTurnTarget
} from './design-turn-prompt/target'
import { useDesignTokensStore } from './design-tokens-store'
import { useDesignWorkspaceStore } from './design-workspace-store'
import type { DesignWorkspaceState } from './design-workspace-store-types'

export type DesignTurnSubmitSendMessage = (
  text: string,
  mode?: string,
  overrides?: SendMessageOverrides
) => Promise<boolean>

export type SubmitDesignTurnResult =
  | { status: 'sent'; target: ResolvedDesignTurnTarget['target']; clearAttachments: boolean }
  | { status: 'send-failed'; target: ResolvedDesignTurnTarget['target'] }
  | { status: 'missing-board' }
  | { status: 'file-error'; message: string }

type StoreGetter<T> = () => T

export type SubmitDesignTurnDeps = {
  getDesignState?: StoreGetter<DesignWorkspaceState>
  getCanvasShapeState?: typeof useCanvasShapeStore.getState
  getCanvasSelectionState?: typeof useCanvasSelectionStore.getState
  getCanvasViewportState?: typeof useCanvasViewportStore.getState
  getDesignSystemState?: typeof useDesignSystemStore.getState
  getDesignTokensState?: typeof useDesignTokensStore.getState
  ensureBoardArtifact?: typeof ensureDesignBoardArtifact
  resolveTarget?: typeof resolveDesignTurnTarget
  prepareTurnFiles?: (options: PrepareDesignTurnFilesOptions) => Promise<PrepareDesignTurnFilesResult>
  buildPromptPayload?: (options: BuildDesignTurnPromptPayloadOptions) => Promise<DesignTurnPromptPayload>
  takeLastCanvasErrors?: typeof takeLastCanvasOpErrors
}

export type SubmitDesignTurnOptions = SubmitDesignTurnDeps & {
  promptText: string
  displayText: string
  workspaceRoot: string
  source: DesignPromptSource
  sendMessage: DesignTurnSubmitSendMessage
  resolveProviderId: (model: string) => string
  reasoningEffort?: string
  attachmentIds?: string[]
  attachments?: AttachmentReference[]
  suppressedIds?: ReadonlySet<string>
  htmlElementContext?: DesignHtmlElementContext | null
  explicitScreenShapeId?: string | null
  clearAutoRepairScope?: (scopeKey: string) => void
}

export async function submitDesignTurn(
  options: SubmitDesignTurnOptions
): Promise<SubmitDesignTurnResult> {
  const getDesignState = options.getDesignState ?? useDesignWorkspaceStore.getState
  const getCanvasShapeState = options.getCanvasShapeState ?? useCanvasShapeStore.getState
  const getCanvasSelectionState = options.getCanvasSelectionState ?? useCanvasSelectionStore.getState
  const getCanvasViewportState = options.getCanvasViewportState ?? useCanvasViewportStore.getState
  const getDesignSystemState = options.getDesignSystemState ?? useDesignSystemStore.getState
  const getDesignTokensState = options.getDesignTokensState ?? useDesignTokensStore.getState
  const ensureBoard = options.ensureBoardArtifact ?? ensureDesignBoardArtifact
  const resolveTarget = options.resolveTarget ?? resolveDesignTurnTarget
  const prepareTurn = options.prepareTurnFiles ?? prepareDesignTurnFiles
  const buildPayload = options.buildPromptPayload ?? buildDesignTurnPromptPayload
  const takeCanvasErrors = options.takeLastCanvasErrors ?? takeLastCanvasOpErrors

  const latestDesignState = getDesignState()
  let boardArtifact = findDesignBoardArtifact(latestDesignState.artifacts)
  if (!boardArtifact) {
    boardArtifact = await ensureBoard(options.workspaceRoot)
  }
  if (!boardArtifact) return { status: 'missing-board' }
  if (latestDesignState.activeArtifactId !== boardArtifact.id) {
    getDesignState().setActiveArtifact(boardArtifact.id)
  }

  const canvasDoc = getCanvasShapeState().document
  const selectedShapeIds = getCanvasSelectionState().selectedIds
  const resolvedTarget = resolveTarget({
    promptText: options.promptText,
    workspaceState: latestDesignState,
    boardArtifact,
    canvasDocument: canvasDoc,
    selectedShapeIds,
    suppressedIds: options.suppressedIds,
    htmlElementContext: options.htmlElementContext,
    explicitScreenShapeId: options.explicitScreenShapeId,
    viewBox: getCanvasViewportState().vbox
  })
  if (resolvedTarget.nextIntentMode) {
    getDesignState().setDesignIntentMode(resolvedTarget.nextIntentMode)
  }
  if (options.source === 'user') {
    options.clearAutoRepairScope?.(resolvedTarget.targetAutoRepairKey)
  }
  getDesignState().setActiveArtifact(boardArtifact.id)

  const turnFiles = await prepareTurn({
    workspaceRoot: options.workspaceRoot,
    promptText: options.promptText,
    resolvedTarget,
    artifacts: getDesignState().artifacts,
    designContext: latestDesignState.designContext
  })
  if (!turnFiles.ok) {
    getDesignState().setFileError(turnFiles.message)
    return { status: 'file-error', message: turnFiles.message }
  }

  const promptState = getDesignState()
  const canvasErrorKey = canvasOpErrorKey(options.workspaceRoot, promptState.activeDocumentId, boardArtifact.id)
  const promptPayload = await buildPayload({
    target: resolvedTarget.target,
    mode: (options.attachmentIds?.length ?? 0) > 0 ? 'image' : 'text',
    promptText: options.promptText,
    artifactRelativePath: resolvedTarget.artifactRelativePath,
    workspaceRoot: options.workspaceRoot,
    promptState,
    boardArtifact,
    visibleTargets: resolvedTarget.visibleTargets,
    canvasDocument: getCanvasShapeState().document,
    designSystem: getDesignSystemState().system,
    tokensByArtifact: getDesignTokensState().byArtifact,
    ...(resolvedTarget.designNotesPath ? { designNotesPath: resolvedTarget.designNotesPath } : {}),
    ...(resolvedTarget.basePath ? { basePath: resolvedTarget.basePath } : {}),
    ...(resolvedTarget.htmlArtifactId ? { htmlArtifactId: resolvedTarget.htmlArtifactId } : {}),
    ...(resolvedTarget.htmlElementContext ? { htmlElementContext: resolvedTarget.htmlElementContext } : {}),
    ...(resolvedTarget.canvasSnapshot ? { canvasSnapshot: resolvedTarget.canvasSnapshot } : {}),
    ...(resolvedTarget.htmlFrameContext ? { frameContext: resolvedTarget.htmlFrameContext } : {}),
    ...(resolvedTarget.selectedFrame ? { selectedFrame: resolvedTarget.selectedFrame } : {}),
    ...(resolvedTarget.target === 'canvas' ? { previousOpErrors: takeCanvasErrors(canvasErrorKey) } : {})
  })
  const sent = await options.sendMessage(
    promptPayload.prompt,
    'agent',
    buildDesignTurnSendOverrides({
      displayText: options.displayText,
      promptState: promptState as DesignTurnPromptState,
      resolveProviderId: options.resolveProviderId,
      ...(options.reasoningEffort ? { reasoningEffort: options.reasoningEffort } : {}),
      target: resolvedTarget.target,
      attachmentIds: options.attachmentIds ?? [],
      attachments: options.attachments ?? []
    })
  )
  return sent
    ? {
        status: 'sent',
        target: resolvedTarget.target,
        clearAttachments: (options.attachmentIds?.length ?? 0) > 0
      }
    : { status: 'send-failed', target: resolvedTarget.target }
}
