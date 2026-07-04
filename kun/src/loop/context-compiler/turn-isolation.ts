import type { TurnItem } from '../../contracts/items.js'

/**
 * 轮次隔离结果：将会话分为稳定历史上下文和当前轮次的活动工作集。
 *
 * 活动工作集是模型看到的"当前正在处理的轮次"。
 * 历史轮次由前缀压缩管理，不会作为活动工作重新流入，
 * 防止旧关键词泄漏到当前轮次思考中（Issue #155）。
 */
export type TurnIsolationResult = {
  activeTurnItems: TurnItem[]
  historicalItems: TurnItem[]
  /** 当前轮次边界的唯一标识 */
  turnBoundaryId: string
  /** 当前（活动）轮次的ID */
  currentTurnId: string
  /** 当前轮次之前完成的轮次数 */
  completedTurnCount: number
}

export type TurnIsolationOptions = {
  /**
   * 为true时，前一轮的最后一个工具结果会以摘要形式带入活动集，
   * 在不重新导入完整历史的情况下提供连续性。
   * 默认：false（严格隔离）。
   */
  keepRecentToolResultFromLastTurn?: boolean
}

const DEFAULT_OPTIONS: Required<TurnIsolationOptions> = {
  keepRecentToolResultFromLastTurn: false,
}

/**
 * 从历史轮次中隔离当前轮次。
 *
 * 仅属于 `currentTurnId` 的条目进入活动工作集。
 * 所有其他条目归类为历史条目。边界标记在编译上下文中分隔它们。
 *
 * 防止两类错误：
 * 1. 上下文泄漏（#155）：前轮的工具结果和助手文本泄漏到当前轮次
 * 2. O(n²) 重处理（#229）：每个新消息重复处理完整历史
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

  // 按时间顺序识别所有唯一的轮次ID
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

  // 按turnId分区
  for (const item of items) {
    if (item.turnId === currentTurnId) {
      activeItems.push(item)
    } else {
      historicalItems.push(item)
    }
  }

  // 可选：携带前一轮的最后一个工具结果
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
 * 按轮次ID分组条目，保持轮次顺序。
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
 * 按时间顺序查找所有唯一轮次ID。
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
 * 生成确定性的轮次边界ID。
 */
export function generateTurnBoundaryId(turnId: string): string {
  if (!turnId) return ''
  return `turn_bd_${turnId}`
}

/**
 * 验证活动集中没有来自前轮的条目泄漏。
 * ID以 `_carry` 结尾的条目允许存在（它们是前一轮的摘要携带）。
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
 * 扫描模型输出文本是否包含历史轮次的关键词，
 * 检测上下文泄漏。深度防御检查 Issue #155。
 */
export function detectContextLeakage(
  currentOutput: string,
  historicalKeywords: string[]
): { leaked: boolean; matchedKeywords: string[] } {
  if (historicalKeywords.length === 0) return { leaked: false, matchedKeywords: [] }

  const lowerOutput = currentOutput.toLowerCase()
  const matched = historicalKeywords.filter((kw) => {
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
