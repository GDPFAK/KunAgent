import { z } from 'zod'
import { ModelReasoningEffort, SubagentToolPolicy } from './capabilities.js'
import { getRoleSystemPrompt } from '../prompt/role-prompts.js'

/**
 * First-party agent role identifiers.
 *
 * Each role is a named persona with its own model, system prompt, tool policy,
 * and reasoning effort. The values are stable across the runtime lifecycle and
 * match the `roles` config section in `KunConfig`.
 */
export const AGENT_ROLE_IDS = [
  'coder',
  'planner',
  'reviewer',
  'researcher',
  'title',
  'summarizer',
  'explore'
] as const

export type AgentRoleId = (typeof AGENT_ROLE_IDS)[number]

/** Checks whether a string is a known AgentRoleId. */
export function isAgentRoleId(value: string): value is AgentRoleId {
  return (AGENT_ROLE_IDS as readonly string[]).includes(value)
}

/** Resolved configuration for a single agent role after merging layers. */
export const AgentRoleConfig = z
  .object({
    /** Display name (falls back to id). */
    name: z.string().min(1).optional(),
    /** When-to-use description shown in GUI. */
    description: z.string().min(1).optional(),
    /** UI accent color (hex). */
    color: z.string().min(1).optional(),
    /** Model id for this role. When absent, inherit the runtime default. */
    model: z.string().min(1).optional(),
    /** Provider routing hint. When absent, use the runtime default provider. */
    providerId: z.string().min(1).optional(),
    /**
     * Full system prompt for this role. When `omitBasePrompt` is false (default),
     * this is appended after the base prompt. When true, this replaces the base
     * prompt entirely.
     */
    systemPrompt: z.string().min(1).optional(),
    /** When true, `systemPrompt` replaces (not appends to) the base prompt. */
    omitBasePrompt: z.boolean().default(false),
    /**
     * Tool access policy. `inherit` follows the main agent's tools + approval
     * policy; `readOnly` restricts to investigation tools. An explicit
     * `allowedTools` array further narrows the set.
     */
    toolPolicy: SubagentToolPolicy.default('inherit'),
    /** Explicit tool allow-list (overrides toolPolicy when set). */
    allowedTools: z.array(z.string().min(1)).optional(),
    /** Tool deny-list layered on top of toolPolicy. */
    blockedTools: z.array(z.string().min(1)).optional(),
    /** MCP server ids blocked for this role. */
    blockedMcpServers: z.array(z.string().min(1)).optional(),
    /** Skill ids blocked for this role. */
    blockedSkills: z.array(z.string().min(1)).optional(),
    /** Reasoning depth for this role's model requests. Default 'off'. */
    reasoningEffort: ModelReasoningEffort.default('off'),
    /** Output token cap. Absent = runtime default. */
    maxTokens: z.number().int().positive().optional()
  })
  .strict()
export type AgentRoleConfig = z.infer<typeof AgentRoleConfig>

/**
 * Agent role registry interface.
 *
 * Implementations merge role definitions from three layers:
 * 1. Built-in defaults
 * 2. User config (`roles` section in `config.json`)
 * 3. Workspace overlay (`.kun/agents/*.md`)
 *
 * Every lookup returns a fully resolved `AgentRoleConfig` — all optional fields
 * are filled with the layer-chain's best value. A lookup for an unknown id
 * MUST return `undefined` (never throw), letting callers fall back to the
 * default role.
 */
export interface AgentRoleRegistry {
  /** Return the fully merged config for a role id, or `undefined` if unknown. */
  get(id: AgentRoleId): AgentRoleConfig | undefined

  /** Return all known role ids. */
  ids(): AgentRoleId[]

  /** Return all resolved role entries (id + config). */
  entries(): Array<{ id: AgentRoleId; config: AgentRoleConfig }>

  /** Return the default role id (usually 'coder'). */
  defaultId(): AgentRoleId
}

/** Built-in default role configurations, populated with role-specific system prompts. */
export function builtinRoleConfigs(): Record<AgentRoleId, AgentRoleConfig> {
  return {
    coder: {
      toolPolicy: 'inherit',
      omitBasePrompt: false,
      reasoningEffort: 'high',
      color: '#3b82d8',
      description: '主力编码代理，拥有完整工具集，处理代码编写、重构、调试等任务',
      systemPrompt: getRoleSystemPrompt('coder')
    },
    planner: {
      toolPolicy: 'inherit',
      omitBasePrompt: false,
      reasoningEffort: 'high',
      color: '#7f77dd',
      description: '任务规划代理，将复杂任务分解为子任务 DAG 并编排执行',
      systemPrompt: getRoleSystemPrompt('planner')
    },
    reviewer: {
      toolPolicy: 'readOnly',
      omitBasePrompt: false,
      reasoningEffort: 'high',
      color: '#e8943a',
      description: '代码审查代理，以只读方式检查代码质量与安全性',
      systemPrompt: getRoleSystemPrompt('reviewer')
    },
    researcher: {
      toolPolicy: 'readOnly',
      omitBasePrompt: false,
      reasoningEffort: 'off',
      color: '#1d9e75',
      description: '调研代理，搜索文件与网络，回答关于代码库的问题',
      systemPrompt: getRoleSystemPrompt('researcher')
    },
    title: {
      toolPolicy: 'readOnly',
      omitBasePrompt: true,
      reasoningEffort: 'off',
      color: '#d4537e',
      maxTokens: 80,
      description: '会话标题生成代理，使用最小模型',
      systemPrompt: getRoleSystemPrompt('title')
    },
    summarizer: {
      toolPolicy: 'readOnly',
      omitBasePrompt: true,
      reasoningEffort: 'off',
      color: '#7f77dd',
      description: '会话摘要代理，压缩长对话上下文',
      systemPrompt: getRoleSystemPrompt('summarizer')
    },
    explore: {
      toolPolicy: 'readOnly',
      omitBasePrompt: false,
      reasoningEffort: 'off',
      color: '#1d9e75',
      description: '快速只读探索代理，查找文件和搜索代码',
      systemPrompt: getRoleSystemPrompt('explore')
    }
  }
}

// Lazy-loaded proxy for backward compatibility — returns the same values
// as builtinRoleConfigs() but caches after first call.
let _builtinConfigsCache: Record<AgentRoleId, AgentRoleConfig> | undefined
export const BUILTIN_ROLE_CONFIGS: Record<AgentRoleId, AgentRoleConfig> = new Proxy(
  {} as Record<AgentRoleId, AgentRoleConfig>,
  {
    get(_, prop: string | symbol) {
      if (!_builtinConfigsCache) _builtinConfigsCache = builtinRoleConfigs()
      return _builtinConfigsCache[prop as AgentRoleId]
    }
  }
)
