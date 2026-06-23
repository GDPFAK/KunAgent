import type { TurnItem } from '../../contracts/items.js'

/**
 * Fact anchor status lifecycle:
 * - `tentative`: assistant stated a decision but user hasn't confirmed
 * - `confirmed`: explicitly agreed upon by both user and assistant
 * - `overridden`: later information supersedes this anchor
 */
export type FactAnchorStatus = 'tentative' | 'confirmed' | 'overridden'

/**
 * Anchor categories for grouping related facts.
 */
export type FactAnchorCategory = 'decision' | 'assumption' | 'constraint' | 'conclusion' | 'preference'

/**
 * A single fact anchor: a decision, assumption, or conclusion that has
 * been explicitly confirmed during the conversation. Anchors survive
 * compaction and provide stable reference points for the model,
 * preventing incremental-context drift in long conversations.
 *
 * Corresponds to GitHub Issue #247.
 */
export type FactAnchor = {
  id: string
  /** ISO timestamp when the anchor was created. */
  timestamp: string
  /** Which turn the anchor originated from. */
  sourceTurnId: string
  /** The factual statement, expressed as a short declarative sentence. */
  statement: string
  /** Confirmation status. */
  status: FactAnchorStatus
  /** Category for grouping related anchors. */
  category: FactAnchorCategory
  /** Optional ID of the anchor that overrides this one (when status=overridden). */
  overriddenBy?: string
}

export type FactAnchorExtractOptions = {
  /** Maximum number of anchors to keep (most recent first). */
  maxAnchors?: number
  /** Minimum statement length (in characters) to qualify as an anchor. */
  minStatementLength?: number
}

const DEFAULT_MAX_ANCHORS = 48
const DEFAULT_MIN_STATEMENT_LENGTH = 6

// ---------------------------------------------------------------------------
// Extraction patterns — bilingual (Chinese + English)
// ---------------------------------------------------------------------------

/**
 * Decision/confirmation patterns. Each pattern has a regex, an optional
 * capture group index, and a category.
 *
 * These are intentionally conservative: it's better to miss an anchor
 * than to hallucinate one. The cost of a false positive (confusing the
 * model with a non-fact) is higher than a false negative (missing a
 * real fact, which the model can re-derive from conversation context).
 */
const CONFIRMATION_PATTERNS: ReadonlyArray<{
  regex: RegExp
  group?: number
  category: FactAnchorCategory
}> = [
  // --- English patterns (with optional trailing punctuation) ---
  { regex: /^(?:I|we|you|let'?s)\s+(?:will|shall|should|agree|decided|confirm(?:ed)?)\s+that\s+(.+)\s*$/i, group: 1, category: 'decision' },
  { regex: /^(?:I|we)\s+confirm(?:ed)?\s+(.+)\s*$/i, group: 1, category: 'decision' },
  { regex: /^(?:the|this)\s+(?:plan|approach|strategy|decision|assumption)\s+(?:is|was|will be)\s+(.+)\s*$/i, group: 1, category: 'decision' },
  { regex: /^so\s+(?:we|I|you)\s+(?:can|will|should|need to)\s+(.+)\s*$/i, group: 1, category: 'decision' },
  { regex: /^agreed:\s*(.+)\s*$/i, group: 1, category: 'decision' },
  { regex: /^confirmed:\s*(.+)\s*$/i, group: 1, category: 'decision' },
  { regex: /^we\s+agreed?\s+(?:that\s+)?(.+)\s*$/i, group: 1, category: 'decision' },
  { regex: /^final(?:ized)?\s+(?:decision|plan|answer):\s*(.+)\s*$/i, group: 1, category: 'decision' },
  { regex: /^to\s+summarize[,:]\s*(.+)\s*$/i, group: 1, category: 'conclusion' },
  { regex: /^in\s+summary[,:]\s*(.+)\s*$/i, group: 1, category: 'conclusion' },
  { regex: /^(?:assuming|assume|given)\s+that\s+(.+)\s*$/i, group: 1, category: 'assumption' },
  { regex: /^(?:let's|let us)\s+assume\s+(.+)\s*$/i, group: 1, category: 'assumption' },
  { regex: /^working\s+hypothesis:\s*(.+)\s*$/i, group: 1, category: 'assumption' },
  { regex: /^(?:I prefer|I'd rather|I like|Better to|Preferably)[:：]?\s*(.+)/im, group: 1, category: 'preference' },
  { regex: /^(?:Constraint|Requirement|Must|Never|Do not)[:：]?\s*(.+)/im, group: 1, category: 'constraint' },
  { regex: /^(?:Conclusion|Therefore|Thus)[:：]?\s*(.+)/im, group: 1, category: 'conclusion' },

  // --- Chinese patterns ---
  { regex: /^(?:确认|同意|好的|没问题|就这么定了|确定|已确认|同意这个方案)[:：]?\s*(.+)/im, group: 1, category: 'decision' },
  { regex: /^(?:假设|假定|前提是|我们假设|假设条件)[:：]?\s*(.+)/im, group: 1, category: 'assumption' },
  { regex: /^(?:约束|限制|要求|必须|不能|不要|务必)[:：]?\s*(.+)/im, group: 1, category: 'constraint' },
  { regex: /^(?:结论是|所以|因此|综上|总结|得出结论)[:：]?\s*(.+)/im, group: 1, category: 'conclusion' },
  { regex: /^(?:我更希望|我偏好|我喜欢|最好是|优先)[:：]?\s*(.+)/im, group: 1, category: 'preference' },
]

/**
 * Patterns that indicate user confirmation of an assistant proposal.
 */
const USER_CONFIRMATION_PATTERNS: ReadonlyArray<RegExp> = [
  // English
  /^(?:yes|yeah|yep|sure|ok|okay|fine|good|agreed|confirm(?:ed)?|sounds good|that works|correct|right)\b/i,
  // Chinese
  /^(?:是的|对|对的|好|好的|行|可以|没问题|同意|确认|就这么定|就这么办|没错|正确)\b/,
]

/**
 * Patterns that override or contradict earlier facts.
 */
const OVERRIDE_PATTERNS: ReadonlyArray<RegExp> = [
  // English
  /^(?:actually|wait|hold on|wait a second|on second thought|correction|scratch that|never mind)\b/i,
  /\bchange(?:d)?\s+(?:my|our|the)\s+(?:mind|plan|approach|decision)\b/i,
  /\b(?:instead|rather than)\s+/i,
  // Chinese
  /^(?:不对|不是|等等|等一下|修正一下|更正|重新考虑|其实不是|不对应该是|改一下|换成|还是用)\b/,
]

// ---------------------------------------------------------------------------
// Statement quality scoring
// ---------------------------------------------------------------------------

/**
 * Score a candidate statement's quality on a 0–1 scale.
 * Penalizes vague pronouns, rewards concrete multi-word statements.
 */
function statementQuality(statement: string): number {
  let score = 0.5

  // Penalize statements that start with vague pronouns.
  if (/^(?:it|this|these|those|they|he|she)\b/i.test(statement)) {
    score -= 0.2
  }

  // Reward concrete, multi-word statements
  const wordCount = statement.split(/\s+/).length
  if (wordCount >= 5) score += 0.15
  if (wordCount >= 8) score += 0.1

  // Reward statements with technical/specific terms (capitalized nouns)
  if (/[A-Z][a-z]{2,}/.test(statement)) score += 0.1

  // Reward Chinese statements with enough characters
  const chineseChars = (statement.match(/[一-龥]/g) || []).length
  if (chineseChars >= 8) score += 0.1
  if (chineseChars >= 16) score += 0.05

  return Math.max(0, Math.min(1, score))
}

// ---------------------------------------------------------------------------
// Core extraction
// ---------------------------------------------------------------------------

type ExtractedCandidate = {
  statement: string
  category: FactAnchorCategory
  score: number
}

/**
 * Extract decision statements from assistant text using heuristic patterns.
 * Returns candidates sorted by quality score (highest first).
 */
export function extractDecisionStatements(
  text: string
): Array<{ statement: string; category: FactAnchorCategory; score: number }> {
  const results: Array<{ statement: string; category: FactAnchorCategory; score: number }> = []
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0)

  for (const line of lines) {
    for (const { regex, group, category } of CONFIRMATION_PATTERNS) {
      const match = line.match(regex)
      if (!match) continue

      const captured = group !== undefined ? (match[group] ?? '') : match[0] ?? ''
      const statement = cleanStatement(captured)
      if (statement.length < DEFAULT_MIN_STATEMENT_LENGTH) continue

      const quality = statementQuality(statement)
      if (quality <= 0) continue

      results.push({ statement, category, score: quality })
      break // one match per line
    }
  }

  return results.sort((a, b) => b.score - a.score)
}

/**
 * Extract confirmed fact anchors from a completed turn.
 *
 * Three extraction tiers:
 * 1. **Confirmed anchors**: assistant decision + user confirmation
 * 2. **Tool-result anchors**: short, decision-bearing tool outputs (max 2/turn)
 * 3. **Tentative anchors**: strong assistant statements without explicit
 *    user confirmation (max 2/turn)
 *
 * Tentative anchors from previous turns are promoted to `confirmed`
 * when the user later confirms them in the current turn.
 */
export function extractFactAnchorsFromTurn(
  turnItems: TurnItem[],
  options: FactAnchorExtractOptions = {}
): FactAnchor[] {
  const maxAnchors = options.maxAnchors ?? DEFAULT_MAX_ANCHORS
  const minLength = options.minStatementLength ?? DEFAULT_MIN_STATEMENT_LENGTH

  const turnId = turnItems[0]?.turnId ?? ''
  if (!turnId || turnItems.length === 0) return []

  const assistantTexts = turnItems
    .filter((item): item is Extract<TurnItem, { kind: 'assistant_text' }> =>
      item.kind === 'assistant_text'
    )
    .map((item) => item.text)

  const userTexts = turnItems
    .filter((item): item is Extract<TurnItem, { kind: 'user_message' }> =>
      item.kind === 'user_message'
    )
    .map((item) => item.text)

  const toolResults = turnItems
    .filter((item): item is Extract<TurnItem, { kind: 'tool_result' }> =>
      item.kind === 'tool_result'
    )
    .map((item) => ({ toolName: item.toolName, output: item.output, isError: item.isError }))

  // Extract candidates from assistant text
  const combinedAssistantText = assistantTexts.join('\n')
  const candidates = extractDecisionStatements(combinedAssistantText).filter(
    (c) => c.score >= 0.5
  )

  // Determine user signals
  const hasUserConfirmation = userTexts.some((text) =>
    USER_CONFIRMATION_PATTERNS.some((re) => re.test(text.trim()))
  )
  const hasOverride = userTexts.some((text) =>
    OVERRIDE_PATTERNS.some((re) => re.test(text.trim()))
  )

  // Build anchors
  const now = new Date().toISOString()
  const anchors: FactAnchor[] = []
  const seen = new Set<string>()

  // Tier 1: Confirmed anchors (high-confidence + user confirmation)
  for (const candidate of candidates) {
    const key = candidate.statement.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const isHighConfidence = candidate.score >= 0.7
    const status: FactAnchorStatus =
      hasOverride ? 'overridden'
      : (isHighConfidence && hasUserConfirmation) ? 'confirmed'
      : 'tentative'

    anchors.push({
      id: `anchor_${turnId}_${anchors.length}`,
      timestamp: now,
      sourceTurnId: turnId,
      statement: candidate.statement,
      status,
      category: candidate.category,
    })
  }

  // Tier 2: Tool-result anchors (max 2)
  let toolAnchorCount = 0
  for (const result of toolResults) {
    if (result.isError) continue
    if (toolAnchorCount >= 2) break

    const outputStr = typeof result.output === 'string'
      ? result.output
      : JSON.stringify(result.output)
    if (outputStr.length > 2000) continue

    const explicitMatches = outputStr.match(/^(?:decision|conclusion|result|answer):\s*(.+)\s*$/im)
    if (explicitMatches && explicitMatches[1]) {
      const statement = cleanStatement(explicitMatches[1])
      if (statement.length < minLength) continue

      const key = statement.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)

      anchors.push({
        id: `anchor_${turnId}_tool_${toolAnchorCount}`,
        timestamp: now,
        sourceTurnId: turnId,
        statement,
        status: hasOverride ? 'overridden' : 'confirmed',
        category: 'decision',
      })
      toolAnchorCount++
    }
  }

  return anchors.slice(0, maxAnchors)
}

// ---------------------------------------------------------------------------
// Merging & formatting
// ---------------------------------------------------------------------------

/**
 * Merge new anchors into an existing anchor list.
 *
 * Rules:
 * 1. Tentative anchors from previous turns are promoted to `confirmed`
 *    when a new anchor with similar content is confirmed.
 * 2. Duplicate statements are skipped.
 * 3. When a new anchor contains an override signal, existing anchors
 *    with matching topic keywords are marked as `overridden`.
 * 4. Simple word-overlap similarity (threshold 0.6) detects related anchors
 *    for status promotion.
 */
export function mergeFactAnchors(
  existing: readonly FactAnchor[],
  newAnchors: readonly FactAnchor[]
): FactAnchor[] {
  const result: FactAnchor[] = [...existing]

  for (const anchor of newAnchors) {
    const newStatement = anchor.statement.toLowerCase()

    // Check for overrides — when a new anchor carries an override signal,
    // mark confirmed anchors from previous turns as overridden.
    // Uses broad topic overlap (any keyword match > 0) for targeting,
    // but if no specific target is found, overrides the most recent
    // confirmed anchor (the override signal is a direction change).
    const isOverride = OVERRIDE_PATTERNS.some((re) => re.test(anchor.statement))
    if (isOverride) {
      let foundTarget = false
      for (let i = result.length - 1; i >= 0; i--) {
        const existingAnchor = result[i]
        if (existingAnchor.status !== 'confirmed' && existingAnchor.status !== 'tentative') continue
        if (existingAnchor.sourceTurnId === anchor.sourceTurnId) continue

        const sim = statementSimilarity(existingAnchor.statement.toLowerCase(), newStatement)
        if (sim > 0) {
          result[i] = { ...existingAnchor, status: 'overridden', overriddenBy: anchor.id }
          foundTarget = true
        }
      }
      // Fallback: if no topic match found, override the most recent confirmed anchor
      if (!foundTarget) {
        for (let i = result.length - 1; i >= 0; i--) {
          const existingAnchor = result[i]
          if (existingAnchor.status !== 'confirmed') continue
          if (existingAnchor.sourceTurnId === anchor.sourceTurnId) continue
          result[i] = { ...existingAnchor, status: 'overridden', overriddenBy: anchor.id }
          break
        }
      }
    }

    // Promote tentative → confirmed for matching topics
    if (anchor.status === 'confirmed') {
      for (let i = 0; i < result.length; i++) {
        const existingAnchor = result[i]
        if (existingAnchor.status !== 'tentative') continue
        if (existingAnchor.sourceTurnId === anchor.sourceTurnId) continue
        if (existingAnchor.category !== anchor.category) continue

        const sim = statementSimilarity(
          existingAnchor.statement.toLowerCase(),
          newStatement
        )
        if (sim > 0.5) {
          result[i] = { ...existingAnchor, status: 'confirmed' }
        }
      }
    }

    // Dedup: skip identical statements
    const isDuplicate = result.some(
      (existing) => existing.statement.toLowerCase() === newStatement
    )
    if (!isDuplicate) {
      result.push(anchor)
    }
  }

  return result
}

/**
 * Simple word-overlap similarity between two statements.
 * Words shorter than 3 characters are excluded from comparison.
 * Chinese characters are treated as individual "words".
 */
function statementSimilarity(a: string, b: string): number {
  const wordsA = extractKeywords(a)
  const wordsB = extractKeywords(b)

  if (wordsA.length === 0 && wordsB.length === 0) return 0
  if (wordsA.length === 0 || wordsB.length === 0) return 0

  const setA = new Set(wordsA)
  const setB = new Set(wordsB)

  let shared = 0
  for (const w of setA) {
    if (setB.has(w)) shared++
  }

  return shared / Math.max(setA.size, setB.size)
}

/**
 * Extract meaningful keywords from a statement.
 * English: words > 3 characters. Chinese: 2-character chunks.
 */
function extractKeywords(statement: string): string[] {
  const keywords: string[] = []

  // English words
  const englishWords = statement.match(/\b[a-zA-Z]{4,}\b/g)
  if (englishWords) {
    for (const w of englishWords) {
      keywords.push(w.toLowerCase())
    }
  }

  // Chinese 2-char chunks
  const chineseChunks = statement.match(/[一-龥]{2,}/g) || []
  for (const chunk of chineseChunks) {
    keywords.push(chunk)
  }

  return keywords
}

/**
 * Format fact anchors as an XML block for injection into the system prompt.
 *
 * Confirmed anchors are listed first. Overridden anchors are listed
 * at the bottom for reference only.
 */
export function formatFactAnchors(anchors: readonly FactAnchor[]): string {
  if (anchors.length === 0) return ''

  const confirmed = anchors.filter((a) => a.status === 'confirmed')
  const tentative = anchors.filter((a) => a.status === 'tentative')
  const overridden = anchors.filter((a) => a.status === 'overridden')

  const lines: string[] = [
    '<fact-anchors>',
    'These are stable reference points from the conversation. Do not re-negotiate',
    'or re-question confirmed facts unless new evidence directly contradicts them.',
    '',
  ]

  if (confirmed.length === 0 && tentative.length === 0) {
    lines.push('(no confirmed facts yet)')
  } else {
    for (const anchor of [...confirmed, ...tentative]) {
      const prefix = anchor.status === 'tentative' ? '[tentative] ' : ''
      const cat = anchor.category
      lines.push(`- [${anchor.sourceTurnId}] [${cat}] ${prefix}${anchor.statement}`)
    }
  }

  if (overridden.length > 0) {
    lines.push('')
    lines.push('Overridden (superseded — for reference only, do not rely on these):')
    for (const anchor of overridden) {
      lines.push(
        `- [${anchor.sourceTurnId}] ${anchor.statement}` +
        `${anchor.overriddenBy ? ` (overridden by ${anchor.overriddenBy})` : ''}`
      )
    }
  }

  lines.push('</fact-anchors>')
  return lines.join('\n')
}

/**
 * Compute a deterministic fingerprint for a set of fact anchors.
 * Used for cache keying in stable prefix.
 */
export function fingerprintFactAnchors(anchors: readonly FactAnchor[]): string {
  const { createHash } = require('node:crypto') as typeof import('node:crypto')
  const source = anchors
    .filter((a) => a.status === 'confirmed')
    .map((a) => `${a.id}:${a.statement}:${a.status}`)
    .join('|')
  return createHash('sha256').update(source).digest('hex').slice(0, 16)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cleanStatement(raw: string): string {
  let cleaned = raw.trim()
  // Remove trailing list markers / punctuation artifacts
  cleaned = cleaned.replace(/[,;:]\s*$/, '')
  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, ' ')
  // Remove leading bullet/number markers
  cleaned = cleaned.replace(/^[-*•]\s+/, '')
  cleaned = cleaned.replace(/^\d+\.\s+/, '')
  // Capitalize first letter (English)
  if (cleaned.length > 0 && /[a-zA-Z]/.test(cleaned[0]!)) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  }
  // Add period if no terminal punctuation (English statements)
  if (cleaned.length > 0 && !/[.!?。！？]$/.test(cleaned) && /[a-zA-Z]/.test(cleaned)) {
    cleaned += '.'
  }
  return cleaned.trim()
}
