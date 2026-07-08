import type { KunAgentRoleRegistry } from '../../delegation/role-registry.js'
import type { DelegationRuntime } from '../../delegation/delegation-runtime.js'
import { jsonResponse, type JsonResponse } from '../response.js'

/**
 * GET /v1/roles
 *
 * Returns the merged agent role catalog (built-in roles + workspace
 * overlays + user config overrides). The GUI uses this to populate
 * the AgentRoleSelector dropdown and the AgentStatusPanel.
 *
 * Response shape:
 * ```json
 * {
 *   "defaultRoleId": "coder",
 *   "roles": [
 *     { "id": "coder", "name": "Coder", "color": "#3b82d8",
 *       "model": "deepseek-v4-pro", "toolPolicy": "inherit",
 *       "reasoningEffort": "high", "isDefault": true }
 *   ]
 * }
 * ```
 */
export async function roleCatalog(
  roleRegistry: KunAgentRoleRegistry | undefined,
  _delegationRuntime: DelegationRuntime | undefined
): Promise<JsonResponse> {
  if (!roleRegistry) {
    return jsonResponse({
      defaultRoleId: 'coder',
      roles: []
    })
  }

  const defaultId = roleRegistry.defaultId()
  // Build heuristic keyword hints for each built-in role from agent-router.ts
  const ROLE_ROUTING_KEYWORDS: Record<string, string[]> = {
    coder: ['implement', 'refactor', 'fix', 'debug', 'write', 'create', 'build', 'test', 'bug', 'add feature', 'error'],
    planner: ['plan', 'break down', 'decompose', 'steps to', 'outline', 'strategy', 'architecture'],
    reviewer: ['review', 'audit', 'lint', 'check code', 'check security', 'inspect', 'quality'],
    researcher: ['find', 'search', 'investigate', 'what is', 'explain', 'research', 'documentation', 'how does'],
    title: ['title', 'name', 'call this'],
    summarizer: ['summarize', 'summary', 'condense', 'tl;dr'],
    explore: ['where', 'who']
  }
  const ROLE_BASE_CONFIDENCE: Record<string, number> = {
    coder: 0.75, planner: 0.80, reviewer: 0.85,
    researcher: 0.80, title: 0.90, summarizer: 0.85, explore: 0.70
  }

  const roles = roleRegistry.entries().map(({ id, config }) => ({
    id,
    name: config.name ?? id.charAt(0).toUpperCase() + id.slice(1),
    ...(config.color ? { color: config.color } : {}),
    ...(config.description ? { description: config.description } : {}),
    ...(config.model ? { model: config.model } : {}),
    ...(config.providerId ? { providerId: config.providerId } : {}),
    toolPolicy: config.toolPolicy,
    reasoningEffort: config.reasoningEffort,
    isDefault: id === defaultId,
    // Extended fields for GUI routing display
    ...(ROLE_BASE_CONFIDENCE[id] !== undefined ? { confidence: ROLE_BASE_CONFIDENCE[id] } : {}),
    ...(ROLE_ROUTING_KEYWORDS[id] !== undefined ? { routingKeywords: ROLE_ROUTING_KEYWORDS[id] } : {}),
    ...(config.maxTokens !== undefined ? { maxTokens: config.maxTokens } : {}),
    ...(config.allowedTools !== undefined ? { allowedTools: config.allowedTools } : {}),
    ...(config.blockedTools !== undefined ? { blockedTools: config.blockedTools } : {})
  }))

  return jsonResponse({
    defaultRoleId: defaultId,
    roles
  })
}
