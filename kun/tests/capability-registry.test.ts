import { describe, expect, it } from 'vitest'
import { CapabilityRegistry } from '../src/adapters/tool/capability-registry.js'
import { LocalToolHost, defaultLocalTools } from '../src/adapters/tool/local-tool-host.js'
import { modelCapabilitiesForModel } from '../src/loop/model-context-profile.js'
import type { ToolHostContext } from '../src/ports/tool-host.js'

function buildContext(overrides: Partial<ToolHostContext> = {}): ToolHostContext {
  return {
    threadId: 'thr_1',
    turnId: 'turn_1',
    workspace: '/tmp/ws',
    threadMode: 'agent',
    model: modelCapabilitiesForModel('deepseek-chat'),
    memoryPolicy: { enabled: false },
    delegationPolicy: { enabled: false },
    approvalPolicy: 'auto',
    abortSignal: new AbortController().signal,
    awaitApproval: async () => 'allow',
    ...overrides
  }
}

describe('CapabilityRegistry', () => {
  it('preserves built-in tool names through the registry-backed host', async () => {
    const directHost = new LocalToolHost({ tools: defaultLocalTools })
    const registryHost = new LocalToolHost({
      registry: CapabilityRegistry.fromLocalTools(defaultLocalTools)
    })

    const directNames = (await directHost.listTools(buildContext())).map((tool) => tool.name).sort()
    const registryTools = await registryHost.listTools(buildContext())

    expect(registryTools.map((tool) => tool.name).sort()).toEqual(directNames)
    expect(registryTools.every((tool) => tool.providerId === 'builtin')).toBe(true)
    expect(registryTools.every((tool) => tool.providerKind === 'built-in')).toBe(true)
  })

  it('rejects duplicate tool names across providers', () => {
    const tool = LocalToolHost.defineTool({
      name: 'same',
      description: 'same',
      inputSchema: { type: 'object' },
      policy: 'auto',
      execute: async () => ({ output: {} })
    })

    expect(() => new CapabilityRegistry([
      { id: 'p1', kind: 'built-in', enabled: true, available: true, tools: [tool] },
      { id: 'p2', kind: 'web', enabled: true, available: true, tools: [tool] }
    ])).toThrow(/duplicate tool name/)
  })

  it('hides disabled providers and rejects execution before the provider is reached', async () => {
    let executed = false
    const tool = LocalToolHost.defineTool({
      name: 'web_fetch',
      description: 'fetch',
      inputSchema: { type: 'object' },
      policy: 'auto',
      execute: async () => {
        executed = true
        return { output: { ok: true } }
      }
    })
    const registry = new CapabilityRegistry([
      {
        id: 'web',
        kind: 'web',
        enabled: false,
        available: false,
        reason: 'disabled by config',
        tools: [tool]
      }
    ])
    const host = new LocalToolHost({ registry })

    expect(await host.listTools(buildContext())).toEqual([])
    await expect(
      host.execute(
        { callId: 'call_1', toolName: 'web_fetch', arguments: {} },
        buildContext()
      )
    ).rejects.toThrow(/not advertised/)
    expect(executed).toBe(false)
  })

  it('honors provider allow-lists before executing a tool', async () => {
    let executed = false
    const tool = LocalToolHost.defineTool({
      name: 'memory_create',
      description: 'remember',
      inputSchema: { type: 'object' },
      policy: 'auto',
      execute: async () => {
        executed = true
        return { output: { ok: true } }
      }
    })
    const host = new LocalToolHost({
      registry: new CapabilityRegistry([
        { id: 'memory', kind: 'memory', enabled: true, available: true, tools: [tool] }
      ])
    })

    const blocked = buildContext({ allowedProviderIds: ['builtin'] })
    expect(await host.listTools(blocked)).toEqual([])
    await expect(
      host.execute(
        { callId: 'call_1', toolName: 'memory_create', arguments: {} },
        blocked
      )
    ).rejects.toThrow(/not advertised/)
    expect(executed).toBe(false)
  })

  it('passes extended turn context to tool advertisement gates', async () => {
    const tool = LocalToolHost.defineTool({
      name: 'vision_tool',
      description: 'needs images',
      inputSchema: { type: 'object' },
      policy: 'auto',
      shouldAdvertise: (context) =>
        Boolean(context.model?.inputModalities.includes('image') && context.delegationPolicy?.enabled),
      execute: async () => ({ output: { ok: true } })
    })
    const host = new LocalToolHost({ tools: [tool] })

    expect(await host.listTools(buildContext())).toEqual([])
    const visible = await host.listTools(
      buildContext({
        model: {
          ...modelCapabilitiesForModel('vision-model'),
          inputModalities: ['text', 'image'],
          messageParts: ['text', 'image_url']
        },
        delegationPolicy: { enabled: true, maxParallel: 2 }
      })
    )
    expect(visible.map((entry) => entry.name)).toEqual(['vision_tool'])
  })

  it('honors provider deny-lists (blockedProviderIds) at advertise and execute', async () => {
    let executed = false
    const tool = LocalToolHost.defineTool({
      name: 'mcp_github_create_issue',
      description: 'create issue',
      inputSchema: { type: 'object' },
      policy: 'auto',
      execute: async () => {
        executed = true
        return { output: { ok: true } }
      }
    })
    const host = new LocalToolHost({
      registry: new CapabilityRegistry([
        { id: 'mcp:github', kind: 'mcp', enabled: true, available: true, tools: [tool] }
      ])
    })

    // No deny-list → the MCP tool is advertised.
    expect((await host.listTools(buildContext())).map((entry) => entry.name)).toEqual(['mcp_github_create_issue'])

    // blockedProviderIds hides the whole server and rejects execution.
    const blocked = buildContext({ blockedProviderIds: ['mcp:github'] })
    expect(await host.listTools(blocked)).toEqual([])
    await expect(
      host.execute({ callId: 'call_1', toolName: 'mcp_github_create_issue', arguments: {} }, blocked)
    ).rejects.toThrow(/not advertised/)
    expect(executed).toBe(false)
  })

  it('honors tool-name deny-lists (blockedToolNames) while leaving sibling tools advertised', async () => {
    let executed = false
    const bash = LocalToolHost.defineTool({
      name: 'bash',
      description: 'run',
      inputSchema: { type: 'object' },
      policy: 'auto',
      execute: async () => {
        executed = true
        return { output: { ok: true } }
      }
    })
    const read = LocalToolHost.defineTool({
      name: 'read',
      description: 'read',
      inputSchema: { type: 'object' },
      policy: 'auto',
      execute: async () => ({ output: { ok: true } })
    })
    const host = new LocalToolHost({
      registry: new CapabilityRegistry([
        { id: 'builtin', kind: 'built-in', enabled: true, available: true, tools: [bash, read] }
      ])
    })

    const blocked = buildContext({ blockedToolNames: ['bash'] })
    expect((await host.listTools(blocked)).map((entry) => entry.name)).toEqual(['read'])
    await expect(
      host.execute({ callId: 'call_1', toolName: 'bash', arguments: {} }, blocked)
    ).rejects.toThrow(/active tool policy/)
    expect(executed).toBe(false)
  })
})
