import { makeUserItem } from '../domain/item.js'
import type { TurnItem } from '../contracts/items.js'
import type { AgentRoleId } from '../contracts/agent-role.js'
import type { ModelClient, ModelRequest, ModelStreamChunk } from '../ports/model-client.js'

// ─── Re-export legacy symbols for backward compatibility ──────────────────────

export const AUTO_MODEL_ROUTER_MODEL = 'deepseek-v4-flash'
export const AUTO_MODEL_FLASH = 'deepseek-v4-flash'
export const AUTO_MODEL_PRO = 'deepseek-v4-pro'
export const AUTO_MODEL_ROUTER_TIMEOUT_MS = 4_000

export type AutoModelRouteSource = 'flash-router' | 'heuristic'
export type AutoRouteReasoningEffort = 'off' | 'high' | 'max'

/** Legacy model-only route selection (preserved for existing callers). */
export type AutoModelRouteSelection = {
  model: typeof AUTO_MODEL_FLASH | typeof AUTO_MODEL_PRO
  reasoningEffort?: AutoRouteReasoningEffort
  source: AutoModelRouteSource
}

// ─── Extended Agent Route Selection ──────────────────────────────────────────

export type AgentRouteSource = 'flash-router' | 'heuristic' | 'role-heuristic'

/** Extended route selection including the agent role. */
export type AgentRouteSelection = {
  role: AgentRoleId
  model: string
  reasoningEffort?: AutoRouteReasoningEffort
  source: AgentRouteSource
}

// ─── Role-Based Heuristic ────────────────────────────────────────────────────

export function heuristicAgentRole(input: string): { role: AgentRoleId; confidence: number } {
  const lower = input.toLowerCase()
  const len = [...input].length

  if (len < 30 && (lower.includes('title') || lower.includes('name') || lower.includes('call this'))) {
    return { role: 'title', confidence: 0.9 }
  }

  if (lower.includes('review') || lower.includes('audit') || lower.includes('lint') ||
    (lower.includes('check') && (lower.includes('code') || lower.includes('security')))) {
    return { role: 'reviewer', confidence: 0.85 }
  }

  if (lower.includes('plan') || lower.includes('break down') || lower.includes('decompose') ||
    lower.includes('steps to') || lower.includes('outline') || lower.includes('strategy')) {
    return { role: 'planner', confidence: 0.8 }
  }

  if (lower.includes('find') || lower.includes('search') || lower.includes('investigate') ||
    lower.includes('what is') || lower.includes('explain') || lower.includes('research') ||
    lower.includes('documentation') || lower.includes('how does')) {
    return { role: 'researcher', confidence: 0.8 }
  }

  if (lower.includes('summarize') || lower.includes('summary') || lower.includes('condense') || lower.includes('tl;dr')) {
    return { role: 'summarizer', confidence: 0.85 }
  }

  if (len < 80 && (lower.startsWith('where') || lower.startsWith('who'))) {
    return { role: 'explore', confidence: 0.7 }
  }

  if (lower.includes('implement') || lower.includes('refactor') || lower.includes('debug') ||
    lower.includes('fix') || lower.includes('add feature') || lower.includes('write') ||
    lower.includes('create') || lower.includes('build') || lower.includes('test') ||
    lower.includes('error') || lower.includes('bug')) {
    return { role: 'coder', confidence: 0.75 }
  }

  return { role: 'coder', confidence: 0.5 }
}

// ─── Model-Based Agent Router ────────────────────────────────────────────────

const AGENT_ROUTER_SYSTEM_PROMPT = [
  'You are the agent role classifier. Return only compact JSON:',
  '{"role":"coder|planner|reviewer|researcher|title|summarizer|explore","model":"deepseek-v4-flash|deepseek-v4-pro","thinking":"off|high|max"}.',
  'Rules:',
  '- coder: coding, debugging, refactoring, feature implementation, testing',
  '- planner: task decomposition, planning, strategy, multi-step orchestration',
  '- reviewer: code review, security audit, quality check',
  '- researcher: investigation, documentation, explanation, finding things',
  '- title: short title generation (keep model flash)',
  '- summarizer: conversation summarization, condensing (keep model flash)',
  '- explore: quick lookups, file exploration, answering questions about the codebase (keep model flash)',
  'Use flash for title/summarizer/explore tasks, pro for coder/planner/reviewer/researcher tasks.',
  'Use thinking max for complex coding, planning, and review tasks.'
].join(' ')

export async function resolveAgentRoute(input: {
  modelClient: ModelClient
  threadId: string
  turnId: string
  latestRequest: string
  recentContext: string
  selectedModelMode: string
  abortSignal: AbortSignal
  timeoutMs?: number
  heuristicOnly?: boolean
}): Promise<AgentRouteSelection> {
  const heuristic = heuristicAgentRole(input.latestRequest)
  const modelFromHeuristic = autoModelHeuristic(input.latestRequest, input.selectedModelMode)
  const reasoningFromHeuristic = autoReasoningHeuristic(input.latestRequest)

  const fallback: AgentRouteSelection = {
    role: heuristic.role,
    model: modelFromHeuristic,
    reasoningEffort: reasoningFromHeuristic,
    source: 'role-heuristic'
  }

  if (input.heuristicOnly || heuristic.confidence >= 0.85) return fallback
  if (input.abortSignal.aborted) return fallback

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? AUTO_MODEL_ROUTER_TIMEOUT_MS)
  const onAbort = (): void => controller.abort()
  input.abortSignal.addEventListener('abort', onAbort, { once: true })

  try {
    const request: ModelRequest = {
      threadId: input.threadId,
      turnId: `${input.turnId}_agent_router`,
      model: AUTO_MODEL_ROUTER_MODEL,
      systemPrompt: AGENT_ROUTER_SYSTEM_PROMPT,
      prefix: [],
      history: [
        makeUserItem({
          id: `item_${input.turnId}_agent_router_user`,
          threadId: input.threadId,
          turnId: `${input.turnId}_agent_router`,
          text: agentRoutePrompt({
            latestRequest: input.latestRequest,
            recentContext: input.recentContext,
            selectedModelMode: input.selectedModelMode
          })
        })
      ],
      tools: [],
      abortSignal: controller.signal,
      stream: false,
      maxTokens: 96,
      temperature: 0,
      responseFormat: 'json_object',
      reasoningEffort: 'off'
    }
    const text = await collectRouterText(input.modelClient.stream(request), controller.signal)
    const recommendation = parseAgentRouteRecommendation(text)
    if (recommendation && recommendation.role) {
      return { ...recommendation, role: recommendation.role, source: 'flash-router' }
    }
    return fallback
  } catch {
    return fallback
  } finally {
    clearTimeout(timeout)
    input.abortSignal.removeEventListener('abort', onAbort)
  }
}

// ─── Legacy Model-Only Router ────────────────────────────────────────────────

export async function resolveAutoModelRoute(input: {
  modelClient: ModelClient
  threadId: string
  turnId: string
  latestRequest: string
  recentContext: string
  selectedModelMode: string
  abortSignal: AbortSignal
  timeoutMs?: number
}): Promise<AutoModelRouteSelection> {
  const route = await resolveAgentRoute({ ...input, heuristicOnly: true })
  return {
    model: (route.model === AUTO_MODEL_FLASH || route.model === AUTO_MODEL_PRO) ? route.model : AUTO_MODEL_PRO,
    reasoningEffort: route.reasoningEffort,
    source: 'heuristic'
  }
}

// ─── Heuristic helpers ───────────────────────────────────────────────────────

export function autoModelHeuristic(input: string, _currentModel = ''): typeof AUTO_MODEL_FLASH | typeof AUTO_MODEL_PRO {
  const len = [...input].length
  const lower = input.toLowerCase()
  const complexKeywords = [
    'refactor', 'architecture', 'design', 'debug', 'security',
    'review', 'audit', 'migrate', 'optimize', 'rewrite', 'implement', 'analyze'
  ]
  if (complexKeywords.some((keyword) => lower.includes(keyword))) return AUTO_MODEL_PRO
  if (len < 100) return AUTO_MODEL_FLASH
  if (len > 500) return AUTO_MODEL_PRO
  return AUTO_MODEL_FLASH
}

function autoReasoningHeuristic(input: string): AutoRouteReasoningEffort {
  const lower = input.toLowerCase()
  return lower.includes('debug') || lower.includes('error') ? 'max' : 'high'
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

export function parseAgentRouteRecommendation(raw: string): {
  role?: AgentRoleId
  model: string
  reasoningEffort?: AutoRouteReasoningEffort
} | null {
  const json = extractFirstJsonObject(raw)
  if (!json) return null
  try {
    const value = JSON.parse(json) as {
      effort?: unknown; model?: unknown; reasoning_effort?: unknown; thinking?: unknown; role?: unknown
    }
    const model = typeof value.model === 'string' ? normalizeModel(value.model) : null
    if (!model) return null
    const rawEffort = [value.thinking, value.reasoning_effort, value.effort]
      .find((effort) => typeof effort === 'string')
    const reasoningEffort = typeof rawEffort === 'string' ? normalizeEffort(rawEffort) : undefined
    const role = typeof value.role === 'string' ? normalizeRole(value.role) : undefined
    return { role, model, ...(reasoningEffort ? { reasoningEffort } : {}) }
  } catch {
    return null
  }
}

function normalizeModel(model: string): string | null {
  switch (model.trim().toLowerCase()) {
    case 'deepseek-v4-pro': case 'v4-pro': case 'pro': return AUTO_MODEL_PRO
    case 'deepseek-v4-flash': case 'v4-flash': case 'flash': return AUTO_MODEL_FLASH
    default: return null
  }
}

function normalizeRole(role: string): AgentRoleId | undefined {
  const normalized = role.trim().toLowerCase()
  const validRoles: AgentRoleId[] = ['coder', 'planner', 'reviewer', 'researcher', 'title', 'summarizer', 'explore']
  return validRoles.includes(normalized as AgentRoleId) ? (normalized as AgentRoleId) : undefined
}

function normalizeEffort(effort: string): AutoRouteReasoningEffort | null {
  switch (effort.trim().toLowerCase()) {
    case 'off': case 'disabled': case 'none': case 'false': return 'off'
    case 'low': case 'minimal': case 'medium': case 'mid': case 'high': return 'high'
    case 'max': case 'maximum': case 'xhigh': return 'max'
    default: return null
  }
}

// ─── Prompt Helpers ──────────────────────────────────────────────────────────

function agentRoutePrompt(input: {
  latestRequest: string
  recentContext: string
  selectedModelMode: string
}): string {
  return [
    'Session mode: agent',
    `Selected model mode: ${input.selectedModelMode}`,
    '',
    'Recent context:',
    input.recentContext,
    '',
    'Latest user request:',
    input.latestRequest,
    '',
    'Return JSON only.'
  ].join('\n')
}

async function collectRouterText(
  stream: AsyncIterable<ModelStreamChunk>,
  signal: AbortSignal
): Promise<string> {
  let text = ''
  for await (const chunk of stream) {
    if (signal.aborted) throw new Error('agent router timed out')
    switch (chunk.kind) {
      case 'assistant_text_delta':
      case 'assistant_reasoning_delta':
        text += chunk.text
        break
      case 'error':
        throw new Error(chunk.message)
    }
  }
  return text
}

function extractFirstJsonObject(raw: string): string | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  return start >= 0 && end >= start ? raw.slice(start, end + 1) : null
}

// ─── Context Helpers ─────────────────────────────────────────────────────────

export function recentAutoRouterContext(items: readonly TurnItem[], currentTurnId: string): string {
  const rows: string[] = []
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (rows.length >= 6) break
    const item = items[index]
    if (item.turnId === currentTurnId) continue
    const text = routerTextForItem(item).trim()
    if (!text) continue
    rows.push(`${routerRoleForItem(item)}: ${truncateForRouter(text, 900)}`)
  }
  rows.reverse()
  return rows.length ? rows.join('\n') : 'No prior context.'
}

function routerRoleForItem(item: TurnItem): string {
  switch (item.kind) {
    case 'user_message': return 'user'
    case 'tool_result': return 'tool'
    case 'compaction': return 'system'
    default: return 'assistant'
  }
}

function routerTextForItem(item: TurnItem): string {
  switch (item.kind) {
    case 'user_message':
    case 'assistant_text':
    case 'assistant_reasoning':
      return item.text
    case 'tool_call':
      return `[tool call: ${item.toolName}]`
    case 'tool_result':
      return `[tool result] ${typeof item.output === 'string' ? item.output : JSON.stringify(item.output)}`
    case 'compaction':
      return item.summary
    case 'approval':
      return `[approval: ${item.toolName}] ${item.summary}`
    case 'user_input':
      return `[user input] ${item.prompt}`
    case 'review':
      return `[review] ${item.title} ${item.reviewText ?? ''}`
    case 'error':
      return `[error] ${item.message}`
  }
}

function truncateForRouter(text: string, maxChars: number): string {
  const chars = [...text]
  return chars.length > maxChars ? `${chars.slice(0, maxChars).join('')}...` : text
}
