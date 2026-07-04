import { jsonResponse, type JsonResponse } from '../response.js'
import { KUN_RUNTIME_BUILD_HASH, KUN_RUNTIME_VERSION } from '../../version.js'

/** Build the `GET /health` response. The endpoint is unauthenticated. */
export function healthJsonResponse(): JsonResponse {
  return jsonResponse({
    status: 'ok',
    service: 'kun',
    mode: 'serve',
    version: KUN_RUNTIME_VERSION,
    buildHash: KUN_RUNTIME_BUILD_HASH
  })
}
