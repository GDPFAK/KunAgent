import { RuntimeConfigApplyRequest, type RuntimeConfigApplyResponse } from '../../contracts/runtime-config.js'
import { jsonResponse, type JsonResponse } from '../response.js'
import { readJsonBody } from '../read-json-body.js'
import type { ServerRuntime } from './server-runtime.js'

export async function applyRuntimeConfig(
  runtime: ServerRuntime,
  request: Request
): Promise<JsonResponse | Response> {
  const body = await readJsonBody(request)
  if (!body.ok) return body.response
  const parsed = RuntimeConfigApplyRequest.safeParse(body.value)
  if (!parsed.success) {
    return jsonResponse(
      {
        ok: false,
        code: 'invalid_config',
        message: `invalid runtime config apply body: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`
      } satisfies RuntimeConfigApplyResponse,
      400
    )
  }

  const result = await runtime.applyConfig(parsed.data)
  return jsonResponse(result, result.ok ? 200 : result.code === 'restart_required' ? 409 : 400)
}
