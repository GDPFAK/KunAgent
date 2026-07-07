import {
  AgentRoleConfig,
  AgentRoleId,
  AgentRoleRegistry,
  builtinRoleConfigs,
  isAgentRoleId
} from '../contracts/agent-role.js'
import type { RolesConfig } from '../config/kun-config.js'
import { loadWorkspaceAgentProfiles } from './workspace-agents.js'

/**
 * Default agent role registry that merges role definitions from three layers:
 *
 *   1. **Built-in defaults** (`BUILTIN_ROLE_CONFIGS` in agent-role.ts)
 *   2. **User config** (`RolesConfig.agentRoles` in config.json)
 *   3. **Workspace overlay** (`.kun/agents/*.md` with `mode: primary` or `mode: all`)
 *
 * Layer 3 wins over layer 2, which wins over layer 1. Each layer deep-merges
 * per field rather than replacing the whole config, so the user can override
 * just `model` on the `coder` role while keeping everything else from builtins.
 *
 * The registry is created once per runtime start and cached. Workspace overlays
 * are loaded lazily on first access of a workspace-specific registry instance.
 */
export class KunAgentRoleRegistry implements AgentRoleRegistry {
  private constructor(
    private readonly builtins: Record<string, AgentRoleConfig>,
    private readonly configOverrides: Record<string, Partial<AgentRoleConfig>>,
    private readonly workspaceOverrides: Record<string, Partial<AgentRoleConfig>>
  ) {}

  /** Create a registry for the given config + workspace. */
  static async create(options: {
    config?: RolesConfig
    workspace?: string
  }): Promise<KunAgentRoleRegistry> {
    const configOverrides: Record<string, Partial<AgentRoleConfig>> = {}
    if (options.config?.agentRoles) {
      for (const [id, override] of Object.entries(options.config.agentRoles)) {
        configOverrides[id] = override
      }
    }

    const workspaceOverrides: Record<string, Partial<AgentRoleConfig>> = {}
    if (options.workspace) {
      const workspaceAgents = await loadWorkspaceAgentProfiles(options.workspace)
      for (const agent of workspaceAgents) {
        if (agent.profile.mode === 'primary' || agent.profile.mode === 'all') {
          // Map by workspace agent id (e.g. `.kun/agents/coder.md` → id: "coder")
          workspaceOverrides[agent.id] = {
            model: agent.profile.model,
            providerId: agent.profile.providerId,
            systemPrompt: agent.profile.systemPrompt,
            // Workspace agents with `systemPrompt` set implicitly opt out of base prompt
            omitBasePrompt: agent.profile.systemPrompt ? true : undefined,
            toolPolicy: agent.profile.toolPolicy,
            allowedTools: agent.profile.allowedTools,
            blockedTools: agent.profile.blockedTools,
            reasoningEffort: agent.profile.reasoningEffort
          }
          // Also map by explicit `role` hint when provided (e.g. `role: reviewer`)
          // so a workspace agent named "my-custom-reviewer" can override the
          // built-in `reviewer` role's config.
          if (agent.role?.trim()) {
            const targetRole = agent.role.trim()
            if (!workspaceOverrides[targetRole]) {
              workspaceOverrides[targetRole] = workspaceOverrides[agent.id]
            }
          }
        }
      }
    }

    return new KunAgentRoleRegistry(
      builtinRoleConfigs(),
      configOverrides,
      workspaceOverrides
    )
  }

  /** Create a minimal registry with only built-in roles (no config/workspace). */
  static createMinimal(): KunAgentRoleRegistry {
    return new KunAgentRoleRegistry(builtinRoleConfigs(), {}, {})
  }

  get(id: AgentRoleId): AgentRoleConfig | undefined {
    const builtin = this.builtins[id]
    if (!builtin) return undefined

    // Deep merge: builtin < config < workspace
    const configOverride = this.configOverrides[id]
    const workspaceOverride = this.workspaceOverrides[id]

    if (!configOverride && !workspaceOverride) {
      return builtin
    }

    return {
      ...builtin,
      ...configOverride,
      ...workspaceOverride
    }
  }

  /** Get config for any string id — returns undefined for unknown non-AgentRole ids. */
  getById(id: string): AgentRoleConfig | undefined {
    if (isAgentRoleId(id)) return this.get(id)
    // Also check config/workspace overrides for custom role ids
    const configOverride = this.configOverrides[id]
    const workspaceOverride = this.workspaceOverrides[id]
    if (!configOverride && !workspaceOverride) return undefined
    return {
      ...this.builtins['explore'], // fallback base for custom roles
      ...configOverride,
      ...workspaceOverride
    }
  }

  ids(): AgentRoleId[] {
    return Object.keys(this.builtins) as AgentRoleId[]
  }

  entries(): Array<{ id: AgentRoleId; config: AgentRoleConfig }> {
    return this.ids().map((id) => ({ id, config: this.get(id)! }))
  }

  defaultId(): AgentRoleId {
    return 'coder'
  }

  /** Return all known role ids including custom ones from config/workspace. */
  allIds(): string[] {
    const ids = new Set([...this.ids(), ...Object.keys(this.configOverrides), ...Object.keys(this.workspaceOverrides)])
    return [...ids]
  }
}
