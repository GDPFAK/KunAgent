/**
 * Cross-layer agent role types shared between the Kun runtime and the GUI renderer.
 *
 * These types mirror a subset of the runtime's `AgentRoleId` and `AgentRoleConfig`
 * from `kun/src/contracts/agent-role.ts`, but are intentionally flattened and
 * serializable for IPC transport. The runtime is the source of truth — these are
 * read-only views.
 */

/**
 * Agent role identifier visible to the GUI.
 * Matches the runtime `AgentRoleId` values.
 */
export type GuiAgentRoleId =
  | 'coder'
  | 'planner'
  | 'reviewer'
  | 'researcher'
  | 'title'
  | 'summarizer'
  | 'explore'

/**
 * Agent role summary exposed to the GUI via the runtime API.
 * The renderer uses this for role selection, badge display, and status panels.
 */
export type GuiAgentRoleInfo = {
  /** Role id (matches AgentRoleId). */
  id: GuiAgentRoleId
  /** Display name (falls back to id). */
  name: string
  /** One-line description of when to use this role. */
  description?: string
  /** UI accent color hex (e.g. "#3b82d8"). */
  color?: string
  /** Model id the role resolves to. */
  model?: string
  /** Provider id the role routes to. */
  providerId?: string
  /** Whether the role is readOnly or inherits the main agent's tools. */
  toolPolicy: 'inherit' | 'readOnly'
  /** Reasoning effort level. */
  reasoningEffort?: string
  /** Whether this role is the default. */
  isDefault: boolean
}

/**
 * Response shape for the runtime API endpoint that exposes available agent roles.
 */
export type GuiAgentRoleCatalogResponse = {
  roles: GuiAgentRoleInfo[]
  activeRoleId: GuiAgentRoleId
  defaultRoleId: GuiAgentRoleId
}
