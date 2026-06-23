import type { TurnItem } from '../../contracts/items.js'

/**
 * Result of turn isolation: separates the conversation into
 * stable historical context and the current turn's active working set.
 *
 * The active working set is what the model sees as "the current
 * turn being worked on". Historical turns are managed by prefix
 * compaction and never re-flowed as active work, preventing old
 * keywords from leaking into current-turn thinking (Issue #155).
 */
export type TurnIsolationResult = {
  activeTurnItems: TurnItem[]
  historicalItems: TurnItem[]
  /** Unique identifier for the current turn boundary. */
  turnBoundaryId: string
  /** The turn ID of the current (active) turn. */
  currentTurnId: string
  /** Number of complete turns before the current one. */
  completedTurnCount: number
}

export type TurnIsolationOptions = {
  /**
   * When true, the most recent tool result from the preceding turn
   * is carried forward into the active set as a truncated summary,
   * giving the model continuity without re-importing full history.
   * Default: false (strict isolation).
   */
  keepRecentToolResultFromLastTurn?: boolean
}

const DEFAULT_OPTIONS: Required<TurnIsolationOptions> = {
  keepRecentToolResultFromLastTurn: false,
}

/**
 * Isolate the current turn from historical turns.
 *
 * Only items belonging to `currentTurnId` go into the active working set.
 * All other items are classified as historical. A boundary marker separates
 * them in the compiled context.
 *
 * This prevents two bugs:
 * 1. **Context leakage (#155)**: old tool results and assistant text from
 *    previous turns leak into the current turn's thinking.
 * 2. **O(n²) reprocessing (#229)**: every new message re-processes the
 *    entire conversation history as if it were all active.
 */
export function isolateCurrentTurn(
  items: TurnItem[],
  currentTurnId: string,
  options: TurnIsolationOptions = {}
): TurnIsolationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  if (items.length === 0) {
    return {
      activeTurnItems: [],
      historicalItems: [],
      turnBoundaryId: '',
      currentTurnId: '',
      completedTurnCount: 0,
    }
  }

  const activeItems: TurnItem[] = []
  const historicalItems: TurnItem[] = []

  // Identify all unique turn IDs in chronological order
  const turnOrder: string[] = []
  const seenTurns = new Set<string>()
  for (const item of items) {
    if (!seenTurns.has(item.turnId)) {
      seenTurns.add(item.turnId)
      turnOrder.push(item.turnId)
    }
  }

  const currentIdx = turnOrder.indexOf(currentTurnId)

  if (currentIdx < 0) {
    // Current turn ID not found — best-effort: treat last turn as active
    const lastTurnId = turnOrder[turnOrder.length - 1] ?? ''
    for (const item of items) {
      if (item.turnId === lastTurnId) {
        activeItems.push(item)
      } else {
        historicalItems.push(item)
      }
    }
    return {
      activeTurnItems: activeItems,
      historicalItems,
      turnBoundaryId: generateTurnBoundaryId(lastTurnId),
      currentTurnId: lastTurnId,
      completedTurnCount: Math.max(0, turnOrder.length - 1),
    }
  }

  // Partition by turnId
  for (const item of items) {
    if (item.turnId === currentTurnId) {
      activeItems.push(item)
    } else {
      historicalItems.push(item)
    }
  }

  // Optionally carry forward last tool result from previous turn
  if (opts.keepRecentToolResultFromLastTurn && currentIdx > 0) {
    const prevTurnId = turnOrder[currentIdx - 1]
    const prevItems = historicalItems.filter((item) => item.turnId === prevTurnId)
    const lastToolResult = [...prevItems]
      .reverse()
      .find(
        (item): item is Extract<TurnItem, { kind: 'tool_result' }> =>
          item.kind === 'tool_result' && !item.isError
      )

    if (lastToolResult) {
      const summaryResult = createToolResultSummary(lastToolResult)
      const historicalWithout = historicalItems.filter(
        (item) => item.id !== lastToolResult.id
      )
      return {
        activeTurnItems: [summaryResult, ...activeItems],
        historicalItems: historicalWithout,
        turnBoundaryId: generateTurnBoundaryId(currentTurnId),
        currentTurnId,
        completedTurnCount: currentIdx,
      }
    }
  }

  return {
    activeTurnItems: activeItems,
    historicalItems,
    turnBoundaryId: generateTurnBoundaryId(currentTurnId),
    currentTurnId,
    completedTurnCount: currentIdx,
  }
}

/**
 * Group items by their turn ID, preserving turn order.
 */
export function groupItemsByTurn(
  items: TurnItem[]
): Array<{ turnId: string; items: TurnItem[] }> {
  const turnOrder: string[] = []
  const turnMap = new Map<string, TurnItem[]>()

  for (const item of items) {
    if (!turnMap.has(item.turnId)) {
      turnOrder.push(item.turnId)
      turnMap.set(item.turnId, [])
    }
    turnMap.get(item.turnId)!.push(item)
  }

  return turnOrder.map((turnId) => ({ turnId, items: turnMap.get(turnId) ?? [] }))
}

/**
 * Find all unique turn IDs in chronological order.
 */
export function listTurnIds(items: TurnItem[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of items) {
    if (!seen.has(item.turnId)) {
      seen.add(item.turnId)
      result.push(item.turnId)
    }
  }
  return result
}

/**
 * Create a boundary marker item that sits between historical context
 * and the current turn's active working set.
 */
export function createTurnBoundaryMarker(turnId: string): TurnItem {
  return {
    id: `boundary_${turnId}`,
    turnId,
    threadId: '',
    role: 'system',
    status: 'completed',
    createdAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    kind: 'compaction',
    summary: `--- Turn boundary: current turn ${turnId} starts here ---`,
    replacedTokens: 0,
    pinnedConstraints: [],
  }
}

/**
 * Generate a deterministic turn boundary ID.
 * Used by the provider layer for prefix cache scoping.
 */
export function generateTurnBoundaryId(turnId: string): string {
  if (!turnId) return ''
  return `turn_bd_${turnId}`
}

/**
 * Verify that no items from previous turns leak into the active set.
 * Used in tests and debug validation.
 *
 * Items with `_carry` suffix in their ID are allowed (they are
 * summarized carry-forwards from the previous turn).
 */
export function verifyTurnIsolation(
  activeItems: TurnItem[],
  currentTurnId: string
): { valid: boolean; leakedTurns: string[] } {
  const leakedTurns = new Set<string>()
  for (const item of activeItems) {
    if (item.turnId !== currentTurnId && !item.id.endsWith('_carry')) {
      leakedTurns.add(item.turnId)
    }
  }
  return {
    valid: leakedTurns.size === 0,
    leakedTurns: [...leakedTurns].sort(),
  }
}

/**
 * Detect context leakage by scanning model output text for keywords
 * from historical turns. Returns matched keywords if any are found.
 *
 * This is a defense-in-depth check for Issue #155.
 */
export function detectContextLeakage(
  currentOutput: string,
  historicalKeywords: string[]
): { leaked: boolean; matchedKeywords: string[] } {
  if (historicalKeywords.length === 0) return { leaked: false, matchedKeywords: [] }

  const lowerOutput = currentOutput.toLowerCase()
  const matched = historicalKeywords.filter((kw) => {
    // Skip very short keywords (common words)
    if (kw.length < 5) return false
    return lowerOutput.includes(kw.toLowerCase())
  })

  return { leaked: matched.length > 0, matchedKeywords: matched }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createToolResultSummary(
  item: Extract<TurnItem, { kind: 'tool_result' }>
): TurnItem {
  const outputStr =
    typeof item.output === 'string' ? item.output : JSON.stringify(item.output)

  const summary =
    outputStr.length > 500
      ? `${outputStr.slice(0, 480)}... (truncated from previous turn)`
      : outputStr

  return {
    ...item,
    id: `${item.id}_carry`,
    output: summary,
  }
}
