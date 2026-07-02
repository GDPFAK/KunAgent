import { create } from 'zustand'
import { getProvider } from '../agent/registry'
import { rendererRuntimeClient } from '../agent/runtime-client'
import { executeOps, type OpError } from './canvas/shape-ops'
import { useCanvasShapeStore } from './canvas/canvas-shape-store'
import { useCanvasViewportStore } from './canvas/canvas-viewport-store'
import { shapeGeometry } from './canvas/canvas-types'

export type DesignMessageBlock =
  | { kind: 'user'; id: string; text: string; createdAt: string }
  | { kind: 'assistant'; id: string; text: string; createdAt: string }

export type DesignTarget =
  | { type: 'new' }
  | { type: 'html'; artifactId: string; title: string }
  | { type: 'canvas'; artifactId: string }

type DesignAssistantState = {
  designThreadId: string | null
  designBlocks: DesignMessageBlock[]
  designInput: string
  designBusy: boolean
  designTarget: DesignTarget
  /** IDs the most-recent AI message touched. SelectionOverlay glows these for ~800ms. */
  lastAiAffectedIds: string[]
  /** Timestamp (ms since epoch) when the glow should start. null = no glow. */
  lastAiActionAt: number | null

  setDesignInput: (text: string) => void
  setDesignTarget: (target: DesignTarget) => void
  clearDesignConversation: () => void
  ensureDesignThread: (workspaceRoot: string) => Promise<string>
  sendDesignMessage: (text: string, prompt: string, workspaceRoot: string) => Promise<void>
  appendBlock: (block: DesignMessageBlock) => void
  /** Parse an assistant message for ```shapeops``` JSON blocks and execute them. */
  applyAiShapeOps: (text: string) => { affectedIds: string[]; errors: OpError[] }
}

const DESIGN_THREAD_KEY = 'kun.design-assistant.threadRegistry.v1'

function readDesignAssistantThreadId(workspaceRoot: string): string | null {
  try {
    const raw = localStorage.getItem(DESIGN_THREAD_KEY)
    if (!raw) return null
    const map = JSON.parse(raw) as Record<string, string>
    return map[workspaceRoot] ?? null
  } catch {
    return null
  }
}

function writeDesignAssistantThreadId(workspaceRoot: string, threadId: string): void {
  try {
    const raw = localStorage.getItem(DESIGN_THREAD_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    map[workspaceRoot] = threadId
    localStorage.setItem(DESIGN_THREAD_KEY, JSON.stringify(map))
  } catch {
    // non-fatal
  }
}

let nextBlockId = 0
function makeBlockId(): string {
  return `design-block-${++nextBlockId}`
}

/**
 * Extract every `shapeops` fenced code block from a markdown-ish string.
 * Tolerates leading/trailing whitespace inside the fence and json/array shapes.
 */
function extractShapeOpsBlocks(text: string): unknown[][] {
  const out: unknown[][] = []
  const re = /```shapeops\s*([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const raw = m[1].trim()
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) out.push(parsed)
      else out.push([parsed])
    } catch {
      // ignore malformed JSON — executor will report via Zod when called with garbage
    }
  }
  return out
}

function focusViewportOnIds(ids: string[]): void {
  if (ids.length === 0) return
  const doc = useCanvasShapeStore.getState().document
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  let found = false
  for (const id of ids) {
    const s = doc.objects[id]
    if (!s) continue
    found = true
    const sel = shapeGeometry(s).selrect
    if (sel.x < minX) minX = sel.x
    if (sel.y < minY) minY = sel.y
    if (sel.x + sel.width > maxX) maxX = sel.x + sel.width
    if (sel.y + sel.height > maxY) maxY = sel.y + sel.height
  }
  if (!found) return
  const bounds = { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }
  const vp = useCanvasViewportStore.getState()
  // If bounds are outside the current viewport, pan/zoom to fit.
  const v = vp.vbox
  const inside =
    bounds.x >= v.x &&
    bounds.y >= v.y &&
    bounds.x + bounds.width <= v.x + v.width &&
    bounds.y + bounds.height <= v.y + v.height
  if (!inside) {
    vp.zoomToFit(bounds, 80)
  }
}

export const useDesignAssistantStore = create<DesignAssistantState>((set, get) => ({
  designThreadId: null,
  designBlocks: [],
  designInput: '',
  designBusy: false,
  designTarget: { type: 'new' },
  lastAiAffectedIds: [],
  lastAiActionAt: null,

  setDesignInput: (text) => set({ designInput: text }),
  setDesignTarget: (target) => set({ designTarget: target }),

  clearDesignConversation: () =>
    set({
      designBlocks: [],
      designThreadId: null,
      designBusy: false,
      lastAiAffectedIds: [],
      lastAiActionAt: null
    }),

  appendBlock: (block) =>
    set((s) => ({ designBlocks: [...s.designBlocks, block] })),

  applyAiShapeOps: (text) => {
    const blocks = extractShapeOpsBlocks(text)
    if (blocks.length === 0) return { affectedIds: [], errors: [] }

    const allAffected: string[] = []
    const allErrors: OpError[] = []
    blocks.forEach((ops, i) => {
      const result = executeOps(ops, `ai:${i}`)
      allAffected.push(...result.affectedIds)
      allErrors.push(...result.errors)
    })

    if (allAffected.length > 0) {
      set({ lastAiAffectedIds: allAffected, lastAiActionAt: Date.now() })
      focusViewportOnIds(allAffected)
    }

    return { affectedIds: allAffected, errors: allErrors }
  },

  ensureDesignThread: async (workspaceRoot) => {
    const existing = get().designThreadId
    if (existing) return existing

    const savedId = readDesignAssistantThreadId(workspaceRoot)
    if (savedId) {
      set({ designThreadId: savedId })
      return savedId
    }

    const provider = getProvider()
    const thread = await provider.createThread({
      workspace: workspaceRoot,
      title: 'Design Assistant'
    })
    const threadId = thread.id
    writeDesignAssistantThreadId(workspaceRoot, threadId)
    set({ designThreadId: threadId })
    return threadId
  },

  sendDesignMessage: async (text, prompt, workspaceRoot) => {
    const state = get()
    if (state.designBusy) return

    set({ designBusy: true, designInput: '' })
    state.appendBlock({
      kind: 'user',
      id: makeBlockId(),
      text,
      createdAt: new Date().toISOString()
    })

    try {
      const threadId = await get().ensureDesignThread(workspaceRoot)
      const provider = getProvider()
      const { turnId } = await provider.sendUserMessage(threadId, prompt, {
        displayText: text,
        mode: 'agent'
      })

      const sseStreamId = `design-rail-${threadId}-${turnId}`
      const { streamId } = await rendererRuntimeClient.startSse(threadId, 0, sseStreamId)

      let assistantText = ''
      const unsubscribe = rendererRuntimeClient.onSseEvent((payload) => {
        if (payload.streamId !== streamId) return
        for (const rawEvent of payload.events) {
          const event = rawEvent as { type?: string; delta?: string; text?: string }
          if (event.type === 'text_delta' && event.delta) {
            assistantText += event.delta
          } else if (event.type === 'turn_complete') {
            unsubscribe()
            rendererRuntimeClient.stopSse(streamId)
            get().appendBlock({
              kind: 'assistant',
              id: makeBlockId(),
              text: assistantText,
              createdAt: new Date().toISOString()
            })
            // Auto-apply ShapeOps blocks the AI emitted (round-trip without a manual step).
            try {
              get().applyAiShapeOps(assistantText)
            } catch {
              // ignore — the executor logs its own errors in result.errors
            }
            set({ designBusy: false })
          }
        }
      })
    } catch {
      set({ designBusy: false })
      get().appendBlock({
        kind: 'assistant',
        id: makeBlockId(),
        text: 'Failed to send design message.',
        createdAt: new Date().toISOString()
      })
    }
  }
}))
