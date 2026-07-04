import type { TurnItem } from '../../contracts/items.js'

/**
 * 事实锚点状态生命周期：
 * - `tentative`：助手提出但用户尚未确认
 * - `confirmed`：双方明确同意
 * - `overridden`：后续信息覆盖
 *
 * 解决 Issue #247：长对话中的上下文漂移。
 */
export type FactAnchorStatus = 'tentative' | 'confirmed' | 'overridden'

export type FactAnchorCategory = 'decision' | 'assumption' | 'constraint' | 'conclusion' | 'preference'

/**
 * 单个事实锚点：一条已确认的决策、假设或结论。
 * 在压缩后存活，为模型提供稳定的引用点。
 */
export type FactAnchor = {
  id: string
  timestamp: string
  sourceTurnId: string
  statement: string
  status: FactAnchorStatus
  category: FactAnchorCategory
  overriddenBy?: string
}

export type FactAnchorExtractOptions = {
  maxAnchors?: number
  minStatementLength?: number
}

const DEFAULT_MAX_ANCHORS = 48
const DEFAULT_MIN_STATEMENT_LENGTH = 6

// ---------------------------------------------------------------------------
// 提取规则 — 双语（中文 + English）
// ---------------------------------------------------------------------------

const CONFIRMATION_PATTERNS: ReadonlyArray<{
  regex: RegExp
  group?: number
  category: FactAnchorCategory
}> = [
  // --- English ---
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

  // --- Chinese ---
  { regex: /^(?:确认|同意|好的|没问题|就这么定了|确定|已确认|同意这个方案)[:：]?\s*(.+)/im, group: 1, category: 'decision' },
  { regex: /^(?:假设|假定|前提是|我们假设|假设条件)[:：]?\s*(.+)/im, group: 1, category: 'assumption' },
  { regex: /^(?:约束|限制|要求|必须|不能|不要|务必)[:：]?\s*(.+)/im, group: 1, category: 'constraint' },
  { regex: /^(?:结论是|所以|因此|综上|总结|得出结论)[:：]?\s*(.+)/im, group: 1, category: 'conclusion' },
  { regex: /^(?:我更希望|我偏好|我喜欢|最好是|优先)[:：]?\s*(.+)/im, group: 1, category: 'preference' },
]

const USER_CONFIRMATION_PATTERNS: ReadonlyArray<RegExp> = [
  /^(?:yes|yeah|yep|sure|ok|okay|fine|good|agreed|confirm(?:ed)?|sounds good|that works|correct|right)\b/i,
  /^(?:是的|对|对的|好|好的|行|可以|没问题|同意|确认|就这么定|就这么办|没错|正确)\b/,
]

const OVERRIDE_PATTERNS: ReadonlyArray<RegExp> = [
  /^(?:actually|wait|hold on|on second thought|correction|scratch that|never mind)\b/i,
  /\bchange(?:d)?\s+(?:my|our|the)\s+(?:mind|plan|approach|decision)\b/i,
  /\b(?:instead|rather than)\s+/i,
  /^(?:不对|不是|等等|等一下|修正一下|更正|重新考虑|其实不是|改一下|换成|还是用)\b/,
]

// ---------------------------------------------------------------------------
// 质量评分
// ---------------------------------------------------------------------------

function statementQuality(statement: string): number {
  let score = 0.5

  if (/^(?:it|this|these|those|they|he|she)\b/i.test(statement)) {
    score -= 0.2
  }

  const wordCount = statement.split(/\s+/).length
  if (wordCount >= 5) score += 0.15
  if (wordCount >= 8) score += 0.1

  if (/[A-Z][a-z]{2,}/.test(statement)) score += 0.1

  const chineseChars = (statement.match(/[\u4e00-\u9fa5]/g) || []).length
  if (chineseChars >= 8) score += 0.1
  if (chineseChars >= 16) score += 0.05

  return Math.max(0, Math.min(1, score))
}

// ---------------------------------------------------------------------------
// 核心提取
// ---------------------------------------------------------------------------

/**
 * 从助手文本中提取决策语句，按质量排序。
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
      break
    }
  }

  return results.sort((a, b) => b.score - a.score)
}

/**
 * 从已完成的一轮对话中提取确认的事实锚点。
 *
 * 三级提取：
 * 1. 已确认锚点 — 助手决策 + 用户确认
 * 2. 暂定锚点 — 强助手声明但无显式用户确认（上限2条）
 * 3. 暂定锚点提升 — 前轮的暂定锚点在本轮被用户确认时提升为confirmed
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

  const combinedAssistantText = assistantTexts.join('\n')
  const candidates = extractDecisionStatements(combinedAssistantText).filter(
    (c) => c.score >= 0.5
  )

  const hasUserConfirmation = userTexts.some((text) =>
    USER_CONFIRMATION_PATTERNS.some((re) => re.test(text.trim()))
  )
  const hasOverride = userTexts.some((text) =>
    OVERRIDE_PATTERNS.some((re) => re.test(text.trim()))
  )

  const now = new Date().toISOString()
  const anchors: FactAnchor[] = []
  const seen = new Set<string>()

  // Tier 1: 已确认锚点（高置信度 + 用户确认）
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

  return anchors.slice(0, maxAnchors)
}

// ---------------------------------------------------------------------------
// 合并与格式化
// ---------------------------------------------------------------------------

/**
 * 合并新锚点到现有列表。
 *
 * 规则：
 * 1. 前轮的暂定锚点在本轮有同类confirmed锚点时提升为confirmed
 * 2. 去重相同语句
 * 3. 新锚点含override信号时覆盖匹配的已有锚点
 */
export function mergeFactAnchors(
  existing: readonly FactAnchor[],
  newAnchors: readonly FactAnchor[]
): FactAnchor[] {
  const result: FactAnchor[] = [...existing]

  for (const anchor of newAnchors) {
    const newStatement = anchor.statement.toLowerCase()

    // Override检测 — 状态已在 extractFactAnchorsFromTurn 中从用户文本判断
    const isOverride = anchor.status === 'overridden'
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

    // 提升 tentative → confirmed
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

    // 去重
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
 * 格式化事实锚点为context instruction文本。
 *
 * 注入到context instructions而非system prompt，
 * 以保持ImmutablePrefix的cache fingerprint不变。
 */
export function formatFactAnchors(anchors: readonly FactAnchor[]): string {
  if (anchors.length === 0) return ''

  const confirmed = anchors.filter((a) => a.status === 'confirmed')
  const tentative = anchors.filter((a) => a.status === 'tentative')
  const overridden = anchors.filter((a) => a.status === 'overridden')

  const lines: string[] = [
    '## Confirmed Facts',
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

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function extractKeywords(statement: string): string[] {
  const keywords: string[] = []

  const englishWords = statement.match(/\b[a-zA-Z]{4,}\b/g)
  if (englishWords) {
    for (const w of englishWords) {
      keywords.push(w.toLowerCase())
    }
  }

  const chineseChunks = statement.match(/[\u4e00-\u9fa5]{2,}/g) || []
  for (const chunk of chineseChunks) {
    keywords.push(chunk)
  }

  return keywords
}

function cleanStatement(raw: string): string {
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/[,;:]\s*$/, '')
  cleaned = cleaned.replace(/\s+/g, ' ')
  cleaned = cleaned.replace(/^[-*•]\s+/, '')
  cleaned = cleaned.replace(/^\d+\.\s+/, '')
  if (cleaned.length > 0 && /[a-zA-Z]/.test(cleaned[0]!)) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  }
  if (cleaned.length > 0 && !/[.!?。！？]$/.test(cleaned) && /[a-zA-Z]/.test(cleaned)) {
    cleaned += '.'
  }
  return cleaned.trim()
}
