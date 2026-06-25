import { describe, expect, it } from 'vitest'
import { CompatModelClient } from './compat-model-client.js'
import type { ModelCapabilityMetadata } from '../../contracts/capabilities.js'
import type { ModelRequest, ModelStreamChunk } from '../../ports/model-client.js'

// These tests exercise the REAL streaming SSE path (`streamSse` /
// `consumeStreamPayload`), which had no coverage before. They lock in the fix
// for the silent tool-call drop: the chat_completions branch only finalized on
// `finish_reason === 'tool_calls'`, so a provider ending with 'stop', 'length',
// or a bare `[DONE]` while a tool call was pending dropped it entirely.

type CapturedCall = { url: string; body: Record<string, unknown> }

function sseResponse(frames: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame))
      controller.close()
    }
  })
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' }
  })
}

function frame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}

function streamingFetch(frames: string[], calls: CapturedCall[] = []): typeof fetch {
  return (async (url: string, init: { body: string }) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) as Record<string, unknown> })
    return sseResponse(frames)
  }) as unknown as typeof fetch
}

function capability(overrides: Partial<ModelCapabilityMetadata> = {}): (model: string) => ModelCapabilityMetadata {
  return (model) => ({
    id: model,
    inputModalities: ['text'],
    outputModalities: ['text'],
    supportsToolCalling: true,
    messageParts: ['text'],
    ...overrides
  })
}

function request(overrides: Partial<ModelRequest> = {}): ModelRequest {
  return {
    threadId: 't1',
    turnId: 'u1',
    model: 'test-model',
    systemPrompt: 'You are a helpful assistant.',
    prefix: [],
    history: [],
    tools: [{ name: 'edit', description: 'edit a file', inputSchema: { type: 'object' } }],
    abortSignal: new AbortController().signal,
    ...overrides
  }
}

async function drain(iterable: AsyncIterable<ModelStreamChunk>): Promise<ModelStreamChunk[]> {
  const chunks: ModelStreamChunk[] = []
  for await (const chunk of iterable) chunks.push(chunk)
  return chunks
}

function toolCallCompletes(
  chunks: ModelStreamChunk[]
): Extract<ModelStreamChunk, { kind: 'tool_call_complete' }>[] {
  return chunks.filter(
    (c): c is Extract<ModelStreamChunk, { kind: 'tool_call_complete' }> =>
      c.kind === 'tool_call_complete'
  )
}

function completed(chunks: ModelStreamChunk[]): Extract<ModelStreamChunk, { kind: 'completed' }> {
  const last = chunks.at(-1)
  if (!last || last.kind !== 'completed') throw new Error('stream did not end with completed')
  return last
}

function chatToolDelta(d: { index: number; id?: string; name?: string; args?: string }): string {
  const fn: Record<string, unknown> = {}
  if (d.name !== undefined) fn.name = d.name
  if (d.args !== undefined) fn.arguments = d.args
  const call: Record<string, unknown> = { index: d.index, function: fn }
  if (d.id !== undefined) call.id = d.id
  return frame({ choices: [{ index: 0, delta: { tool_calls: [call] } }] })
}

function chatFinish(reason: string): string {
  return frame({ choices: [{ index: 0, delta: {}, finish_reason: reason }] })
}

// A two-part chat_completions tool-call stream. The args split across deltas so
// the test also covers index-based continuation accumulation.
function chatToolCallDeltas(): string[] {
  return [
    chatToolDelta({ index: 0, id: 'call_1', name: 'edit', args: '{"path":' }),
    chatToolDelta({ index: 0, args: '"a.txt"}' })
  ]
}

function makeClient(fetchImpl: typeof fetch, modelCapabilities?: (model: string) => ModelCapabilityMetadata) {
  return new CompatModelClient({
    baseUrl: 'https://provider.example/v1/chat/completions',
    apiKey: 'sk-test',
    model: 'test-model',
    endpointFormat: 'chat_completions',
    fetchImpl,
    ...(modelCapabilities ? { modelCapabilities } : {})
  })
}

describe('CompatModelClient streaming tool-call finalization', () => {
  it('emits a tool call when chat_completions ends with finish_reason "tool_calls" (no double emit)', async () => {
    const frames = [...chatToolCallDeltas(), chatFinish('tool_calls'), 'data: [DONE]\n\n']
    const chunks = await drain(makeClient(streamingFetch(frames)).stream(request()))
    const calls = toolCallCompletes(chunks)
    expect(calls).toHaveLength(1)
    expect(calls[0].toolName).toBe('edit')
    expect(calls[0].arguments).toEqual({ path: 'a.txt' })
    expect(completed(chunks).stopReason).toBe('tool_calls')
  })

  it('recovers a tool call the provider mislabeled as finish_reason "stop"', async () => {
    // Regression: previously dropped silently because finishReason !== 'tool_calls'.
    const frames = [...chatToolCallDeltas(), chatFinish('stop'), 'data: [DONE]\n\n']
    const chunks = await drain(makeClient(streamingFetch(frames)).stream(request()))
    const calls = toolCallCompletes(chunks)
    expect(calls).toHaveLength(1)
    expect(calls[0].arguments).toEqual({ path: 'a.txt' })
    // A recovered call means it was really a tool-call turn.
    expect(completed(chunks).stopReason).toBe('tool_calls')
  })

  it('recovers a tool call when the stream ends with a bare [DONE] and no finish_reason', async () => {
    const frames = [...chatToolCallDeltas(), 'data: [DONE]\n\n']
    const chunks = await drain(makeClient(streamingFetch(frames)).stream(request()))
    expect(toolCallCompletes(chunks)).toHaveLength(1)
    expect(completed(chunks).stopReason).toBe('tool_calls')
  })

  it('surfaces truncated arguments as __raw (instead of dropping) on finish_reason "length"', async () => {
    // Only the first (incomplete) delta arrives, then the model hits its cap.
    const frames = [
      chatToolDelta({ index: 0, id: 'call_1', name: 'edit', args: '{"path":' }),
      chatFinish('length'),
      'data: [DONE]\n\n'
    ]
    const chunks = await drain(makeClient(streamingFetch(frames)).stream(request()))
    const calls = toolCallCompletes(chunks)
    expect(calls).toHaveLength(1)
    expect(calls[0].arguments).toHaveProperty('__raw', '{"path":')
    // Truncation stays visible as 'length' so the loop can warn the user.
    expect(completed(chunks).stopReason).toBe('length')
  })

  it('does not emit a tool call when no tool deltas were streamed', async () => {
    const frames = [
      frame({ choices: [{ index: 0, delta: { content: 'hello' } }] }),
      chatFinish('stop'),
      'data: [DONE]\n\n'
    ]
    const chunks = await drain(makeClient(streamingFetch(frames)).stream(request()))
    expect(toolCallCompletes(chunks)).toHaveLength(0)
    expect(completed(chunks).stopReason).toBe('stop')
  })

  it('recovers an Anthropic Messages tool_use block cut off before content_block_stop', async () => {
    const frames = [
      frame({ type: 'message_start', message: { usage: { input_tokens: 10 } } }),
      frame({ type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_1', name: 'edit' } }),
      frame({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"path":"a.txt"}' } }),
      // No content_block_stop — stream is cut off, then the message ends.
      frame({ type: 'message_delta', delta: { stop_reason: 'max_tokens' } }),
      frame({ type: 'message_stop' })
    ]
    const client = new CompatModelClient({
      baseUrl: 'https://provider.example/anthropic',
      apiKey: 'sk-test',
      model: 'test-model',
      endpointFormat: 'messages',
      fetchImpl: streamingFetch(frames)
    })
    const chunks = await drain(client.stream(request()))
    const calls = toolCallCompletes(chunks)
    expect(calls).toHaveLength(1)
    expect(calls[0].toolName).toBe('edit')
    expect(calls[0].arguments).toEqual({ path: 'a.txt' })
  })
})

describe('CompatModelClient output-token cap', () => {
  function captureMessagesBody(
    cap: (model: string) => ModelCapabilityMetadata,
    req: Partial<ModelRequest> = {}
  ): Promise<Record<string, unknown>> {
    const calls: CapturedCall[] = []
    const frames = [frame({ type: 'message_start', message: { usage: {} } }), frame({ type: 'message_stop' })]
    const client = new CompatModelClient({
      baseUrl: 'https://provider.example/anthropic',
      apiKey: 'sk-test',
      model: 'test-model',
      endpointFormat: 'messages',
      fetchImpl: streamingFetch(frames, calls),
      modelCapabilities: cap
    })
    return drain(client.stream(request(req))).then(() => calls[0].body)
  }

  it('gives reasoning (anthropic-thinking) models a large messages max_tokens default', async () => {
    const body = await captureMessagesBody(
      capability({ reasoning: { supportedEfforts: ['auto', 'off'], defaultEffort: 'auto', requestProtocol: 'anthropic-thinking' } }),
      { reasoningEffort: 'auto' }
    )
    expect(body.max_tokens).toBe(32_768)
  })

  it('uses the smaller messages default for non-reasoning models', async () => {
    const body = await captureMessagesBody(capability())
    expect(body.max_tokens).toBe(8_192)
  })

  it('lets a per-model maxOutputTokens capability override the default', async () => {
    const body = await captureMessagesBody(
      capability({
        maxOutputTokens: 5_000,
        reasoning: { supportedEfforts: ['auto', 'off'], defaultEffort: 'auto', requestProtocol: 'anthropic-thinking' }
      }),
      { reasoningEffort: 'auto' }
    )
    expect(body.max_tokens).toBe(5_000)
  })

  it('lets an explicit request.maxTokens win over everything', async () => {
    const body = await captureMessagesBody(capability({ maxOutputTokens: 5_000 }), { maxTokens: 1_234 })
    expect(body.max_tokens).toBe(1_234)
  })
})
