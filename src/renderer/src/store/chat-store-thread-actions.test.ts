import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NormalizedThread } from '../agent/types'
import type { ChatState, ChatStoreGet, ChatStoreSet, GuiPlanMessageContext } from './chat-store-types'

const registryMock = vi.hoisted(() => ({
  getProvider: vi.fn()
}))

vi.mock('../agent/registry', () => ({
  getProvider: registryMock.getProvider
}))

import { createThreadActions } from './chat-store-thread-actions'

function thread(id: string): NormalizedThread {
  return {
    id,
    title: id,
    updatedAt: '2026-06-09T00:00:00.000Z',
    model: 'deepseek-v4-pro',
    mode: 'agent',
    workspace: '/workspace/deepseek-gui',
    status: 'running'
  }
}

function buildHarness(): {
  actions: ReturnType<typeof createThreadActions>
  state: ChatState
} {
  let state: ChatState
  state = {
    activeThreadId: 'thr_existing',
    blocks: [],
    busy: true,
    clawChannels: [],
    composerModel: '',
    error: 'previous error',
    queuedMessages: [],
    recoverActiveTurn: vi.fn(async () => true),
    route: 'chat',
    runtimeConnection: 'ready',
    threads: [thread('thr_existing')]
  } as unknown as ChatState

  const set: ChatStoreSet = (partial) => {
    const update = typeof partial === 'function' ? partial(state) : partial
    Object.assign(state, update)
  }
  const get: ChatStoreGet = () => state
  const actions = createThreadActions({
    set,
    get,
    sseAbortRef: { current: null }
  })
  state.sendMessage = actions.sendMessage
  return { actions, state }
}

describe('chat-store-thread-actions queued messages', () => {
  beforeEach(() => {
    registryMock.getProvider.mockReset()
    registryMock.getProvider.mockReturnValue({})
  })

  it('does not queue GUI plan messages while another turn is active', async () => {
    const { actions, state } = buildHarness()
    const guiPlan: GuiPlanMessageContext = {
      operation: 'draft',
      workspaceRoot: '/workspace/deepseek-gui',
      relativePath: '.kunsdd/plan/feature.md',
      planId: 'plan-1',
      sourceRequest: 'feature'
    }

    await expect(actions.sendMessage('prompt one', 'plan', {
      displayText: 'Generate implementation plan',
      guiPlan
    })).resolves.toBe(false)

    expect(state.queuedMessages).toHaveLength(0)
    expect(state.error).toBeTruthy()
  })

  it('removes stale queued GUI plan messages before draining normal queued messages', async () => {
    const { actions, state } = buildHarness()
    const sendMessage = vi.fn(async (_text, _mode, overrides) => {
      state.queuedMessages = state.queuedMessages.filter((message) => message.id !== overrides?.queued?.id)
      return true
    })
    state.busy = false
    state.sendMessage = sendMessage as unknown as ChatState['sendMessage']
    state.queuedMessages = [
      {
        id: 'q-plan',
        text: 'internal plan prompt',
        mode: 'plan',
        guiPlan: {
          operation: 'draft',
          workspaceRoot: '/workspace/deepseek-gui',
          relativePath: '.kunsdd/plan/one.md',
          planId: 'plan-1'
        }
      },
      {
        id: 'q-user',
        text: 'normal follow-up',
        mode: 'agent'
      }
    ]

    await actions.drainQueuedMessages()

    expect(state.queuedMessages).toEqual([])
    expect(sendMessage).toHaveBeenCalledWith('normal follow-up', 'agent', {
      queued: expect.objectContaining({ id: 'q-user' })
    })
  })

describe('chat-store-thread-actions subscribeThreadEventsLive', () => {
  it('opens SSE with sinceSeq=0, skips the HTTP fetch, and switches activeThreadId so deltas flow in', async () => {
    const subscribeCalls: Array<{ threadId: string; sinceSeq: number }> = []
    const getDetailCalls: string[] = []
    let capturedSink: { onDeltas: (deltas: Array<{ kind: string; text: string; seq: number }>) => void } | null = null

    const provider = {
      getThreadDetail: vi.fn(async (id: string) => {
        getDetailCalls.push(id)
        return { blocks: [], latestSeq: 0, threadStatus: 'idle' }
      }),
      subscribeThreadEvents: vi.fn(async (threadId: string, sinceSeq: number, sink: unknown) => {
        subscribeCalls.push({ threadId, sinceSeq })
        capturedSink = sink as typeof capturedSink
        return { streamId: 'stream_1' }
      })
    }
    registryMock.getProvider.mockReturnValue(provider)

    const { actions, state } = buildHarness()
    state.activeThreadId = 'thr_existing'
    state.busy = true
    state.runtimeConnection = 'ready'

    await actions.subscribeThreadEventsLive('thr_live')

    // HTTP fetch is NOT done (no metadata roundtrip)
    expect(provider.getThreadDetail).not.toHaveBeenCalled()
    // SSE opens with sinceSeq=0 so all events replay
    expect(subscribeCalls).toEqual([{ threadId: 'thr_live', sinceSeq: 0 }])
    // The chat view switches to the live thread
    expect(state.activeThreadId).toBe('thr_live')
    // SSE-sourced deltas flow into the chat-store's live state.
    // `capturedSink` is typed `T | null`; after `not.toBeNull()` the compiler
    // still narrows to `never` because there's no control-flow assignment.
    // Use a non-null cast for the assertion (the runtime check above is real).
    const sink = capturedSink as unknown as {
      onDeltas: (deltas: Array<{ kind: string; text: string; seq: number }>) => void
    } | null
    expect(sink).not.toBeNull()
    if (sink) {
      sink.onDeltas([{ kind: 'agent_message', text: 'hello', seq: 1 }])
      expect(state.liveAssistant).toBe('hello')
      sink.onDeltas([{ kind: 'agent_message', text: ' world', seq: 2 }])
      expect(state.liveAssistant).toBe('hello world')
    }
  })
})

})
