import type { DelegationRuntime } from '../../delegation/delegation-runtime.js'
import { jsonResponse, type JsonResponse } from '../response.js'
import { ERRORS } from './runtime-error.js'

/**
 * GET /v1/delegation/diagnostics
 *
 * Returns a snapshot of all child runs (queued/running/completed/failed/
 * aborted) tracked by the delegation runtime. Optional `parentThreadId`
 * query param filters by parent thread.
 *
 * Used by the GUI SubagentsView to show realtime status per profile.
 */
export async function delegationDiagnostics(
  runtime: DelegationRuntime | undefined,
  request: Request
): Promise<JsonResponse> {
  if (!runtime) {
    return jsonResponse({
      enabled: false,
      active: 0,
      childRuns: [],
      aggregates: []
    })
  }
  const url = new URL(request.url)
  const parent = url.searchParams.get('parent_thread_id') ?? undefined
  return jsonResponse(await runtime.diagnostics(parent))
}

/**
 * GET /v1/delegation/profiles
 *
 * Returns the merged profile roster (builtin + GUI + future workspace
 * markdown overlay). Lighter than diagnostics — pure config snapshot.
 */
export async function delegationProfiles(
  runtime: DelegationRuntime | undefined
): Promise<JsonResponse> {
  if (!runtime) {
    return jsonResponse({ profiles: [], defaultProfile: undefined })
  }
  return jsonResponse({
    profiles: runtime.listProfiles(),
    defaultProfile: runtime.defaultProfileName
  })
}

/**
 * POST /v1/delegation/abort/:childId
 *
 * Cancel a detached (background) child run. Synchronous runs are
 * unaffected — abort their parent turn instead.
 */
export async function delegationAbort(
  runtime: DelegationRuntime | undefined,
  childId: string
): Promise<JsonResponse> {
  if (!runtime) return ERRORS.unavailable('delegation runtime is unavailable')
  if (!childId.trim()) return ERRORS.validation('childId is required', [])
  const aborted = runtime.abortChild(childId)
  return jsonResponse({ childId, aborted })
}

export { ERRORS as DelegationErrors }
