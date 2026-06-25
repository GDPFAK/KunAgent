import { z } from 'zod'
import { jsonResponse, type JsonResponse } from '../response.js'
import { readJsonBody } from '../read-json-body.js'
import { ERRORS } from './runtime-error.js'
import { generateSessionSummary } from '../../loop/session-summary.js'
import { resolveRoleModel } from '../../loop/title-generator.js'
import type { ServerRuntime } from './server-runtime.js'

const SummarizeThreadRequest = z
  .object({
    /** Optional per-request model override (falls back to summary role precedence). */
    model: z.string().min(1).optional(),
    providerId: z.string().min(1).optional()
  })
  .optional()

export const SummarizeThreadResponse = z.object({
  id: z.string(),
  summary: z.string()
})
export type SummarizeThreadResponse = z.infer<typeof SummarizeThreadResponse>

/**
 * On-demand whole-session summary. Reads the full transcript, runs the Summary
 * internal-LLM role (precedence: summaryModel -> smallModel -> main model),
 * persists the result onto the thread (`summary` field) and returns it. NOT
 * triggered automatically — the renderer calls this from a "summarize" action.
 *
 * Route: POST /v1/threads/:id/summarize
 */
export async function summarizeThread(
  runtime: ServerRuntime,
  threadId: string,
  request: Request
): Promise<JsonResponse | Response> {
  const body = await readJsonBody(request)
  if (!body.ok) return body.response
  // An empty object body is valid (no overrides); coerce {} -> undefined.
  const rawBody = body.value && typeof body.value === 'object' && Object.keys(body.value).length === 0
    ? undefined
    : body.value
  const parsed = SummarizeThreadRequest.safeParse(rawBody)
  if (!parsed.success) return ERRORS.validation('invalid summarize body', parsed.error.issues)

  if (!runtime.modelClient) return ERRORS.unavailable('model client is unavailable')

  const thread = await runtime.threadService.get(threadId)
  if (!thread) return ERRORS.notFound(`thread not found: ${threadId}`)

  const items = await runtime.sessionStore.loadItems(threadId)
  if (!items.some((item) => item.kind === 'user_message' || item.kind === 'assistant_text')) {
    return ERRORS.validation('thread has no conversation to summarize')
  }

  const resolved = resolveRoleModel({
    roleModel: parsed.data?.model ?? runtime.roles?.summaryModel,
    roleProviderId: parsed.data?.providerId ?? runtime.roles?.summaryProviderId,
    roles: runtime.roles,
    mainModel: thread.model || runtime.defaultModel,
    mainProviderId: thread.providerId
  })
  if (!resolved) return ERRORS.unavailable('no model is configured for session summary')

  const abortController = new AbortController()
  const onAbort = (): void => abortController.abort()
  request.signal?.addEventListener('abort', onAbort)

  let summary: string | undefined
  try {
    summary = await generateSessionSummary({
      threadId,
      modelClient: runtime.modelClient,
      model: resolved.model,
      ...(resolved.providerId ? { providerId: resolved.providerId } : {}),
      ...(runtime.immutablePrefix?.systemPrompt ? { systemPrompt: runtime.immutablePrefix.systemPrompt } : {}),
      items,
      ...(runtime.roles?.summaryReasoningEffort
        ? { reasoningEffort: runtime.roles.summaryReasoningEffort }
        : {}),
      abortSignal: abortController.signal
    })
  } finally {
    request.signal?.removeEventListener('abort', onAbort)
  }
  if (!summary) return ERRORS.unavailable('session summary returned no content')

  const updated = await runtime.threadService.update(threadId, { summary })
  return jsonResponse(SummarizeThreadResponse.parse({ id: updated.id, summary: updated.summary ?? summary }))
}
