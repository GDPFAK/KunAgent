import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { CapabilityRegistry } from '../adapters/tool/capability-registry.js'
import { LocalToolHost } from '../adapters/tool/local-tool-host.js'
import { InMemoryEventBus } from '../adapters/in-memory-event-bus.js'
import { InMemorySessionStore } from '../adapters/in-memory-session-store.js'
import { InMemoryThreadStore } from '../adapters/in-memory-thread-store.js'
import { createImmutablePrefix } from '../cache/immutable-prefix.js'
import { SubagentsCapabilityConfig } from '../contracts/capabilities.js'
import { emptyUsageSnapshot } from '../contracts/usage.js'
import { createThreadRecord } from '../domain/thread.js'
import { ContextCompactor } from '../loop/context-compactor.js'
import { InflightTracker } from '../loop/inflight-tracker.js'
import { SteeringQueue } from '../loop/steering-queue.js'
import type { ModelClient, ModelRequest, ModelStreamChunk } from '../ports/model-client.js'
import { SequentialIdGenerator } from '../ports/id-generator.js'
import { RuntimeEventRecorder } from '../services/runtime-event-recorder.js'
import { TurnService } from '../services/turn-service.js'
import { createChildAgentExecutor } from './child-agent-executor.js'
import { DelegationRuntime, FileDelegationStore } from './delegation-runtime.js'

class HangingModel implements ModelClient {
  readonly provider = 'test'
  readonly model = 'test-model'
  readonly requests: ModelRequest[] = []
  private resolveRequest: (() => void) | undefined
  readonly requestStarted = new Promise<void>((resolve) => {
    this.resolveRequest = resolve
  })

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
    this.requests.push(request)
    this.resolveRequest?.()
    await new Promise<void>((resolve) => {
      if (request.abortSignal.aborted) {
        resolve()
        return
      }
      request.abortSignal.addEventListener('abort', () => resolve(), { once: true })
    })
    if (!request.abortSignal.aborted) {
      yield { kind: 'usage', usage: emptyUsageSnapshot() }
      yield { kind: 'completed', stopReason: 'stop' }
    }
  }
}

describe('DelegationRuntime abort handling', () => {
  it('does not abort detached children when the parent signal aborts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kun-delegation-'))
    try {
      let childSignal: AbortSignal | undefined
      const runtime = new DelegationRuntime({
        config: subagentConfig(),
        store: new FileDelegationStore(dir),
        executor: async (input) => {
          childSignal = input.signal
          await new Promise<void>((resolve) => {
            input.signal.addEventListener('abort', () => resolve(), { once: true })
          })
          throw new Error('aborted')
        }
      })
      const parent = new AbortController()
      const record = await runtime.runChild({
        parentThreadId: 'parent',
        parentTurnId: 'turn',
        prompt: 'background work',
        detach: true,
        signal: parent.signal
      })

      await waitFor(() => childSignal !== undefined)
      parent.abort()
      expect(childSignal?.aborted).toBe(false)

      expect(runtime.abortChild(record.id)).toBe(true)
      await waitFor(() => childSignal?.aborted === true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('wakes the parent thread when a detached child settles after the parent turn was interrupted', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kun-delegation-'))
    try {
      const { runtime, threadStore, turns } = makeRuntime(dir)
      await threadStore.upsert(createThreadRecord({
        id: 'parent',
        title: 'Parent',
        workspace: '/ws',
        model: 'test-model'
      }))
      const parentTurn = await turns.startTurn({
        threadId: 'parent',
        request: { prompt: 'start parent' }
      })
      await turns.interruptTurn({
        threadId: 'parent',
        turnId: parentTurn.turnId
      })
      const runTurn = vi.fn(async (_threadId: string, _turnId: string) => undefined)
      runtime.bindAgentLoop({ runTurn })

      await runtime.runChild({
        parentThreadId: 'parent',
        parentTurnId: parentTurn.turnId,
        label: 'research',
        prompt: 'background work',
        detach: true,
        signal: new AbortController().signal
      })

      await waitFor(() => runTurn.mock.calls.length === 1)
      expect(runTurn.mock.calls[0][0]).toBe('parent')
      const thread = await threadStore.get('parent')
      expect(thread?.status).toBe('running')
      const resumedTurn = thread?.turns.at(-1)
      expect(resumedTurn?.prompt).toContain('<background_subagent_completed>')
      expect(resumedTurn?.prompt).toContain('<label>research</label>')
      expect(resumedTurn?.items?.[0]).toMatchObject({
        kind: 'user_message',
        messageSource: 'background_subagent',
        displayText: 'Background subagent research completed'
      })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('createChildAgentExecutor abort handling', () => {
  it('connects the parent signal to the child turn interrupt', async () => {
    const model = new HangingModel()
    const executor = createChildAgentExecutor({
      model,
      toolHost: new LocalToolHost({ registry: new CapabilityRegistry() }),
      prefix: createImmutablePrefix({ systemPrompt: 'You are Kun.' }),
      defaultModel: 'test-model'
    })
    const parent = new AbortController()
    const run = executor({
      childId: 'child',
      parentThreadId: 'parent',
      parentTurnId: 'turn',
      prompt: 'work until interrupted',
      toolPolicy: 'inherit',
      signal: parent.signal
    })

    await model.requestStarted
    parent.abort()

    await expect(run).rejects.toThrow('Child agent aborted.')
    expect(model.requests[0].abortSignal.aborted).toBe(true)
  })
})

function subagentConfig() {
  return SubagentsCapabilityConfig.parse({
    enabled: true,
    maxParallel: 1,
    maxChildRuns: 10
  })
}

function makeRuntime(dir: string): {
  runtime: DelegationRuntime
  threadStore: InMemoryThreadStore
  turns: TurnService
} {
  const nowIso = () => '2026-07-04T00:00:00.000Z'
  const threadStore = new InMemoryThreadStore()
  const sessionStore = new InMemorySessionStore()
  const eventBus = new InMemoryEventBus()
  const events = new RuntimeEventRecorder({
    eventBus,
    sessionStore,
    allocateSeq: (threadId) => eventBus.allocateSeq(threadId),
    nowIso
  })
  const turns = new TurnService({
    threadStore,
    sessionStore,
    events,
    inflight: new InflightTracker(),
    steering: new SteeringQueue(),
    compactor: new ContextCompactor(),
    ids: new SequentialIdGenerator(),
    nowIso
  })
  const runtime = new DelegationRuntime({
    config: subagentConfig(),
    store: new FileDelegationStore(dir),
    events,
    threadStore,
    turns,
    nowIso,
    executor: async () => ({
      summary: 'done'
    })
  })
  return { runtime, threadStore, turns }
}

async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const started = Date.now()
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('waitFor timed out')
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}
