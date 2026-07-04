import type { TurnItem } from '../../contracts/items.js'
import type {
  FactAnchor,
  FactAnchorExtractOptions,
} from './fact-anchor.js'
import {
  extractFactAnchorsFromTurn,
  mergeFactAnchors,
  formatFactAnchors,
} from './fact-anchor.js'

/**
 * 上下文编译器。
 *
 * 编排三个关注点，协同修复 Issue #247、#155、#229：
 *
 * 1. **事实锚点（#247）**：从每轮完成的对话中提取已确认的决策，
 *    注入到stable prefix，防止上下文漂移。
 *
 * 2. **轮次隔离（#155）**：将会话条目分区为历史和活动集，
 *    防止旧关键词泄漏到当前思考。
 *
 * 3. **稳定前缀（#229）**：构建确定性的前缀块，
 *    可由provider缓存，防止O(n²)重处理。
 *
 * 基础组件（systemPrompt/tools/pinnedConstraints/fewShots）
 * 仍由 `kun/src/cache/immutable-prefix.ts` 管理。
 * 本类在其上叠加事实锚点和轮次编译。
 *
 * 线程隔离：每个ContextCompiler实例绑定到一个线程。
 */
export class ContextCompiler {
  private anchors: FactAnchor[] = []
  private options: ContextCompilerOptions

  constructor(options: ContextCompilerOptions = {}) {
    this.options = options
  }

  // -----------------------------------------------------------------------
  // 事实锚点（#247）
  // -----------------------------------------------------------------------

  /**
   * 从已完成的轮次中提取事实锚点并合并。
   * 在每轮完成后调用。
   */
  extractAnchorsFromTurn(turnItems: TurnItem[]): FactAnchor[] {
    const newAnchors = extractFactAnchorsFromTurn(turnItems, this.options.factAnchor)
    if (newAnchors.length === 0) return []

    this.anchors = mergeFactAnchors(this.anchors, newAnchors)
    return newAnchors
  }

  /**
   * 从持久化的会话历史中加载事实锚点。
   * 从所有已完成的轮次中重新提取锚点。
   */
  loadAnchorsFromHistory(items: TurnItem[]): void {
    const turns = new Map<string, TurnItem[]>()
    for (const item of items) {
      if (!turns.has(item.turnId)) {
        turns.set(item.turnId, [])
      }
      turns.get(item.turnId)!.push(item)
    }

    this.anchors = []
    for (const [, turnItems] of turns) {
      const extracted = extractFactAnchorsFromTurn(turnItems, this.options.factAnchor)
      if (extracted.length > 0) {
        this.anchors = mergeFactAnchors(this.anchors, extracted)
      }
    }
  }

  /**
   * 获取所有当前事实锚点（用于诊断）。
   */
  getFactAnchors(): readonly FactAnchor[] {
    return this.anchors
  }

  // -----------------------------------------------------------------------
  // 上下文指令
  // -----------------------------------------------------------------------

  /**
   * 获取事实锚点文本，用于注入为context instruction。
   *
   * 注入到context instructions而非system prompt，
   * 以保持ImmutablePrefix的cache fingerprint不变。
   * 无锚点时返回空字符串。
   */
  getFactAnchorInstruction(): string {
    return formatFactAnchors(this.anchors)
  }

  /**
   * 格式化事实锚点用于显示/诊断。
   */
  formatAnchors(): string {
    return formatFactAnchors(this.anchors)
  }

  /**
   * 重置编译器状态（例如线程重置或清理时）。
   */
  reset(): void {
    this.anchors = []
  }
}

export type ContextCompilerOptions = {
  factAnchor?: FactAnchorExtractOptions
}
