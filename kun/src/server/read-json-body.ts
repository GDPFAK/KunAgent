import type { KunErrorBody } from '../contracts/errors.js'
import { jsonResponse, type JsonResponse } from './response.js'

export type ReadJsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; response: JsonResponse }

const DEFAULT_MAX_JSON_BODY_BYTES = 32 * 1024 * 1024

export async function readJsonBody(request: Request, maxBytes = DEFAULT_MAX_JSON_BODY_BYTES): Promise<ReadJsonBodyResult> {
  if (request.body === null) return { ok: true, value: {} }
  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return bodyTooLarge(maxBytes)

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined)
      return bodyTooLarge(maxBytes)
    }
    chunks.push(value)
  }
  const text = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8')
  if (!text) return { ok: true, value: {} }
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (error) {
    const body: KunErrorBody = {
      code: 'validation_error',
      message: 'invalid JSON body',
      details: error instanceof Error ? error.message : String(error)
    }
    return { ok: false, response: jsonResponse(body, 400) }
  }
}

function bodyTooLarge(maxBytes: number): ReadJsonBodyResult {
  return {
    ok: false,
    response: jsonResponse({ code: 'validation_error', message: `JSON body exceeds ${maxBytes} byte limit` }, 413)
  }
}
