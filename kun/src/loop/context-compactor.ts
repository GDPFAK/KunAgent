import type { TurnItem } from '../contracts/items.js'
import type { ImmutablePrefix } from '../cache/immutable-prefix.js'
import { makeCompactionItem } from '../domain/item.js'
import { ContextEstimator } from './context-estimator.js'
import {
  compactedItemsDigestSource,
  computeShortHash,
  createToolDigestMarker
} from './compaction-marker.js'
import {
  DEFAULT_CONTEXT_THRESHOLDS,
  contextThresholdsForModel,
  modelContextProfilesFromConfig,
  type ContextCompactionConfig,
  type ModelConfig,
  type ModelContextProfile,
  type ModelContextThresholds
} from './model-context-profile.js'

export type CompactionMode = 'normal' | 'aggressive' | 'force'

/**
 * Provider `prompt_tokens` is trusted only while it stays within this multiple
 * of our local estimate of the sent request. Beyond it the count is treated as
 * a provider accounting artifact (e.g. MiniMax-M3 summing cumulative cache
 * reads into prompt_tokens) and ignored in favour of the estimate. The factor
 * is wide enough to absorb legitimate under-counting (image tool results,
 * formatting/role tokens) while still catching the order-of-magnitude inflation
 * that strands a thread at "100%".
 */
export const PROMPT_TOKEN_TRUST_FACTOR = 6

export type CompactionPlan = {
  mode: CompactionMode
  keepRecent: number
  reason: string
}

export type CompactionTriggerOptions = {
  model?: string
  /** Provider-reported prompt token count for the last request, when known. */
  promptTokens?: number
  frozenMessageCount?: number
  /**
   * Estimated per-request overhead (system prompt + tool schemas + few-shot
   * prefix) that is not part of the stored items. Added to the item estimate
   * as a safety floor for the no-usage path. Ignored when a larger
   * `promptTokens` is available.
   */
  overheadTokens?: number
}

/**
 * ContextCompactor folds long histories into a single compaction item
 * while preserving pinned user, project, and skill constraints from
 * the immutable prefix. Compaction is triggered by either an explicit
 * `compact()` call or a heuristic on estimated prompt tokens.
 */
export class ContextCompactor {
  private readonly estimator: ContextEstimator
  private readonly softThreshold: number
  private readonly hardThreshold: number
  private readonly modelProfiles: readonly ModelContextProfile[]

  constructor(options?: {
    estimator?: ContextEstimator
    softThreshold?: number
    hardThreshold?: number
    contextCompaction?: ContextCompactionConfig
    models?: ModelConfig
  }) {
    const contextCompaction = options?.contextCompaction
    this.estimator = options?.estimator ?? new ContextEstimator()
    this.softThreshold =
      options?.softThreshold ??
      contextCompaction?.defaultSoftThreshold ??
      DEFAULT_CONTEXT_THRESHOLDS.softThreshold
    this.hardThreshold =
      options?.hardThreshold ??
      contextCompaction?.defaultHardThreshold ??
      DEFAULT_CONTEXT_THRESHOLDS.hardThreshold
    this.modelProfiles = modelContextProfilesFromConfig({
      contextCompaction,
      models: options?.models
    })
  }

  estimate(items: TurnItem[]): number {
    return this.estimator.estimateItems(items)
  }

  shouldCompact(items: TurnItem[], options?: CompactionTriggerOptions): boolean {
    return this.planCompaction(items, options) !== null
  }

  planCompaction(items: TurnItem[], options?: CompactionTriggerOptions): CompactionPlan | null {
    const thresholds = this.thresholds(options?.model)
    const frozenMessageCount = normalizeFrozenMessageCount(options?.frozenMessageCount, items.length)
    const compactableItems = frozenMessageCount > 0 ? items.slice(frozenMessageCount) : items
    // `overheadTokens` accounts for the system prompt and tool schemas that
    // are sent every turn but live outside the stored items. Without it the
    // estimate-only path (used when no provider usage count is available,
    // e.g. the first turn after a restart) systematically under-counts and
    // skips compaction. It is a floor on the estimate; the real
    // `promptTokens` still wins via the Math.max below when present.
    const overheadTokens = Math.max(0, Math.floor(options?.overheadTokens ?? 0))
    const estimatedTokens = this.estimate(compactableItems) + overheadTokens
    const reportedPromptTokens = typeof options?.promptTokens === 'number' ? options.promptTokens : undefined
    // Some providers over-report prompt_tokens by folding cumulative cache
    // reads into the per-request count. MiniMax-M3 was observed reporting up to
    // ~25x the real prompt size (prompt_cache_hit_tokens alone exceeded the
    // entire stored conversation, which is physically impossible). Trusting that
    // number pins the gauge at 100% and makes compaction fire pointlessly on a
    // context that is actually tiny. A request cannot really exceed our own
    // estimate of what we sent by a wide margin, so when the reported count
    // blows past it we distrust the provider and fall back to the estimate.
    const promptTokens = trustworthyPromptTokens(reportedPromptTokens, estimatedTokens, options?.model)
    const tokens = Math.max(estimatedTokens, promptTokens ?? 0)
    if (tokens < thresholds.softThreshold) return null
    const aggressiveThreshold = aggressiveCompactionThreshold(thresholds)
    const mode: CompactionMode =
      tokens >= thresholds.hardThreshold
        ? 'force'
        : tokens >= aggressiveThreshold
          ? 'aggressive'
          : 'normal'
    const source = promptTokens !== undefined && promptTokens >= estimatedTokens ? 'usage prompt_tokens' : 'estimated prompt tokens'
    const keepRecent = mode === 'force' ? 1 : mode === 'aggressive' ? 2 : 4
    return {
      mode,
      keepRecent,
      reason: `${source} ${tokens} reached ${mode} compaction threshold`
    }
  }

  /**
   * Compact the given history in place. Returns a new item list where
   * older items are replaced by a single `compaction` summary item.
   * The summary always lists the pinned constraints so they survive
   * even when the original text is removed.
   */
  compact(input: {
    threadId: string
    turnId: string
    history: TurnItem[]
    prefix: ImmutablePrefix
    budgetTokens?: number
    keepRecent?: number
    mode?: CompactionMode
    reason?: string
    summaryOverride?: string
    summaryItemId?: string
    frozenMessageCount?: number
    /** `false` marks a user-requested (`/compact`) compaction; omit for auto. */
    auto?: boolean
  }): {
    next: TurnItem[]
    summaryItem: TurnItem
    replacedTokens: number
  } {
    const frozenMessageCount = normalizeFrozenMessageCount(
      input.frozenMessageCount,
      input.history.length
    )
    const frozen = frozenMessageCount > 0 ? input.history.slice(0, frozenMessageCount) : []
    const history = trimTrailingToolCalls(input.history.slice(frozenMessageCount))
    const requestedKeepRecent = Math.max(0, input.keepRecent ?? 4)
    const keepRecent =
      history.length <= 1 ? history.length : Math.min(requestedKeepRecent, history.length - 1)
    if (history.length <= 1 || history.length - keepRecent <= 0) {
      return {
        next: [...frozen, ...history],
        summaryItem: makeCompactionItem({
          id: `compaction_${input.turnId}_noop`,
          turnId: input.turnId,
          threadId: input.threadId,
          summary: 'no compaction needed',
          replacedTokens: 0,
          pinnedConstraints: input.prefix.pinnedConstraints,
          auto: input.auto
        }),
        replacedTokens: 0
      }
    }
    const tailStart = keepRecent === 0
      ? history.length
      : repairTailStartForToolResults(history, history.length - keepRecent)
    const head = history.slice(0, tailStart)
    const tail = history.slice(tailStart)
    const replacedTokens = this.estimator.estimateItems(head)
    const sourceDigest = computeShortHash(compactedItemsDigestSource(head))
    const digestMarker = createToolDigestMarker(sourceDigest)
    const summaryBase = input.summaryOverride?.trim() || buildCompactionSummary({
      history,
      head,
      tail,
      prefix: input.prefix,
      reason: input.reason,
      mode: input.mode,
      budgetTokens: input.budgetTokens
    })
    const summary = appendDigestMarker(summaryBase, digestMarker)
    const summaryItem = makeCompactionItem({
      id: input.summaryItemId ?? `compaction_${input.turnId}_${Date.now()}`,
      turnId: input.turnId,
      threadId: input.threadId,
      summary,
      replacedTokens,
      pinnedConstraints: input.prefix.pinnedConstraints,
      auto: input.auto,
      sourceDigest,
      digestMarker,
      sourceItemIds: head.map((item) => item.id)
    })
    return { next: [...frozen, summaryItem, ...tail], summaryItem, replacedTokens }
  }

  /** Hard cap used by the loop to enforce an upper bound on the conversation. */
  hardCap(model?: string): number {
    return this.thresholds(model).hardThreshold
  }

  thresholds(model?: string): ModelContextThresholds {
    return contextThresholdsForModel(model, {
      softThreshold: this.softThreshold,
      hardThreshold: this.hardThreshold
    }, this.modelProfiles)
  }
}

export function trimTrailingToolCalls(history: TurnItem[]): TurnItem[] {
  let end = history.length
  while (end > 0) {
    const item = history[end - 1]
    if (item.kind !== 'tool_call') break
    end -= 1
  }
  return end === history.length ? history : history.slice(0, end)
}

function repairTailStartForToolResults(history: TurnItem[], start: number): number {
  const tailStart = Math.max(0, Math.min(history.length, start))
  const tail = history.slice(tailStart)
  if (!hasOrphanToolResult(tail)) return tailStart
  for (let index = tailStart - 1; index >= 0; index -= 1) {
    if (history[index].kind === 'user_message') return index > 0 ? index : tailStart
  }
  return tailStart
}

function hasOrphanToolResult(items: TurnItem[]): boolean {
  const callIds = new Set<string>()
  for (const item of items) {
    if (item.kind === 'tool_call') callIds.add(item.callId)
  }
  return items.some((item) => item.kind === 'tool_result' && !callIds.has(item.callId))
}

function aggressiveCompactionThreshold(thresholds: ModelContextThresholds): number {
  const span = Math.max(0, thresholds.hardThreshold - thresholds.softThreshold)
  return thresholds.softThreshold + Math.floor(span * 0.6)
}

const inflationWarnedAt = new Map<string, number>()
const INFLATION_WARN_INTERVAL_MS = 60_000

/**
 * Returns the provider `prompt_tokens` when it is consistent with our local
 * estimate, or `undefined` when it exceeds it by more than
 * `PROMPT_TOKEN_TRUST_FACTOR` (treated as a provider accounting artifact and
 * dropped so the estimate drives the decision instead).
 */
function trustworthyPromptTokens(
  reported: number | undefined,
  estimate: number,
  model?: string
): number | undefined {
  if (reported === undefined) return undefined
  if (estimate > 0 && reported > estimate * PROMPT_TOKEN_TRUST_FACTOR) {
    warnInflatedPromptTokens(reported, estimate, model)
    return undefined
  }
  return reported
}

function warnInflatedPromptTokens(reported: number, estimate: number, model?: string): void {
  const key = model || 'unknown'
  const now = Date.now()
  if (now - (inflationWarnedAt.get(key) ?? 0) < INFLATION_WARN_INTERVAL_MS) return
  inflationWarnedAt.set(key, now)
  console.warn(
    `[kun] ignoring inflated prompt_tokens for model "${key}": reported ${reported} vs local estimate ${estimate} ` +
      `(>${PROMPT_TOKEN_TRUST_FACTOR}x). Falling back to the estimate for context/compaction; the provider is likely ` +
      `summing cumulative cache reads into prompt_tokens.`
  )
}

function normalizeFrozenMessageCount(value: number | undefined, historyLength: number): number {
  if (value === undefined) return 0
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(historyLength, Math.floor(value)))
}

function appendDigestMarker(summary: string, digestMarker: string): string {
  const trimmed = summary.trim()
  if (trimmed.includes(digestMarker)) return trimmed
  return `${trimmed}\n\nCompaction digest marker: ${digestMarker}`
}

function buildCompactionSummary(input: {
  history: TurnItem[]
  head: TurnItem[]
  tail: TurnItem[]
  prefix: ImmutablePrefix
  reason?: string
  mode?: CompactionMode
  budgetTokens?: number
}): string {
  const contentBudget = summaryCharBudget(input.budgetTokens)
  const lines: string[] = []
  if (input.reason) {
    lines.push(`Reason: ${input.reason}`)
  }
  if (input.mode) {
    lines.push(`Mode: ${input.mode}`)
  }
  if (input.budgetTokens !== undefined) {
    lines.push(`Budget: ${input.budgetTokens} tokens`)
  }
  lines.push('Pinned constraints (preserved across compaction):')
  if (input.prefix.pinnedConstraints.length === 0) {
    lines.push('- (none)')
  } else {
    for (const pinned of input.prefix.pinnedConstraints) {
      lines.push(`- ${pinned}`)
    }
  }
  const skillPins = extractSkillPins(input.history)
  if (skillPins.length > 0) {
    lines.push('Pinned skills (preserved across compaction):')
    for (const skillPin of skillPins) {
      lines.push(`- ${skillPin}`)
    }
    lines.push('')
  }
  lines.push('')
  lines.push(
    `Summarized ${input.history.length} item(s); ${input.tail.length} recent item(s) are also kept verbatim for the current request.`
  )
  lines.push('Conversation and work summary:')
  const summaryLines = fitLinesToBudget(
    selectSummaryLines(input.history.map(summarizeItem).filter((line) => line.length > 0)),
    contentBudget
  )
  if (summaryLines.length === 0) {
    lines.push('- No user-visible content before compaction.')
  } else {
    lines.push(...summaryLines)
  }
  return lines.join('\n')
}

function extractSkillPins(history: TurnItem[]): string[] {
  const pins = new Set<string>()
  for (const item of history) {
    if (item.kind !== 'assistant_text' && item.kind !== 'user_message' && item.kind !== 'compaction') continue
    const text = item.kind === 'compaction' ? item.summary : item.text
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (/^(Active Skill:|Skill Pin:|Pinned Skill:)/i.test(trimmed)) {
        pins.add(clipText(trimmed, 600))
      }
    }
  }
  return [...pins]
}

function summaryCharBudget(budgetTokens: number | undefined): number {
  if (budgetTokens === undefined) return 4_000
  return Math.max(1_200, Math.min(12_000, budgetTokens * 4))
}

function summarizeItem(item: TurnItem): string {
  switch (item.kind) {
    case 'user_message':
      return `- User: ${clipText(item.text)}`
    case 'assistant_text':
      return `- Assistant: ${clipText(item.text)}`
    case 'assistant_reasoning':
      return ''
    case 'tool_call':
      return `- Tool call ${item.toolName}: ${clipText(item.summary || stringifyCompact(item.arguments))}`
    case 'tool_result':
      return `- Tool result ${item.toolName}${item.isError ? ' error' : ''}: ${clipText(stringifyCompact(item.output))}`
    case 'approval':
      return `- Approval ${item.status} for ${item.toolName}: ${clipText(item.summary)}`
    case 'user_input':
      return `- User input ${item.status}: ${clipText(item.prompt)}`
    case 'compaction':
      return item.replacedTokens > 0
        ? `- Earlier compaction summary: ${clipText(item.summary, 600)}`
        : ''
    case 'review':
      return `- Review ${item.title}: ${clipText(item.reviewText || stringifyCompact(item.output))}`
    case 'error':
      return `- Error${item.code ? ` ${item.code}` : ''}: ${clipText(item.message)}`
  }
}

function selectSummaryLines(lines: string[]): string[] {
  if (lines.length <= 20) return lines
  const start = lines.slice(0, 4)
  const end = lines.slice(-14)
  return [
    ...start,
    `- ${lines.length - start.length - end.length} middle item(s) omitted from this compact summary.`,
    ...end
  ]
}

function fitLinesToBudget(lines: string[], budget: number): string[] {
  const out: string[] = []
  let used = 0
  for (const line of lines) {
    const nextCost = line.length + 1
    if (used + nextCost <= budget) {
      out.push(line)
      used += nextCost
      continue
    }
    const remaining = budget - used
    if (remaining > 80) out.push(clipText(line, remaining))
    break
  }
  return out
}

function stringifyCompact(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function clipText(text: string, max = 360): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.length <= max) return compact
  return `${compact.slice(0, Math.max(0, max - 3)).trim()}...`
}
