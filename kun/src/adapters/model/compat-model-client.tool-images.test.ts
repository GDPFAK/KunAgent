import { describe, expect, it } from 'vitest'
import { CompatModelClient } from './compat-model-client.js'
import type { ModelCapabilityMetadata } from '../../contracts/capabilities.js'
import type { ModelEndpointFormat } from '../../contracts/model-endpoint-format.js'
import type { ModelRequest, ModelStreamChunk } from '../../ports/model-client.js'
import type { TurnItem } from '../../contracts/items.js'

const SHOT = 'SCREENSHOTBASE64DATA'

type CapturedCall = { url: string; body: Record<string, unknown> }

function caps(vision: boolean, endpointFormat?: ModelEndpointFormat): (model: string) => ModelCapabilityMetadata {
  return (model) => ({
    id: model,
    inputModalities: vision ? ['text', 'image'] : ['text'],
    outputModalities: ['text'],
    supportsToolCalling: true,
    messageParts: vision ? ['text', 'image_url'] : ['text'],
    ...(endpointFormat ? { endpointFormat } : {})
  })
}

function fakeFetch(calls: CapturedCall[]): typeof fetch {
  return (async (url: string, init: { body: string }) => {
    const target = String(url)
    calls.push({ url: target, body: JSON.parse(init.body) as Record<string, unknown> })
    const json = target.endsWith('/messages')
      ? { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' }
      : { choices: [{ index: 0, finish_reason: 'stop', message: { content: 'ok' } }] }
    return new Response(JSON.stringify(json), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
}

function screenshotHistory(): TurnItem[] {
  const base = { turnId: 'u1', threadId: 't1', status: 'completed' as const, createdAt: '2026-01-01T00:00:00.000Z' }
  const toolCall: TurnItem = {
    ...base,
    id: 'i1',
    role: 'assistant',
    kind: 'tool_call',
    toolName: 'computer_use',
    callId: 'c1',
    toolKind: 'command_execution',
    arguments: { action: 'screenshot' }
  }
  const toolResult: TurnItem = {
    ...base,
    id: 'i2',
    role: 'tool',
    kind: 'tool_result',
    toolName: 'computer_use',
    callId: 'c1',
    toolKind: 'command_execution',
    isError: false,
    output: {
      kind: 'computer_screenshot',
      action: 'screenshot',
      screen: { width: 1280, height: 800 },
      images: [{ mime_type: 'image/png', data_base64: SHOT, width: 1280, height: 800 }]
    }
  }
  return [toolCall, toolResult]
}

// Two parallel tool calls in a single assistant turn, each with its own
// tool_result — the shape that triggered issue #574 (each tool_result must
// land in the SAME user message under the Anthropic Messages protocol).
function parallelToolHistory(): TurnItem[] {
  const base = { turnId: 'u2', threadId: 't1', status: 'completed' as const, createdAt: '2026-01-01T00:00:00.000Z' }
  const callA: TurnItem = {
    ...base,
    id: 'pc1',
    role: 'assistant',
    kind: 'tool_call',
    toolName: 'read_file',
    callId: 'call_a',
    toolKind: 'command_execution',
    arguments: { path: 'a.txt' }
  }
  const callB: TurnItem = {
    ...base,
    id: 'pc2',
    role: 'assistant',
    kind: 'tool_call',
    toolName: 'read_file',
    callId: 'call_b',
    toolKind: 'command_execution',
    arguments: { path: 'b.txt' }
  }
  const resultA: TurnItem = {
    ...base,
    id: 'pr1',
    role: 'tool',
    kind: 'tool_result',
    toolName: 'read_file',
    callId: 'call_a',
    toolKind: 'command_execution',
    isError: false,
    output: { kind: 'text', text: 'contents-a' }
  }
  const resultB: TurnItem = {
    ...base,
    id: 'pr2',
    role: 'tool',
    kind: 'tool_result',
    toolName: 'read_file',
    callId: 'call_b',
    toolKind: 'command_execution',
    isError: false,
    output: { kind: 'text', text: 'contents-b' }
  }
  return [callA, callB, resultA, resultB]
}

function request(model: string): ModelRequest {
  return {
    threadId: 't1',
    turnId: 'u1',
    model,
    systemPrompt: 'sys',
    prefix: [],
    history: screenshotHistory(),
    tools: [],
    abortSignal: new AbortController().signal
  }
}

function parallelRequest(model: string): ModelRequest {
  return {
    ...request(model),
    history: parallelToolHistory()
  }
}

async function drain(iterable: AsyncIterable<ModelStreamChunk>): Promise<void> {
  for await (const _ of iterable) void _
}

function jsonString(value: unknown): string {
  return JSON.stringify(value)
}

describe('CompatModelClient tool-result image forwarding', () => {
  it('forwards a screenshot as an image_url user message for a vision model (chat_completions)', async () => {
    const calls: CapturedCall[] = []
    const client = new CompatModelClient({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk',
      model: 'vision-model',
      endpointFormat: 'chat_completions',
      nonStreaming: true,
      fetchImpl: fakeFetch(calls),
      modelCapabilities: caps(true)
    })
    await drain(client.stream(request('vision-model')))
    const messages = calls[0].body.messages as Array<{ role: string; content: unknown }>
    // The tool message stays text-only; the image rides in a following user message.
    const toolMsg = messages.find((m) => m.role === 'tool')
    expect(typeof toolMsg?.content).toBe('string')
    expect(jsonString(toolMsg?.content)).not.toContain(SHOT)
    const userImg = messages.find(
      (m) => m.role === 'user' && Array.isArray(m.content) &&
        (m.content as Array<{ type: string }>).some((p) => p.type === 'image_url')
    )
    expect(userImg).toBeDefined()
    expect(jsonString(userImg?.content)).toContain(`data:image/png;base64,${SHOT}`)
  })

  it('places the screenshot as a sibling of tool_result in the user message (anthropic messages)', async () => {
    const calls: CapturedCall[] = []
    const client = new CompatModelClient({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk',
      model: 'claude-vision',
      endpointFormat: 'messages',
      nonStreaming: true,
      fetchImpl: fakeFetch(calls),
      modelCapabilities: caps(true, 'messages')
    })
    await drain(client.stream(request('claude-vision')))
    expect(calls[0].url).toMatch(/\/messages$/)
    const messages = calls[0].body.messages as Array<{ role: string; content: unknown }>
    const userMsg = messages.find(
      (m) => m.role === 'user' && Array.isArray(m.content) &&
        (m.content as Array<{ type: string }>).some((b) => b.type === 'tool_result')
    )
    expect(userMsg).toBeDefined()
    const blocks = userMsg!.content as Array<{ type: string; content?: unknown; source?: { data?: string; media_type?: string } }>
    // tool_result is plain text (the older, universally-supported shape).
    const toolResult = blocks.find((b) => b.type === 'tool_result')
    expect(typeof toolResult?.content).toBe('string')
    expect(toolResult?.content).not.toContain(SHOT)
    // The screenshot rides as a sibling `image` block — the shape every
    // Anthropic-compat layer (MiniMax/etc.) handles, not the newer
    // image-inside-tool_result computer-use beta shape that compat layers
    // tend to reject.
    const imageBlock = blocks.find((b) => b.type === 'image')
    expect(imageBlock?.source?.data).toBe(SHOT)
    expect(imageBlock?.source?.media_type).toBe('image/png')
  })

  it('does NOT send image parts to a non-vision model (text-only tool result)', async () => {
    const calls: CapturedCall[] = []
    const client = new CompatModelClient({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk',
      model: 'text-model',
      endpointFormat: 'chat_completions',
      nonStreaming: true,
      fetchImpl: fakeFetch(calls),
      modelCapabilities: caps(false)
    })
    await drain(client.stream(request('text-model')))
    const body = jsonString(calls[0].body)
    expect(body).not.toContain('image_url')
    expect(body).not.toContain(SHOT)
    // Metadata (the screen size) still reaches the model as text.
    expect(body).toContain('computer_screenshot')
  })

  it('merges parallel tool_results into one user message (anthropic messages)', async () => {
    // Regression for issue #574: parallel tool calls must answer with a
    // single user message holding both tool_result blocks, not two separate
    // user messages (which trips Anthropic's tool_result-immediately-after
    // rule and yields HTTP 400 on compat providers).
    const calls: CapturedCall[] = []
    const client = new CompatModelClient({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk',
      model: 'claude-parallel',
      endpointFormat: 'messages',
      nonStreaming: true,
      fetchImpl: fakeFetch(calls),
      modelCapabilities: caps(false, 'messages')
    })
    await drain(client.stream(parallelRequest('claude-parallel')))
    expect(calls[0].url).toMatch(/\/messages$/)
    const messages = calls[0].body.messages as Array<{
      role: string
      content: Array<{ type: string; tool_use_id?: string }>
    }>
    const toolResultUserMessages = messages.filter(
      (m) =>
        m.role === 'user' &&
        Array.isArray(m.content) &&
        m.content.some((b) => b.type === 'tool_result')
    )
    // Exactly ONE user message carries the tool_result blocks.
    expect(toolResultUserMessages).toHaveLength(1)
    const merged = toolResultUserMessages[0]!
    const toolResultIds = merged.content
      .filter((b) => b.type === 'tool_result')
      .map((b) => b.tool_use_id)
      .sort()
    expect(toolResultIds).toEqual(['call_a', 'call_b'])
  })
})
