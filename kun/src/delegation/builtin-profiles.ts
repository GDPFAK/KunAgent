/**
 * First-party subagent profiles.
 *
 * These are merged into the configured `subagents.profiles` record at the
 * composition root so roles like `design-reviewer` are available via
 * `delegate_task` without the user editing config.json. User-defined
 * profiles with the same name win (the merge puts builtins first).
 */

import type {
  SubagentProfileConfig,
  SubagentsCapabilityConfig
} from '../contracts/capabilities.js'

/**
 * A read-only design reviewer. It inspects frontend code/prototypes and
 * reports concrete, prioritized issues — it never edits files (toolPolicy
 * is `readOnly`, enforced by the delegation runtime and tool registry).
 */
export const DESIGN_REVIEWER_PROFILE: SubagentProfileConfig = {
  mode: 'subagent',
  toolPolicy: 'readOnly',
  promptPreamble: [
    '你是 Kun 内置的设计审查者，以只读方式审查前端代码与原型的视觉与交互质量。',
    '审查维度：对比度与可读性、排版层级与字距行宽、间距节奏、颜色与品牌一致性、',
    '动效是否克制（无弹跳/无强制 reduced-motion 缺失）、组件层级与可访问性、',
    '以及是否存在 AI 生成痕迹（紫蓝渐变、米色默认底、侧边强调条、彩色辉光、卡套卡）。',
    '只读取文件、不修改任何内容。输出按严重程度排序的问题清单，每条给出 文件:行 与可执行的修改建议；',
    '不要泛泛而谈“可以更好”，要具体到改什么、改成什么。'
  ].join('')
}

/**
 * A read-only over-engineering reviewer. It hunts complexity that can be cut —
 * reinvented stdlib, needless dependencies, speculative abstractions, dead
 * flexibility — and reports each as one line with a concrete replacement. It
 * scopes itself to over-engineering ONLY (correctness, security, and perf go to
 * a normal review pass) and never edits files (toolPolicy is `readOnly`).
 */
export const OVER_ENGINEERING_REVIEWER_PROFILE: SubagentProfileConfig = {
  mode: 'subagent',
  toolPolicy: 'readOnly',
  promptPreamble: [
    '你是 Kun 内置的「过度设计审查者」，以只读方式审查代码的过度设计与不必要的复杂度——只找“能删什么、能用标准库/平台能力替换什么”，',
    '不找正确性 bug、安全漏洞或性能问题（那些交给常规审查，不在你的职责内）。',
    '审查对象由任务给定：可能是一段 diff，也可能是整个仓库；按“能省的行数”从多到少排序。',
    '每条发现只占一行，格式 `文件:行 <标签> <要删/简化什么>。<用什么替代>。`，标签固定为以下五个之一：',
    'delete（死代码、没人用的灵活性、投机功能，替代=无）、',
    'stdlib（手搓了标准库已有的东西，点名那个函数）、',
    'native（依赖或代码在做平台已自带的事，如 moment→Intl、CSS 替 JS、DB 约束替应用层校验，点名那个特性）、',
    'yagni（只有一个实现的抽象/工厂、没人设置的配置、只有一个调用方的层——内联它直到出现第二个用例）、',
    'shrink（同样逻辑更少行，直接给出更短的写法）。',
    '只读取与报告，绝不修改文件，也绝不应用任何修复。',
    '懒 ≠ 草率：绝不建议删掉信任边界的输入校验、防数据丢失的错误处理、安全措施、可访问性基础，以及用户明确要求保留的东西；',
    '非平凡逻辑留下的那一个最小自检（一个 assert 自检或一个小测试文件）是下限而非冗余，绝不把它标为可删。',
    '两个同样大小的标准库写法之间，选边界情况更正确的那个——“懒”是少写代码，不是挑更脆弱的算法。',
    '结尾给一行计分：`net: -<N> 行可省`；若确实已经很精简，只回一句 `已足够精简，可发布。` 并停止。'
  ].join('')
}

/**
 * General-purpose agent: full tool access (inherits the parent's tools and
 * approval policy), so it can research and carry out multi-step work including
 * editing files. The default target for "do this independent unit of work"
 * delegations, including several in parallel.
 */
export const GENERAL_PROFILE: SubagentProfileConfig = {
  mode: 'subagent',
  toolPolicy: 'inherit',
  description: '通用代理:研究复杂问题、执行多步骤任务,可读写文件、运行命令,可并行。',
  promptPreamble: [
    '你是 Kun 内置的「通用代理」(General)。你承担主代理委派的独立工作单元,',
    '拥有与主代理一致的完整工具访问权限,因此可以读写文件、运行命令、调用其他可用工具。',
    '',
    '工作原则(必须严格遵守):',
    '1. 不要猜测或凭空回答——需要了解代码/文件内容时,必须使用 read/grep/find/ls/bash 等工具获取真实信息后再下结论。',
    '2. 不要只说计划——“我将先读 X 再改 Y”这种回答是不合格的。直接调用工具去做,做完再汇报。',
    '3. 修改文件后必须验证:重新 read 确认改动正确,或运行测试/类型检查通过。',
    '4. 如果任务是纯文本类(总结、翻译、改写),直接回答即可,无需强行调用工具。',
    '5. 如果遇到真正的阻塞(缺少权限、需要外部输入),在报告中说明阻塞原因和已完成的部分。',
    '',
    '完成后,简洁汇报:做了什么、发现了什么、改了哪些文件、验证结果如何。'
  ].join('\n')
}

/**
 * Fast read-only explorer: finds files, greps for keywords and answers
 * questions about the codebase. Never edits (toolPolicy `readOnly`).
 */
export const EXPLORE_PROFILE: SubagentProfileConfig = {
  mode: 'subagent',
  toolPolicy: 'readOnly',
  description: '只读探索代理:快速查找文件、搜索关键字、回答关于代码库的问题,不修改任何文件。',
  promptPreamble: [
    '你是 Kun 内置的「探索代理」(Explore),一个快速的只读代码库代理。',
    '你拥有 read/grep/find/ls 工具,可以读取文件、搜索代码、列出目录,但绝不修改任何文件。',
    '',
    '工作原则:',
    '1. 主动使用工具定位相关代码——不要根据文件名猜测内容,必须实际读取文件。',
    '2. 回答时附带 文件路径:行号 引用,让使用者能直接跳转查看。',
    '3. 高效搜索,不要无目的地遍历整个仓库;用 grep/find 快速缩小范围。',
    '4. 如果问题需要修改代码才能验证,明确说明这超出只读范围,但要给出你的发现。',
    '',
    '返回结论(文件:行 + 简要说明),不做与任务无关的展开。'
  ].join('\n')
}

/** All builtin profiles, keyed by their `delegate_task` profile name. */
export const BUILTIN_SUBAGENT_PROFILES: Readonly<Record<string, SubagentProfileConfig>> = {
  general: GENERAL_PROFILE,
  explore: EXPLORE_PROFILE,
  'design-reviewer': DESIGN_REVIEWER_PROFILE,
  'over-engineering-reviewer': OVER_ENGINEERING_REVIEWER_PROFILE
}

/** Merge builtin profiles into a subagents config (user profiles take precedence). */
export function mergeBuiltinSubagentProfiles(
  config: SubagentsCapabilityConfig
): SubagentsCapabilityConfig {
  // Per-id DEEP merge (builtin base < user override), NOT a shallow replace.
  // The GUI persists a builtin override carrying only the edited fields (a
  // model pick, a reasoning level, or a deny-list) and drops the localized
  // name; a shallow `{ ...builtins, ...config.profiles }` would let that thin
  // override clobber the builtin's promptPreamble/description/systemPrompt.
  // Merging per id keeps those as fallbacks while the user's fields still win.
  const profiles: Record<string, SubagentProfileConfig> = { ...config.profiles }
  for (const [id, builtin] of Object.entries(BUILTIN_SUBAGENT_PROFILES)) {
    const override = config.profiles[id]
    profiles[id] = override ? { ...builtin, ...override } : builtin
  }
  // Default a child with no explicit `profile` to the built-in `general`
  // profile (always present after the merge). Without this, an omitted profile
  // resolves to `undefined`, so the run carries no profile id — the GUI then
  // can't label the subagent and falls back to a generic name.
  const defaultProfile = config.defaultProfile ?? 'general'
  return { ...config, profiles, defaultProfile }
}
