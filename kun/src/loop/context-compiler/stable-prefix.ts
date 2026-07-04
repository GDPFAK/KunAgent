import type { ImmutablePrefix } from '../../cache/immutable-prefix.js'
import type { FactAnchor } from './fact-anchor.js'
import { formatFactAnchors } from './fact-anchor.js'

/**
 * 将ImmutablePrefix + 事实锚点编译为确定性文本块。
 *
 * Kun的ImmutablePrefix（cache/immutable-prefix.ts）已经处理了
 * systemPrompt/tools/pinnedConstraints/fewShots的fingerprint。
 * 此模块在其上叠加事实锚点维度，保持fingerprint不变。
 *
 * 解决 Issue #229：当没有任何前缀组件变化时，前缀块是字节一致的，
 * 可以由provider前缀缓存复用。
 */
export type StablePrefixComponents = {
  systemPrompt: string
  pinnedConstraints: readonly string[]
  factAnchors: readonly FactAnchor[]
}

export type StablePrefixBuildOptions = {
  includeFactAnchors?: boolean
  maxFactAnchors?: number
  includePinnedConstraints?: boolean
}

const DEFAULT_OPTIONS: Required<StablePrefixBuildOptions> = {
  includeFactAnchors: true,
  maxFactAnchors: 32,
  includePinnedConstraints: true,
}

/**
 * 从ImmutablePrefix + 事实锚点构建稳定前缀文本块。
 *
 * 这是一个bridge函数——它不替换ImmutablePrefix，
 * 而是在其之上包裹事实锚点意识。
 * 输出是确定性的：相同的输入 → 字节完全相同的输出。
 */
export function stablePrefixFromImmutable(
  immutable: ImmutablePrefix,
  factAnchors: readonly FactAnchor[] = [],
  options: StablePrefixBuildOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  return compilePrefixContent({
    systemPrompt: immutable.systemPrompt,
    pinnedConstraints: immutable.pinnedConstraints,
    factAnchors,
  }, opts)
}

// ---------------------------------------------------------------------------
// Compilation
// ---------------------------------------------------------------------------

function compilePrefixContent(
  components: StablePrefixComponents,
  options: Required<StablePrefixBuildOptions>
): string {
  const sections: string[] = []

  // Section 1: System prompt
  if (components.systemPrompt.trim()) {
    sections.push(components.systemPrompt.trim())
  }

  // Section 2: Pinned constraints
  if (options.includePinnedConstraints && components.pinnedConstraints.length > 0) {
    const lines = [
      '## Pinned Constraints',
      'The following constraints apply throughout the conversation:',
      '',
    ]
    for (const constraint of components.pinnedConstraints) {
      lines.push(`- ${constraint}`)
    }
    sections.push(lines.join('\n'))
  }

  // Section 3: 事实锚点
  // 注入为context instruction而非system prompt，
  // 保持ImmutablePrefix的cache fingerprint不变。
  if (options.includeFactAnchors && components.factAnchors.length > 0) {
    const anchorsToInclude =
      options.maxFactAnchors > 0
        ? components.factAnchors.slice(-options.maxFactAnchors)
        : components.factAnchors
    const anchorText = formatFactAnchors(anchorsToInclude)
    if (anchorText.trim()) {
      sections.push(anchorText.trim())
    }
  }

  return sections.join('\n\n').trim()
}
