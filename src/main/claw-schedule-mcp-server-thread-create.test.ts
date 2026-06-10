import { beforeEach, describe, expect, it, vi } from 'vitest'

const mcpMock = vi.hoisted(() => {
  const tools: Array<{
    name: string
    config: Record<string, unknown>
    handler: (args: Record<string, unknown>) => Promise<unknown>
  }> = []
  return {
    tools,
    connect: vi.fn(async (_transport: unknown) => undefined)
  }
})

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: class {
    registerTool(
      name: string,
      config: Record<string, unknown>,
      handler: (args: Record<string, unknown>) => Promise<unknown>
    ) {
      mcpMock.tools.push({ name, config, handler })
    }

    async connect(transport: unknown) {
      await mcpMock.connect(transport)
    }
  }
}))

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: class {}
}))

describe('claw schedule MCP server gui_thread_create', () => {
  beforeEach(() => {
    mcpMock.tools.length = 0
    mcpMock.connect.mockClear()
  })

  it('registers gui_thread_create and forwards arguments to the thread internal endpoint', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        ok: true,
        threadId: 'thr_created',
        turnId: 'turn_created',
        title: 'Continue work',
        message: 'Started'
      })
    }))
    vi.stubGlobal('fetch', fetchMock)
    const { runClawScheduleMcpServerFromArgv } = await import('./claw-schedule-mcp-server')

    await expect(runClawScheduleMcpServerFromArgv([
      'node',
      'entry',
      '--gui-schedule-mcp-server',
      '--base-url',
      'http://127.0.0.1:8788',
      '--secret',
      'test-secret'
    ])).resolves.toBe(true)

    const tool = mcpMock.tools.find((entry) => entry.name === 'gui_thread_create')
    expect(tool).toBeTruthy()
    const result = await tool!.handler({
      title: 'Continue work',
      prompt: 'Pick up from the handoff.',
      workspace_root: '/tmp/project',
      model: 'deepseek-v4-pro',
      mode: 'agent',
      reasoning_effort: 'medium'
    }) as { content?: Array<{ text?: string }>; structuredContent?: Record<string, unknown> }

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8788/schedule/internal/thread/create',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-secret',
          'Content-Type': 'application/json'
        })
      })
    )
    const init = fetchMock.mock.calls[0]?.[1]
    const body = JSON.parse(String(init?.body))
    expect(body).toEqual({
      input: {
        title: 'Continue work',
        prompt: 'Pick up from the handoff.',
        workspaceRoot: '/tmp/project',
        model: 'deepseek-v4-pro',
        reasoningEffort: 'medium',
        mode: 'agent'
      }
    })
    expect(result.content?.[0]?.text).toBe('Thread created: Continue work')
    expect(result.structuredContent).toMatchObject({
      thread_id: 'thr_created',
      turn_id: 'turn_created',
      title: 'Continue work',
      message: 'Started'
    })
  })
})
