import { InMemoryApprovalGate } from '../adapters/in-memory-approval-gate.js'
import { InMemoryEventBus } from '../adapters/in-memory-event-bus.js'
import { InMemorySessionStore } from '../adapters/in-memory-session-store.js'
import { InMemoryThreadStore } from '../adapters/in-memory-thread-store.js'
import { InMemoryUserInputGate } from '../adapters/in-memory-user-input-gate.js'
import { setSystemPrompt, type ImmutablePrefix } from '../cache/immutable-prefix.js'
import { SUBAGENT_READ_ONLY_TOOL_NAMES, type ModelCapabilityMetadata } from '../contracts/capabilities.js'
import type { TurnItem } from '../contracts/items.js'
import type { ApprovalPolicy, SandboxMode } from '../contracts/policy.js'
import type { RuntimeTuningConfig } from '../config/kun-config.js'
import { AgentLoop } from '../loop/agent-loop.js'
import { normalizeRoleReasoningEffort } from '../loop/reasoning-effort.js'
import type { ContextCompactionConfig, ModelConfig } from '../loop/model-context-profile.js'
import { ContextCompactor } from '../loop/context-compactor.js'
import { InflightTracker } from '../loop/inflight-tracker.js'
import { SteeringQueue } from '../loop/steering-queue.js'
import type { TokenEconomyConfig } from '../loop/token-economy.js'
import type { MemoryStore } from '../memory/memory-store.js'
import type { ArtifactStore } from '../artifacts/artifact-store.js'
import type { ModelClient } from '../ports/model-client.js'
import { RandomIdGenerator } from '../ports/id-generator.js'
import type { SessionStore } from '../ports/session-store.js'
import type { ThreadStore } from '../ports/thread-store.js'
import type { ToolHost } from '../ports/tool-host.js'
import type { SkillRuntime } from '../skills/skill-runtime.js'
import type { InstructionRuntime } from '../instructions/instruction-runtime.js'
import { RuntimeEventRecorder } from '../services/runtime-event-recorder.js'
import { ThreadService } from '../services/thread-service.js'
import { TurnService } from '../services/turn-service.js'
import { UsageService } from '../services/usage-service.js'
import type { ChildRunExecutor } from './delegation-runtime.js'

/**
 * Maximum number of continuation nudges injected when the child agent
 * produces a text-only response with zero tool calls. A single nudge catches
 * the common "superficial first reply" case (Issue #621) without risking
 * infinite loops.
 */
const CHILD_NO_TOOL_MAX_RECOVERY_STEPS = 1

/**
 * System-level instruction injected into every child agent's prefix to enforce
 * task completion discipline. This addresses Issue #621 (子代理提前结束) by
 * making the model itself responsible for: using tools to investigate before
 * concluding, verifying findings against real files/code, and not stopping
 * after a superficial analysis.
 */
const CHILD_TASK_DISCIPLINE_PROMPT = [
  'You are running as a delegated child agent. Complete the assigned task thoroughly before responding.',
  'Completion rules:',
  '- If the task requires investigating code, files, or the filesystem, you MUST use the available tools (read, grep, find, ls, bash, etc.) to gather real evidence before answering. Do NOT guess or give a superficial answer based only on the task description.',
  '- If you can answer directly from the prompt without tools (e.g. a pure text transformation, a simple question), answer directly.',
  '- Verify your conclusions by checking actual file contents, command output, or test results — do not assume code works because it looks correct.',
  '- After using tools to make changes (for non-read-only tasks), run appropriate checks (read modified files, run tests, typecheck) to confirm correctness before concluding.',
  '- Do NOT end your turn with a plan or promise of future action ("I will now...", "Next I will..."). Do the work now in this turn using tools, then report your concrete results.',
  '- Your final response should report what you actually found, changed, or verified — not what you intend to do.'
].join('\n')

/**
 * Regex patterns that signal the model is PLANNING to do work rather than
 * reporting completed work. When a child agent produces a response matching
 * these patterns WITHOUT calling any tools, it almost certainly stopped early
 * (Issue #621) — it acknowledged the task, described what it intends to do,
 * but never actually did it via tool calls.
 */
const PLANNING_LANGUAGE_PATTERNS = [
  /\bI(?:'ll| will| will now|'m going to| am going to| need to| will first|'d like to)\b/i,
  /\bLet me\b/i,
  /\bFirst,? I\b/i,
  /\bI (?:will|shall|can|would like to)\b/i,
  /\bLet's\b/i,
  /\bI'm going to\b/i,
  /\bNow I(?:'ll| will)\b/i,
  /\bNext,? I\b/i,
  /\bTo (?:fix|solve|address|investigate|analyze|debug|do this)\b/i,
  /我将|我会|我先|我需要|让我|接下来|首先|现在开始|我来|我准备|我打算/i,
  /让我(?:先|开始|来|分析|看看|查看|检查|调查|研究)/i,
  /接下来我|下一步我|下面我/i,
  /我(?:将|会|要|先|来)(?:开始|进行|分析|查看|检查|调查|研究|阅读|找到|定位|修复)/i
]

/**
 * Determine if the assistant text looks like planning/acknowledgement language
 * rather than a completed answer. Used to detect premature termination where
 * the model promised action but didn't call tools.
 */
function looksLikePlanningLanguage(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true // Empty response is suspicious
  return PLANNING_LANGUAGE_PATTERNS.some((pattern) => pattern.test(trimmed))
}

/**
 * Continuation nudge injected as a user message when the child stops without
 * calling any tools on a task that looks like it requires investigation.
 * Gives the model a single chance to recover from a lazy/early stop.
 */
const CHILD_NO_TOOL_CONTINUATION_PROMPT = [
  'You responded without using any tools. If the task requires investigation, reading files, running commands, or making changes, you must use tools to do the actual work now.',
  'Do NOT repeat your previous answer or summarize what you plan to do — take concrete action using tools, then report your results.',
  'If you genuinely can answer without tools (pure text task, simple arithmetic, etc.), provide your final answer clearly.'
].join('\n')

export type ChildAgentExecutorOptions = {
  model: ModelClient
  toolHost: ToolHost
  prefix: ImmutablePrefix
  defaultModel: string
  models?: ModelConfig
  contextCompaction?: ContextCompactionConfig
  approvalPolicy?: ApprovalPolicy
  sandboxMode?: SandboxMode
  tokenEconomy?: TokenEconomyConfig
  runtime?: RuntimeTuningConfig
  nowIso?: () => string
  modelCapabilities?: (model: string) => ModelCapabilityMetadata
  skillRuntime?: SkillRuntime
  instructionRuntime?: InstructionRuntime
  memoryStore?: MemoryStore
  artifactStore?: ArtifactStore
  /**
   * Persistence wiring. When the main runtime's stores + event recorder are
   * supplied, the child runs as a persisted `relation: 'side'` thread on the
   * shared event bus: its full session (reasoning, tool calls, results) is
   * queryable via `getThreadDetail(childId)` and streams live to UI
   * subscribers. The thread is hidden from the default thread list (the store
   * filters `side`). When omitted (e.g. in unit tests) the child falls back to
   * throwaway in-memory stores, preserving full isolation.
   */
  sessionStore?: SessionStore
  threadStore?: ThreadStore
  events?: RuntimeEventRecorder
}

export function createChildAgentExecutor(options: ChildAgentExecutorOptions): ChildRunExecutor {
  return async (input) => {
    const nowIso = options.nowIso ?? (() => new Date().toISOString())
    // Persist into the main runtime's stores + event bus when supplied, so the
    // child session is queryable and streams live; otherwise stay isolated in
    // throwaway in-memory stores (preserves test behavior). The recorder is
    // shared too — events persist-before-publish to the same bus, and seq
    // allocation is per-thread (childId), so child events never bleed into the
    // parent thread's stream.
    const sessionStore: SessionStore = options.sessionStore ?? new InMemorySessionStore()
    const threadStore: ThreadStore = options.threadStore ?? new InMemoryThreadStore()
    const events =
      options.events ??
      (() => {
        const eventBus = new InMemoryEventBus()
        return new RuntimeEventRecorder({
          eventBus,
          sessionStore,
          allocateSeq: (threadId) => eventBus.allocateSeq(threadId),
          nowIso
        })
      })()
    const usage = new UsageService()
    const ids = new RandomIdGenerator()
    const inflight = new InflightTracker()
    const steering = new SteeringQueue()
    const compactor = new ContextCompactor({
      contextCompaction: options.contextCompaction,
      models: options.models
    })
    const turns = new TurnService({
      threadStore,
      sessionStore,
      events,
      inflight,
      steering,
      compactor,
      ids,
      nowIso
    })
    const threads = new ThreadService({
      threadStore,
      sessionStore,
      events,
      ids,
      nowIso
    })
    // Tool gating, most-specific first: an explicit allow-list wins; else a
    // read-only policy restricts to investigation tools; else (inherit) the
    // child sees the parent agent's FULL tool set — no forced allow-list, so
    // it can edit/run shell exactly like the parent. The capability registry
    // enforces an explicit list twice (dropped from the model's tool schema
    // and rejected at execute), but `inherit` leaves it undefined so nothing
    // is forced. The child is not an escalation: it runs under the parent
    // thread's approvalPolicy/sandboxMode (set on the thread below from
    // options.approvalPolicy/sandboxMode, which the runtime factory threads
    // from the parent runtime), so a read-only parent still yields a
    // read-only child.
    const forcedAllowedToolNames = input.allowedTools
      ? [...input.allowedTools]
      : input.toolPolicy === 'readOnly'
        ? [...SUBAGENT_READ_ONLY_TOOL_NAMES]
        : undefined
    // GUI "custom" capability scope: deny-lists layered on top of inherit.
    // Built-in tools block by name; MCP servers block at the provider level
    // (`mcp:<serverId>`, drift-proof — new tools from a blocked server stay
    // hidden); skills block by id. All three only REMOVE access, so they
    // compose with the parent intersection and can never escalate the child.
    const blockedToolNames = input.blockedTools?.length ? [...input.blockedTools] : undefined
    const blockedProviderIds = input.blockedMcpServers?.length
      ? input.blockedMcpServers.map((serverId) => `mcp:${serverId}`)
      : undefined
    const blockedSkillIds = input.blockedSkills?.length ? [...input.blockedSkills] : undefined
    // Build the child's system prompt: base kun prefix + optional profile
    // systemPrompt + mandatory child task discipline instructions. The
    // discipline prompt is added to EVERY child (regardless of profile) to
    // prevent the premature-termination bug (#621) where the model gives a
    // superficial answer without using tools.
    let systemPromptParts: string[] = []
    if (input.systemPrompt?.trim()) {
      systemPromptParts.push(input.systemPrompt.trim())
    }
    systemPromptParts.push(CHILD_TASK_DISCIPLINE_PROMPT)
    const augmentedSystemPrompt = systemPromptParts.join('\n\n')
    const childPrefix = setSystemPrompt(
      options.prefix,
      `${options.prefix.systemPrompt}\n\n${augmentedSystemPrompt}`.trim()
    )
    const loop = new AgentLoop({
      threadStore,
      sessionStore,
      approvalGate: new InMemoryApprovalGate(),
      userInputGate: new InMemoryUserInputGate(),
      model: options.model,
      toolHost: options.toolHost,
      usage,
      events,
      turns,
      inflight,
      steering,
      compactor,
      prefix: childPrefix,
      ids,
      nowIso,
      ...(forcedAllowedToolNames ? { forcedAllowedToolNames } : {}),
      ...(blockedToolNames ? { blockedToolNames } : {}),
      ...(blockedProviderIds ? { blockedProviderIds } : {}),
      ...(blockedSkillIds ? { blockedSkillIds } : {}),
      ...(options.modelCapabilities ? { modelCapabilities: options.modelCapabilities } : {}),
      ...(options.skillRuntime ? { skillRuntime: options.skillRuntime } : {}),
      ...(options.instructionRuntime ? { instructionRuntime: options.instructionRuntime } : {}),
      ...(options.memoryStore ? { memoryStore: options.memoryStore } : {}),
      ...(options.artifactStore ? { artifactStore: options.artifactStore } : {}),
      ...(options.contextCompaction ? { contextCompaction: options.contextCompaction } : {}),
      ...(options.tokenEconomy ? { tokenEconomy: options.tokenEconomy } : {}),
      ...(options.runtime?.toolStorm ? { toolStorm: options.runtime.toolStorm } : {}),
      ...(options.runtime?.toolArgumentRepair ? { toolArgumentRepair: options.runtime.toolArgumentRepair } : {})
    })

    const model = input.model?.trim() || options.defaultModel
    const title = childThreadTitle(input.childId, input.label, input.profile)
    const thread = await threads.create({
      title,
      workspace: input.workspace?.trim() || '~',
      model,
      mode: 'agent',
      approvalPolicy: options.approvalPolicy ?? 'auto',
      ...(options.sandboxMode ? { sandboxMode: options.sandboxMode } : {}),
      // Route the child to the profile's provider. ThreadService threads
      // providerId into every ModelRequest, and the executor's model is the
      // MultiProviderModelClient, so this single field is all routing needs.
      ...(input.providerId ? { providerId: input.providerId } : {})
    }, {
      id: input.childId,
      title,
      // Persist as a side branch of the parent: hidden from the default thread
      // list, but loadable on demand so the user can open the subagent's own
      // session from the parent's delegate_task card.
      relation: 'side',
      parentThreadId: input.parentThreadId
    })
    // Wire the external AbortSignal (from parent turn or detached controller)
    // to the child's turn lifecycle. Previously (Issue #621) the signal was
    // received but never connected: aborting the parent or calling abortChild()
    // on a detached run would fire the signal, but the child loop kept running
    // because it only listened to its own internal AbortController.
    let activeTurnId: string | null = null
    let abortedExternally = false
    const abortHandler = (): void => {
      abortedExternally = true
      if (activeTurnId) {
        turns.interruptTurn({ threadId: thread.id, turnId: activeTurnId }).catch(() => {})
      }
    }
    if (input.signal.aborted) {
      throw new Error('aborted before child agent started')
    }
    input.signal.addEventListener('abort', abortHandler, { once: true })
    // A profile preamble rides in the prompt body (not the system prompt) so
    // the cached stable prefix stays byte-identical to the main agent's.
    const promptBase = input.promptPreamble?.trim()
      ? `${input.promptPreamble.trim()}\n\n${input.prompt}`
      : input.prompt
    const prompt = input.returnFormat === 'evidence'
      ? `${promptBase}\n\nReturn a concise evidence-based conclusion. Inspect the task with tools so the parent can verify the result.`
      : promptBase
    let status: 'completed' | 'failed' | 'aborted'
    let lastTurnId: string
    let recoverySteps = 0

    try {
      const started = await turns.startTurn({
        threadId: thread.id,
        request: {
          prompt,
          model,
          mode: 'agent',
          reasoningEffort: normalizeRoleReasoningEffort(input.reasoningEffort),
          ...(input.guiDesignCanvas ? { guiDesignCanvas: true } : {}),
          // Children have no GUI surface to answer structured input prompts.
          disableUserInput: true
        }
      })
      lastTurnId = started.turnId
      activeTurnId = started.turnId
      status = await loop.runTurn(thread.id, started.turnId)
      activeTurnId = null

      // Lazy-stop safety net (Issue #621): if the child completed the turn
      // with ZERO tool calls AND the response looks like planning/promising
      // language ("I'll analyze...", "Let me start by...", "我将...") rather
      // than a concrete answer, the model almost certainly stopped early.
      // Inject a continuation nudge and run a second turn.
      while (status === 'completed' && recoverySteps < CHILD_NO_TOOL_MAX_RECOVERY_STEPS) {
        const allItems = await sessionStore.loadItems(thread.id)
        const currentTurnItems = allItems.filter((item) => item.turnId === lastTurnId)
        const toolCallsThisTurn = currentTurnItems.filter(
          (item) => item.kind === 'tool_call'
        ).length
        const assistantTextThisTurn = currentTurnItems
          .filter((item): item is Extract<TurnItem, { kind: 'assistant_text' }> => item.kind === 'assistant_text')
          .map((item) => item.text.trim())
          .filter(Boolean)
          .join('\n\n')
          .trim()

        if (toolCallsThisTurn > 0) break
        if (!looksLikePlanningLanguage(assistantTextThisTurn)) break

        if (recoverySteps === 0) {
          await events.record({
            kind: 'error',
            threadId: thread.id,
            turnId: lastTurnId,
            message: 'Child agent stopped without tool calls; injecting continuation nudge.',
            code: 'child_no_tool_continuation',
            severity: 'warning'
          })
          if (abortedExternally) {
            status = 'aborted'
            break
          }
          const continued = await turns.startTurn({
            threadId: thread.id,
            request: {
              prompt: CHILD_NO_TOOL_CONTINUATION_PROMPT,
              model,
              mode: 'agent',
              reasoningEffort: normalizeRoleReasoningEffort(input.reasoningEffort),
              disableUserInput: true
            }
          })
          lastTurnId = continued.turnId
          activeTurnId = continued.turnId
          status = await loop.runTurn(thread.id, continued.turnId)
          activeTurnId = null
          recoverySteps += 1
          continue
        }
        break
      }

      // If externally aborted, force status to 'aborted'.
      if (abortedExternally && status !== 'aborted') {
        status = 'aborted'
      }
    } finally {
      input.signal.removeEventListener('abort', abortHandler)
    }

    const items = await sessionStore.loadItems(thread.id)

    // Only a FATAL error fails the child. Recoverable tool errors are
    // recorded as `severity: 'warning'` and should not mark the whole
    // subagent "failed". Genuine failures are caught by `status` check;
    // here we honor non-warning error events across ALL child turns.
    const allEvents = await sessionStore.loadEventsSince(thread.id, 0)
    const fatalError = allEvents.find(
      (event) =>
        event.kind === 'error' &&
        event.threadId === thread.id &&
        event.severity !== 'warning' &&
        event.severity !== 'info'
    )

    const toolInvocations = items.filter(
      (item) => item.kind === 'tool_call'
    ).length
    const summary = summarizeChildTurn(items, thread.id, status)

    const evidence = input.returnFormat === 'evidence'
      ? childToolEvidence(items, lastTurnId!)
      : undefined

    if (fatalError?.kind === 'error') {
      const context = buildErrorContext({
        childId: input.childId,
        threadId: thread.id,
        turnId: lastTurnId!,
        status,
        toolInvocations,
        fatalMessage: fatalError.message,
        fatalCode: fatalError.code
      })
      throw new Error(`${fatalError.message}\n${context}`)
    }

    if (status === 'aborted' || input.signal.aborted) {
      const reason = abortedExternally || input.signal.aborted ? 'cancelled by parent' : 'aborted internally'
      const context = buildErrorContext({
        childId: input.childId,
        threadId: thread.id,
        turnId: lastTurnId!,
        status: 'aborted',
        toolInvocations,
        fatalMessage: reason
      })
      const error = new Error(`child agent aborted (${reason}; ${toolInvocations} tool calls before abort)\n${context}`)
      error.name = 'ChildAbortedError'
      throw error
    }

    if (status !== 'completed') {
      const context = buildErrorContext({
        childId: input.childId,
        threadId: thread.id,
        turnId: lastTurnId!,
        status,
        toolInvocations,
        fatalMessage: summary || `child agent ${status}`
      })
      throw new Error(`${summary || `child agent ${status}`}\n${context}`)
    }

    return {
      summary,
      ...(evidence ? { evidence } : {}),
      usage: usage.forThread(thread.id),
      toolInvocations,
      // The child loop was constructed with the main agent's immutable
      // prefix; only the small delegation prompt is appended fresh.
      prefixReused: true,
      inheritedHistoryItems: 0
    }
  }
}

function childToolEvidence(items: readonly TurnItem[], turnId: string): string[] {
  const results = new Map(items
    .filter((item): item is Extract<TurnItem, { kind: 'tool_result' }> =>
      item.turnId === turnId && item.kind === 'tool_result')
    .map((item) => [item.callId, item]))
  return items
    .filter((item): item is Extract<TurnItem, { kind: 'tool_call' }> =>
      item.turnId === turnId && item.kind === 'tool_call')
    .slice(0, 32)
    .map((item) => {
      const result = results.get(item.callId)
      const target = toolEvidenceTarget(item.arguments)
      return `${item.toolName}${target ? ` ${target}` : ''}: ${result?.isError ? 'failed' : 'completed'}`
    })
}

function toolEvidenceTarget(args: Record<string, unknown>): string {
  for (const key of ['path', 'filePath', 'file_path', 'query', 'command']) {
    const value = args[key]
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 300)
  }
  return ''
}

function childThreadTitle(childId: string, label?: string, profile?: string): string {
  const suffix = label?.trim() || profile?.trim() || childId
  return `Child agent: ${suffix}`
}

function summarizeChildTurn(
  items: readonly TurnItem[],
  threadId: string,
  status: 'completed' | 'failed' | 'aborted'
): string {
  // Collect assistant text from ALL turns of this child thread (not just the
  // last one), since continuation turns may produce the actual final answer.
  const threadItems = items.filter((item) => item.threadId === threadId)
  const assistantText = threadItems
    .filter((item): item is Extract<TurnItem, { kind: 'assistant_text' }> => item.kind === 'assistant_text')
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim()
  if (assistantText) return assistantText
  const errors = threadItems
    .filter((item): item is Extract<TurnItem, { kind: 'error' }> => item.kind === 'error')
    .filter((item) => item.severity === 'error')
    .map((item) => item.message.trim())
    .filter(Boolean)
    .join('\n')
    .trim()
  if (errors) return errors
  const toolResult = [...threadItems]
    .reverse()
    .find((item): item is Extract<TurnItem, { kind: 'tool_result' }> => item.kind === 'tool_result')
  if (toolResult) return stringifySummary(toolResult.output)
  return status === 'completed'
    ? 'Child agent completed without a text response.'
    : `Child agent ${status}.`
}

function stringifySummary(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (value == null) return ''
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Build a structured debugging context string for child agent errors.
 * Includes child/thread/turn IDs, status, tool call count, and fatal error
 * details so logs and error surfaces have enough context to diagnose issues.
 */
function buildErrorContext(input: {
  childId: string
  threadId: string
  turnId: string
  status: 'completed' | 'failed' | 'aborted'
  toolInvocations: number
  fatalMessage?: string
  fatalCode?: string
}): string {
  const parts = [
    `[Child agent error context]`,
    `  childId: ${input.childId}`,
    `  threadId: ${input.threadId}`,
    `  turnId: ${input.turnId}`,
    `  status: ${input.status}`,
    `  toolInvocations: ${input.toolInvocations}`
  ]
  if (input.fatalCode) parts.push(`  errorCode: ${input.fatalCode}`)
  if (input.fatalMessage) parts.push(`  error: ${input.fatalMessage}`)
  return parts.join('\n')
}
