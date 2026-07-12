import { parentPort, workerData } from 'node:worker_threads'
import { AgentLoop } from '../../loop/agent-loop.js'
import { InMemoryEventBus } from '../in-memory-event-bus.js'
import { InMemoryThreadStore } from '../in-memory-thread-store.js'
import { InMemorySessionStore } from '../in-memory-session-store.js'
import { InMemoryApprovalGate } from '../in-memory-approval-gate.js'
import { RuntimeEventRecorder } from '../../services/runtime-event-recorder.js'
import { ContextCompactor } from '../../loop/context-compactor.js'
import { createImmutablePrefix } from '../../cache/immutable-prefix.js'
import { LocalToolHost, defaultLocalTools } from '../tool/local-tool-host.js'
import { InflightTracker } from '../../loop/inflight-tracker.js'
import { SteeringQueue } from '../../loop/steering-queue.js'
import { UsageService } from '../../services/usage-service.js'

async function main(): Promise<void> {
  const data = workerData as {
    childId: string
    parentThreadId: string
    parentTurnId: string
    prompt: string
    profile?: string
    workspace?: string
    toolPolicy: string
    systemPrompt?: string
    promptPreamble?: string
    model?: string
    reasoningEffort?: string
    allowedTools?: string[]
    blockedTools?: string[]
  }

  const bus = new InMemoryEventBus()
  const sessionStore = new InMemorySessionStore()
  const threadStore = new InMemoryThreadStore()
  const approvalGate = new InMemoryApprovalGate()
  const inflight = new InflightTracker()
  const steering = new SteeringQueue()
  const compactor = new ContextCompactor({ softThreshold: 64, hardThreshold: 128 })
  const usage = new UsageService()
  const nowIso = () => new Date().toISOString()
  const allocateSeq = (threadId: string) => bus.allocateSeq(threadId)
  const events = new RuntimeEventRecorder({ eventBus: bus, sessionStore, allocateSeq, nowIso })
  bus.subscribe(data.childId, (event) => {
    try { parentPort?.postMessage({ _relay: 'event', event }) } catch {}
  })
  const prefix = createImmutablePrefix({ systemPrompt: data.systemPrompt ?? 'be brief' })
  const toolHost = new LocalToolHost({ tools: defaultLocalTools })
  // TODO: model client should be passed from parent; for now use a mock
  const model = {
    provider: 'worker',
    model: data.model ?? 'default',
    async *stream() { yield { kind: 'completed', stopReason: 'stop' as const } }
  } as any

  const loop = new AgentLoop({
    threadStore, sessionStore, approvalGate, userInputGate: undefined as any,
    model, toolHost, usage, events, turns: undefined as any,
    inflight, steering, compactor, prefix, nowIso
  } as any)

  const threadId = data.childId
  const turnId = `${data.childId}_turn`

  const status = await loop.runTurn(threadId, turnId)

  const result = {
    summary: `completed with status: ${status}`,
    usage: undefined,
    toolInvocations: 0
  }
  parentPort?.postMessage(result)
}

main().catch((err) => {
  parentPort?.postMessage({ summary: 'error: ' + (err instanceof Error ? err.message : String(err)) })
})
