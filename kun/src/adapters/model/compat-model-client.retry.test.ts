import { describe, expect, it } from 'vitest'
import { CompatModelClient } from './compat-model-client.js'
import type { ModelRequest, ModelStreamChunk } from '../../ports/model-client.js'

// Transient upstream gateway failures (502/503/504 from a load balancer) are
// momentary backend hiccups, not request errors. The client retries them a few
// times before failing the turn — see streamInner's transient-retry loop.

function request(signal?: AbortSignal): ModelRequest {
  return {
    threadId: 't1',
    turnId: 'u1',
    model: 'glm-5.1',
    systemPrompt: 'You are a helpful assistant.',
    prefix: [],
    history: [],
    tools: [],
    abortSignal: signal ?? new AbortController().signal
  }
}

async function drain(iterable: AsyncIterable<ModelStreamChunk>): Promise<ModelStreamChunk[]> {
  const chunks: ModelStreamChunk[] = []
  for await (const chunk of iterable) chunks.push(chunk)
  return chunks
}

function okJson(): Response {
  return new Response(
    JSON.stringify({ choices: [{ index: 0, finish_reason: 'stop', message: { content: 'ok' } }] }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  )
}

// Mirrors the real ALB 502 the user hit: HTML body, not JSON.
function gatewayError(status: number): Response {
  return new Response(
    `<html><head><title>${status}</title></head><body><center>${status}</center><center>alb</center></body></html>`,
    { status, headers: { 'content-type': 'text/html' } }
  )
}

function client(fetchImpl: typeof fetch): CompatModelClient {
  return new CompatModelClient({
    baseUrl: 'https://provider.example/v1',
    apiKey: 'sk-test',
    model: 'glm-5.1',
    endpointFormat: 'chat_completions',
    nonStreaming: true,
    fetchImpl
  })
}

describe('CompatModelClient transient gateway retry', () => {
  it('retries a 502 Bad Gateway and then succeeds', async () => {
    let calls = 0
    const fetchImpl = (async () => {
      calls += 1
      return calls === 1 ? gatewayError(502) : okJson()
    }) as unknown as typeof fetch

    const chunks = await drain(client(fetchImpl).stream(request()))

    expect(calls).toBe(2)
    expect(chunks.some((c) => c.kind === 'assistant_text_delta')).toBe(true)
    expect(chunks.at(-1)).toEqual({ kind: 'completed', stopReason: 'stop' })
    expect(chunks.some((c) => c.kind === 'error')).toBe(false)
  })

  it('does not retry a non-transient 500', async () => {
    let calls = 0
    const fetchImpl = (async () => {
      calls += 1
      return gatewayError(500)
    }) as unknown as typeof fetch

    const chunks = await drain(client(fetchImpl).stream(request()))

    expect(calls).toBe(1)
    expect(chunks.some((c) => c.kind === 'error')).toBe(true)
  })

  it('summarizes HTML challenge pages in user-visible HTTP errors', async () => {
    const html = `
      <html>
        <head><title>Challenge</title></head>
        <body>
          <h2><span id="challenge-error-text">Enable JavaScript and cookies to continue</span></h2>
          ${'<svg><path d="M37.5324 16.8707" /></svg>'.repeat(100)}
        </body>
      </html>
    `
    const fetchImpl = (async () =>
      new Response(html, { status: 403, headers: { 'content-type': 'text/html' } })
    ) as unknown as typeof fetch

    const chunks = await drain(client(fetchImpl).stream(request()))
    const error = chunks.find((c) => c.kind === 'error')

    expect(error).toMatchObject({
      kind: 'error',
      code: 'http_403'
    })
    expect(error && error.kind === 'error' ? error.message : '').toContain('HTML challenge page')
    expect(error && error.kind === 'error' ? error.message : '').not.toContain('<svg>')
    expect(error && error.kind === 'error' ? error.message.length : 0).toBeLessThan(240)
  })

  it('stops retrying when the request is aborted during backoff', async () => {
    const controller = new AbortController()
    let calls = 0
    const fetchImpl = (async () => {
      calls += 1
      // Abort while the (failed) response is in hand, so the backoff sees it.
      controller.abort()
      return gatewayError(503)
    }) as unknown as typeof fetch

    const chunks = await drain(client(fetchImpl).stream(request(controller.signal)))

    expect(calls).toBe(1)
    expect(chunks.some((c) => c.kind === 'error')).toBe(true)
  })
})
