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
  const roles = roleRegistry.entries().map(({ id, config }) => ({
    id,
    name: config.name ?? id.charAt(0).toUpperCase() + id.slice(1),
    ...(config.color ? { color: config.color } : {}),
    ...(config.description ? { description: config.description } : {}),
    ...(config.model ? { model: config.model } : {}),
    ...(config.providerId ? { providerId: config.providerId } : {}),
    toolPolicy: config.toolPolicy,
    reasoningEffort: config.reasoningEffort,
    isDefault: id === defaultId
  }))

  return jsonResponse({
    defaultRoleId: defaultId,
    roles
  })
}
