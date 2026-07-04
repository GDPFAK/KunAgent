import { useEffect, useRef } from 'react'
import type { ChatBlock, GeneratedFileReference, ToolBlock } from '../../agent/types'
import { useChatStore } from '../../store/chat-store'
import {
  collectAssistantTextForTurn,
  threadHasPendingRuntimeWork
} from '../../store/chat-store-runtime-helpers'
import {
  applyCanvasOpBlocks,
  applyCanvasOpsSince,
  extractCanvasOpBlocksFromValue,
  isDesignCanvasToolName,
  setLastCanvasOpErrors
} from './apply-shape-ops'
import { useCanvasSelectionStore } from './canvas-selection-store'
import { useCanvasShapeStore } from './canvas-shape-store'
import { takeScreenBrief } from './screen-artifact-bridge'
import type { ExecuteOpsOptions, OpError } from './shape-ops'
import { isHtmlFrame, type CanvasDocument } from './canvas-types'
import { useDesignAssistantStore } from '../design-assistant-store'
import { useDesignWorkspaceStore } from '../design-workspace-store'

/** Coalesce per-token `liveAssistant` deltas so we re-parse at most this often. */
const STREAM_THROTTLE_MS = 120

type ActiveCanvasTurnReplayState = {
  activeThreadId?: string | null
  currentTurnId: string | null
  currentTurnUserId?: string | null
  blocks: readonly ChatBlock[]
}

type GeneratedImageFallbackTarget = {
  id: string
  imageUrl: string
}

export type PendingScreenGeneration = {
  shapeId: string
  userPrompt: string
  brief?: string
}

const EXISTING_IMAGE_EDIT_PATTERN =
  /(?:按图片批注修改|修改|编辑|改成|改为|改一下|换成?|替换|重画|重绘|修复|调整|变成|去掉|去除|清除|换个颜色|change|edit|modify|replace|transform|restyle|redo|fix|recolor|remove|clean up)/i

export function activeCanvasTurnMatchesThread(
  state: Pick<ActiveCanvasTurnReplayState, 'activeThreadId'>,
  targetThreadId?: string | null
): boolean {
  return !targetThreadId || state.activeThreadId === targetThreadId
}

function blocksForActiveCanvasTurn(state: ActiveCanvasTurnReplayState): readonly ChatBlock[] {
  const startIndex = state.currentTurnUserId
    ? state.blocks.findIndex((block) => block.kind === 'user' && block.id === state.currentTurnUserId)
    : -1
  if (startIndex < 0) return state.blocks
  const endIndex = state.blocks.findIndex((block, index) => index > startIndex && block.kind === 'user')
  return state.blocks.slice(startIndex + 1, endIndex >= 0 ? endIndex : undefined)
}

function userTextForCanvasFallback(block: ChatBlock | null | undefined): string {
  if (!block || block.kind !== 'user') return ''
  const displayText = block.meta?.displayText
  return typeof displayText === 'string' && displayText.trim() ? displayText : block.text
}

function userBlockForActiveCanvasTurn(
  state: ActiveCanvasTurnReplayState
): Extract<ChatBlock, { kind: 'user' }> | null {
  if (state.currentTurnUserId) {
    const block = state.blocks.find((candidate) => candidate.kind === 'user' && candidate.id === state.currentTurnUserId)
    if (block?.kind === 'user') return block
  }
  for (let i = state.blocks.length - 1; i >= 0; i -= 1) {
    const block = state.blocks[i]
    if (block.kind === 'user') return block
  }
  return null
}

export function looksLikeExistingCanvasImageEditRequest(text: string): boolean {
  return EXISTING_IMAGE_EDIT_PATTERN.test(text)
}

export function resolveGeneratedImageFallbackTarget(options: {
  document: CanvasDocument
  selectedIds: ReadonlySet<string>
  userText: string
}): GeneratedImageFallbackTarget | null {
  if (!looksLikeExistingCanvasImageEditRequest(options.userText)) return null
  if (options.selectedIds.size !== 1) return null
  const [id] = [...options.selectedIds]
  if (!id) return null
  const shape = options.document.objects[id]
  if (shape?.type !== 'image' || !shape.imageUrl) return null
  return { id, imageUrl: shape.imageUrl }
}

function isGenerateImageToolName(value: unknown): boolean {
  return typeof value === 'string' && (value === 'generate_image' || value.endsWith('__generate_image'))
}

function generatedFileRelativePath(file: unknown): string {
  if (!file || typeof file !== 'object') return ''
  const candidate = file as GeneratedFileReference
  return typeof candidate.relativePath === 'string' && candidate.relativePath.trim()
    ? candidate.relativePath.trim()
    : ''
}

function generatedFileAbsolutePath(file: unknown): string {
  if (!file || typeof file !== 'object') return ''
  const candidate = file as GeneratedFileReference
  return typeof candidate.absolutePath === 'string' && candidate.absolutePath.trim()
    ? candidate.absolutePath.trim()
    : ''
}

function generatedFileImageUrl(file: unknown): string {
  return generatedFileAbsolutePath(file) || generatedFileRelativePath(file)
}

function latestGeneratedImageMarkdownPath(text: string): string | null {
  let latest: string | null = null
  const re = /!\[[^\]]*]\(([^)\s]+)\)/g
  for (const match of text.matchAll(re)) {
    const path = match[1]?.trim()
    if (path?.startsWith('.deepseekgui-images/')) latest = path
  }
  return latest
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function generatedImageUrlAliasesForTurn(blocks: readonly ChatBlock[]): Map<string, string> {
  const aliases = new Map<string, string>()
  for (const block of blocks) {
    if (block.kind !== 'tool' || block.status !== 'success') continue
    if (!isGenerateImageToolName(block.meta?.toolName)) continue
    const files = block.meta?.generatedFiles
    if (!Array.isArray(files)) continue
    for (const file of files) {
      const relativePath = generatedFileRelativePath(file)
      const imageUrl = generatedFileImageUrl(file)
      if (relativePath && imageUrl) aliases.set(relativePath, imageUrl)
    }
  }
  return aliases
}

export function rewriteGeneratedImageUrlsForTurn(value: unknown, blocks: readonly ChatBlock[]): unknown {
  const aliases = generatedImageUrlAliasesForTurn(blocks)
  if (aliases.size === 0) return value
  return rewriteGeneratedImageUrls(value, aliases)
}

function rewriteGeneratedImageUrls(value: unknown, aliases: ReadonlyMap<string, string>): unknown {
  if (Array.isArray(value)) return value.map((item) => rewriteGeneratedImageUrls(item, aliases))
  if (!isRecord(value)) return value
  let changed = false
  const next: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    const rewritten =
      key === 'imageUrl' && typeof entry === 'string'
        ? aliases.get(entry.trim()) ?? entry
        : rewriteGeneratedImageUrls(entry, aliases)
    if (rewritten !== entry) changed = true
    next[key] = rewritten
  }
  return changed ? next : value
}

export function latestGeneratedImageRelativePathForTurn(blocks: readonly ChatBlock[]): string | null {
  let latest: string | null = null
  for (const block of blocks) {
    if (block.kind === 'assistant') {
      latest = latestGeneratedImageMarkdownPath(block.text) ?? latest
      continue
    }
    if (block.kind !== 'tool' || block.status !== 'success') continue
    if (!isGenerateImageToolName(block.meta?.toolName)) continue
    const files = block.meta?.generatedFiles
    if (!Array.isArray(files)) continue
    for (const file of files) {
      const relativePath = generatedFileRelativePath(file)
      if (relativePath) latest = relativePath
    }
  }
  return latest
}

export function latestGeneratedImageUrlForTurn(blocks: readonly ChatBlock[]): string | null {
  let latest: string | null = null
  for (const block of blocks) {
    if (block.kind === 'assistant') {
      latest = latestGeneratedImageMarkdownPath(block.text) ?? latest
      continue
    }
    if (block.kind !== 'tool' || block.status !== 'success') continue
    if (!isGenerateImageToolName(block.meta?.toolName)) continue
    const files = block.meta?.generatedFiles
    if (!Array.isArray(files)) continue
    for (const file of files) {
      const imageUrl = generatedFileImageUrl(file)
      if (imageUrl) latest = imageUrl
    }
  }
  return latest
}

export function replayActiveCanvasTurn(
  state: ActiveCanvasTurnReplayState,
  applyToolBlock: (block: ToolBlock) => void,
  processStreaming: () => void,
  targetThreadId?: string | null
): void {
  if (!activeCanvasTurnMatchesThread(state, targetThreadId)) return
  if (!state.currentTurnId) return
  for (const block of blocksForActiveCanvasTurn(state)) {
    if (block.kind === 'tool') applyToolBlock(block)
  }
  processStreaming()
}

export function shouldApplyDesignCanvasToolBlock(block: ToolBlock): boolean {
  if (!isDesignCanvasToolName(block.meta?.toolName)) return false
  if (block.status !== 'success') return false
  const sourceItemKind = block.meta?.sourceItemKind
  return sourceItemKind === undefined || sourceItemKind === 'tool_result'
}

export function canvasReplayStateForStoreUpdate(
  state: ActiveCanvasTurnReplayState,
  prev?: Pick<ActiveCanvasTurnReplayState, 'currentTurnId' | 'currentTurnUserId'>
): ActiveCanvasTurnReplayState {
  return {
    ...state,
    currentTurnId: state.currentTurnId ?? prev?.currentTurnId ?? null,
    currentTurnUserId: state.currentTurnUserId ?? prev?.currentTurnUserId ?? null
  }
}

export function takeNextReadyScreenGeneration({
  pendingScreens,
  document,
  currentTurnId,
  busy = false,
  pendingRuntimeWork = false,
  htmlArtifactIds
}: {
  pendingScreens: PendingScreenGeneration[]
  document: CanvasDocument
  currentTurnId: string | null
  busy?: boolean
  pendingRuntimeWork?: boolean
  htmlArtifactIds?: ReadonlySet<string>
}): PendingScreenGeneration | null {
  if (currentTurnId || busy || pendingRuntimeWork) return null
  while (pendingScreens.length > 0) {
    const next = pendingScreens.shift()
    if (!next) continue
    const shape = document.objects[next.shapeId]
    if (!shape || !isHtmlFrame(shape) || !shape.htmlArtifactId) continue
    if (htmlArtifactIds && !htmlArtifactIds.has(shape.htmlArtifactId)) continue
    return next
  }
  return null
}

/**
 * Apply the `design_canvas` / legacy ```shapeops``` blocks the chat agent emits
 * — IN REAL TIME, as they stream — so the design draft builds up live on the
 * canvas instead of appearing all at once when the turn ends.
 *
 * Each completed fenced block is executed the moment its closing ``` arrives in
 * `liveAssistant`; a per-turn cursor (`appliedCount`) guarantees every block runs
 * exactly once across the streaming passes and the final turn-complete flush.
 * Because the agent is encouraged to emit many small batches (one per logical
 * group — a frame, then its children, then the next section), the user watches
 * the layout materialize piece by piece, and add_screen frames pop in instantly
 * while their HTML generation is kicked off at turn end.
 *
 * Used in both design mode (DesignCanvas) and code mode (CodeCanvasPanel) —
 * wherever a CanvasViewport is rendered alongside a chat thread that may emit
 * canvas operations.
 */
export function useApplyShapeOpsLive(
  enabled: boolean,
  onScreenCreated?: (shapeId: string, userPrompt: string, brief?: string) => void,
  executeOptions?: ExecuteOpsOptions,
  errorKey?: string,
  targetThreadId?: string | null
): void {
  const onScreenCreatedRef = useRef(onScreenCreated)
  onScreenCreatedRef.current = onScreenCreated

  useEffect(() => {
    if (!enabled) return

    // Per-turn streaming state. Lives in the subscription closure so it survives
    // across deltas without triggering React re-renders on every token.
    let appliedCount = 0
    const affectedThisTurn = new Set<string>()
    const errorsThisTurn: OpError[] = []
    let framedThisTurn = false
    let lastRunAt = 0
    let trailingTimer: ReturnType<typeof setTimeout> | null = null
    let screenDrainTimer: ReturnType<typeof setTimeout> | null = null
    const appliedToolBlockIds = new Set<string>()
    let generatedImageFallbackTarget: GeneratedImageFallbackTarget | null = null

    // Screens the agent creates via add_screen still need their HTML generated in
    // a follow-up turn. Several can be created in ONE turn, but those follow-up
    // turns must run one at a time on the shared chat thread — so queue them and
    // drain one per turn-completion. `screenGenSeen` guards against ever
    // re-enqueuing (hence regenerating) a frame across the run's lifetime.
    const pendingScreens: PendingScreenGeneration[] = []
    const screenGenSeen = new Set<string>()

    const resetTurn = (): void => {
      appliedCount = 0
      affectedThisTurn.clear()
      errorsThisTurn.length = 0
      framedThisTurn = false
      generatedImageFallbackTarget = null
    }

    const captureGeneratedImageFallbackTarget = (state: ActiveCanvasTurnReplayState): void => {
      const userBlock = userBlockForActiveCanvasTurn(state)
      generatedImageFallbackTarget = resolveGeneratedImageFallbackTarget({
        document: useCanvasShapeStore.getState().document,
        selectedIds: useCanvasSelectionStore.getState().selectedIds,
        userText: userTextForCanvasFallback(userBlock)
      })
    }

    // The in-progress (or just-completed) turn's full assistant text. Using the
    // ASSEMBLED text — not raw `liveAssistant` — keeps the block cursor stable
    // even when a mid-turn tool call (e.g. generate_image) flushes a segment to a
    // block and resets `liveAssistant`; otherwise post-tool-call canvas ops would
    // never stream and the cursor would drift from the turn-complete flush.
    const assembledTurnText = (): string => {
      const s = useChatStore.getState()
      let userId: string | null = null
      for (let i = s.blocks.length - 1; i >= 0; i -= 1) {
        if (s.blocks[i].kind === 'user') {
          userId = s.blocks[i].id
          break
        }
      }
      return userId ? collectAssistantTextForTurn(s.blocks, userId, s.liveAssistant) : s.liveAssistant
    }

    // Apply every not-yet-applied complete block in `text`, advancing the cursor.
    // `frameOnFirst` gently brings the build area into view exactly once per turn
    // (the first batch), then leaves the camera alone so the live build is smooth.
    const applyFrom = (text: string, frameOnFirst: boolean): void => {
      const { affectedIds, errors, totalBlocks } = applyCanvasOpsSince(text, appliedCount, executeOptions)
      if (totalBlocks <= appliedCount) return
      appliedCount = totalBlocks
      // Capture errors even when nothing applied — an all-failed block has errors
      // but no affected ids, and that's exactly what the agent must learn about.
      if (errors.length > 0) errorsThisTurn.push(...errors)
      if (affectedIds.length === 0) return
      for (const id of affectedIds) affectedThisTurn.add(id)
      useCanvasSelectionStore.getState().select([...affectedThisTurn])
      if (frameOnFirst && !framedThisTurn) {
        framedThisTurn = true
        // markAiAffected = glow + camera focus; do it once at the start so the
        // build area is in view, then stay put for the rest of the stream.
        useDesignAssistantStore.getState().markAiAffected(affectedIds)
      } else {
        // Glow the freshly-touched shapes without yanking the camera mid-build.
        useDesignAssistantStore.setState({
          lastAiAffectedIds: affectedIds,
          lastAiActionAt: Date.now()
        })
      }
    }

    const processStreaming = (): void => {
      lastRunAt = Date.now()
      if (!useChatStore.getState().currentTurnId) return
      applyFrom(assembledTurnText(), true)
    }

    const applyToolBlock = (block: ToolBlock): void => {
      if (appliedToolBlockIds.has(block.id)) return
      if (!shouldApplyDesignCanvasToolBlock(block)) return
      const detail = block.detail?.trim()
      if (!detail) return
      let parsed: unknown
      try {
        parsed = JSON.parse(detail)
      } catch {
        return
      }
      const chatState = useChatStore.getState()
      parsed = rewriteGeneratedImageUrlsForTurn(
        parsed,
        blocksForActiveCanvasTurn({
          activeThreadId: chatState.activeThreadId,
          currentTurnId: chatState.currentTurnId,
          currentTurnUserId: chatState.currentTurnUserId,
          blocks: chatState.blocks
        })
      )
      const blocks = extractCanvasOpBlocksFromValue(parsed)
      if (blocks.length === 0) {
        return
      }
      const { affectedIds, errors } = applyCanvasOpBlocks(blocks, `tool:${block.id}`, executeOptions)
      appliedToolBlockIds.add(block.id)
      if (errors.length > 0) errorsThisTurn.push(...errors)
      if (affectedIds.length === 0) return
      for (const id of affectedIds) affectedThisTurn.add(id)
      useCanvasSelectionStore.getState().select([...affectedThisTurn])
      if (!framedThisTurn) {
        framedThisTurn = true
        useDesignAssistantStore.getState().markAiAffected(affectedIds)
      } else {
        useDesignAssistantStore.setState({
          lastAiAffectedIds: affectedIds,
          lastAiActionAt: Date.now()
        })
      }
    }

    const scheduleStreaming = (): void => {
      const elapsed = Date.now() - lastRunAt
      if (elapsed >= STREAM_THROTTLE_MS) {
        processStreaming()
      } else if (!trailingTimer) {
        trailingTimer = setTimeout(() => {
          trailingTimer = null
          processStreaming()
        }, STREAM_THROTTLE_MS - elapsed)
      }
    }

    function scheduleScreenDrain(delay = 160): void {
      if (screenDrainTimer) return
      screenDrainTimer = setTimeout(() => {
        screenDrainTimer = null
        drainPendingScreens()
      }, delay)
    }

    // Kick off the next queued screen's HTML generation — but only while the
    // thread is fully idle, so the per-screen turns run strictly one at a time.
    // Turn completion and busy/currentTurnId clearing can land in separate store
    // ticks, so this function re-schedules itself instead of consuming too early.
    function drainPendingScreens(): void {
      if (pendingScreens.length === 0) return
      const chatState = useChatStore.getState()
      const pendingRuntimeWork = threadHasPendingRuntimeWork(chatState.blocks)
      const next = takeNextReadyScreenGeneration({
        pendingScreens,
        document: useCanvasShapeStore.getState().document,
        currentTurnId: chatState.currentTurnId,
        busy: chatState.busy,
        pendingRuntimeWork,
        htmlArtifactIds: new Set(
          useDesignWorkspaceStore.getState().artifacts
            .filter((artifact) => artifact.kind === 'html')
            .map((artifact) => artifact.id)
        )
      })
      if (!next) {
        if (pendingScreens.length > 0 && (chatState.currentTurnId || chatState.busy || pendingRuntimeWork)) {
          scheduleScreenDrain()
        }
        return
      }
      useCanvasSelectionStore.getState().select([next.shapeId])
      onScreenCreatedRef.current?.(next.shapeId, next.userPrompt, next.brief)
    }

    // Final pass once the turn completes: apply any block that finished exactly at
    // the end, then do a single camera fit + kick off screen-HTML generation.
    const finalizeTurn = (): void => {
      if (trailingTimer) {
        clearTimeout(trailingTimer)
        trailingTimer = null
      }
      const s = useChatStore.getState()
      let userId: string | null = null
      for (let i = s.blocks.length - 1; i >= 0; i -= 1) {
        if (s.blocks[i].kind === 'user') {
          userId = s.blocks[i].id
          break
        }
      }
      if (userId) {
        const text = collectAssistantTextForTurn(s.blocks, userId, s.liveAssistant)
        applyFrom(text, false)
      }
      if (!generatedImageFallbackTarget && userId) {
        captureGeneratedImageFallbackTarget({
          activeThreadId: s.activeThreadId,
          currentTurnId: s.currentTurnId,
          currentTurnUserId: userId,
          blocks: s.blocks
        })
      }
      const turnBlocks = userId
        ? blocksForActiveCanvasTurn({
            activeThreadId: s.activeThreadId,
            currentTurnId: s.currentTurnId,
            currentTurnUserId: userId,
            blocks: s.blocks
          })
        : []
      const generatedImagePath =
        affectedThisTurn.size === 0
          ? latestGeneratedImageUrlForTurn(turnBlocks)
          : null
      if (generatedImageFallbackTarget && generatedImagePath) {
        const shape = useCanvasShapeStore.getState().document.objects[generatedImageFallbackTarget.id]
        if (
          shape?.type === 'image' &&
          shape.imageUrl === generatedImageFallbackTarget.imageUrl &&
          shape.imageUrl !== generatedImagePath
        ) {
          useCanvasShapeStore.getState().updateShape(generatedImageFallbackTarget.id, {
            imageUrl: generatedImagePath
          })
          affectedThisTurn.add(generatedImageFallbackTarget.id)
          errorsThisTurn.length = 0
        }
      }
      const all = [...affectedThisTurn]
      if (all.length > 0) {
        useCanvasSelectionStore.getState().select(all)
        useDesignAssistantStore.getState().markAiAffected(all)
        if (onScreenCreatedRef.current) {
          const doc = useCanvasShapeStore.getState().document
          const userBlock = userId ? s.blocks.find((b) => b.id === userId) : null
          const userPrompt = userBlock?.kind === 'user' ? (userBlock.text ?? '') : ''
          // Queue EVERY newly created screen frame (not just the first) so a turn
          // that adds several screens generates HTML for all of them — the drain
          // below runs them sequentially.
          for (const id of all) {
            const shape = doc.objects[id]
            if (shape && isHtmlFrame(shape) && !screenGenSeen.has(id)) {
              screenGenSeen.add(id)
              const brief = takeScreenBrief(id)
              pendingScreens.push({ shapeId: id, userPrompt, ...(brief ? { brief } : {}) })
            }
          }
        }
      }
      // Hand this turn's op errors to the next canvas turn so the agent can fix
      // them. Always set (even []) so a clean turn clears stale errors.
      setLastCanvasOpErrors([...errorsThisTurn], errorKey)
      resetTurn()
      // Let chat/runtime state settle before starting the follow-up HTML turn.
      scheduleScreenDrain(120)
    }

    // If this hook becomes enabled after a turn has already started (common for
    // the first Code-canvas send, where the thread id appears after sendMessage),
    // catch up with already-present tool blocks/live text before waiting for the
    // next store change.
    const initialState = useChatStore.getState()
    if (initialState.currentTurnId) captureGeneratedImageFallbackTarget(initialState)
    replayActiveCanvasTurn(initialState, applyToolBlock, processStreaming, targetThreadId)

    const unsubscribe = useChatStore.subscribe((state, prev) => {
      if (!activeCanvasTurnMatchesThread(state, targetThreadId)) return
      const turnStarted = !prev.currentTurnId && Boolean(state.currentTurnId)
      const turnEnded = Boolean(prev.currentTurnId) && !state.currentTurnId
      if (turnStarted) {
        resetTurn()
        captureGeneratedImageFallbackTarget(state)
      }
      const replayState = canvasReplayStateForStoreUpdate(state, prev)
      if (replayState.currentTurnId && state.blocks !== prev.blocks) {
        for (const block of blocksForActiveCanvasTurn(replayState)) {
          if (block.kind === 'tool') applyToolBlock(block)
        }
      }
      if (state.currentTurnId && state.liveAssistant !== prev.liveAssistant) {
        scheduleStreaming()
      }
      if (turnEnded) finalizeTurn()
      if (
        !state.currentTurnId &&
        !state.busy &&
        !threadHasPendingRuntimeWork(state.blocks) &&
        pendingScreens.length > 0
      ) {
        scheduleScreenDrain(0)
      }
    })

    return () => {
      if (trailingTimer) clearTimeout(trailingTimer)
      if (screenDrainTimer) clearTimeout(screenDrainTimer)
      unsubscribe()
    }
  }, [enabled, executeOptions, errorKey, targetThreadId])
}
