import { spawn as nodeSpawn } from 'node:child_process'
import { connect as netConnect, createServer } from 'node:net'
import { LocalToolHost, type LocalTool } from './local-tool-host.js'
import { RemotePortForwardManager } from '../../remote/remote-port-forward-manager.js'
import type { SshChildProcess, SshSpawnFn } from '../../remote/ssh-executor.js'
import { isSshTarget } from '../../remote/remote-target.js'
import type { CapabilityToolProvider } from './capability-registry.js'
import { createApprovalRequest } from '../../domain/approval.js'

const realSpawn: SshSpawnFn = (command, args) =>
  nodeSpawn(command, [...args], { shell: false }) as unknown as SshChildProcess

function probeLocalPort(port: number, timeoutMs = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = netConnect({ port, host: '127.0.0.1' })
    let settled = false
    const done = (ok: boolean): void => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(ok)
    }
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
    socket.setTimeout(timeoutMs, () => done(false))
  })
}

function allocateFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => (port ? resolve(port) : reject(new Error('could not allocate a local port'))))
    })
  })
}

export type RemotePortForwardToolDeps = {
  spawn?: SshSpawnFn
  allocatePort?: () => Promise<number>
  probeReady?: (port: number) => Promise<boolean>
  readyTimeoutMs?: number
}

export type RemotePortForwardRuntime = {
  provider: CapabilityToolProvider
  disposeThreadResources(threadId: string): void
  shutdown(): void
}

export function createRemotePortForwardRuntime(deps: RemotePortForwardToolDeps = {}): RemotePortForwardRuntime {
  const readyTimeoutMs = deps.readyTimeoutMs ?? 5_000
  const probeReady = deps.probeReady ?? ((port: number) => probeLocalPort(port))
  const managers = new Map<string, RemotePortForwardManager>()

  const managerFor = (threadId: string): RemotePortForwardManager => {
    const existing = managers.get(threadId)
    if (existing) return existing
    const manager = new RemotePortForwardManager({
      spawn: deps.spawn ?? realSpawn,
      allocatePort: deps.allocatePort ?? allocateFreePort,
      probeReady
    })
    managers.set(threadId, manager)
    return manager
  }

  const tool = LocalToolHost.defineTool({
    name: 'remote_port_forward',
    description:
      'Preview a remote service locally over an SSH tunnel (remote thread only). ' +
      'Default action is open; list and close are available for cleanup.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['open', 'list', 'close'] },
        remotePort: { type: 'number' },
        localPort: { type: 'number' },
        host: { type: 'string' },
        label: { type: 'string' },
        id: { type: 'string' }
      },
      additionalProperties: false
    },
    policy: 'on-request',
    shouldAdvertise: (context) => context.executionTarget?.describe().target.kind === 'ssh',
    execute: async (args, context) => {
      const executionTarget = context.executionTarget
      const target = executionTarget?.describe().target
      if (!target || !isSshTarget(target)) {
        return { output: { error: 'remote_port_forward requires a thread bound to an SSH target' }, isError: true }
      }
      const manager = managerFor(context.threadId)
      const action = typeof args.action === 'string' ? args.action : 'open'
      try {
        if (action === 'list') {
          return { output: { action, forwards: manager.list() } }
        }
        if (action === 'close') {
          const id = typeof args.id === 'string' ? args.id : ''
          const closed = manager.close(id)
          return { output: { action, id, closed }, isError: !closed }
        }

        const remotePort = typeof args.remotePort === 'number' ? args.remotePort : 0
        if (!Number.isInteger(remotePort) || remotePort < 1 || remotePort > 65535) {
          return { output: { error: 'a valid remotePort (1-65535) is required' }, isError: true }
        }
        const rawLocalPort = typeof args.localPort === 'number' ? args.localPort : undefined
        if (rawLocalPort !== undefined && rawLocalPort !== 0 && (rawLocalPort < 1024 || rawLocalPort > 65535)) {
          return { output: { error: 'localPort must be omitted/0 or 1024-65535' }, isError: true }
        }
        if (executionTarget.production && context.approvalPolicy === 'auto') {
          const approval = await context.awaitApproval(createApprovalRequest({
            id: 'appr_remote_port_forward_' + context.turnId,
            threadId: context.threadId,
            turnId: context.turnId,
            toolName: 'remote_port_forward',
            summary: 'Open SSH port forward for ' + target.alias + ':' + String(remotePort)
          }))
          if (approval !== 'allow') {
            return { output: { error: 'remote port forward was not approved' }, isError: true }
          }
        }
        const forward = await manager.open({
          alias: target.alias,
          remotePort,
          ...(typeof args.host === 'string' && args.host.trim() ? { remoteHost: args.host.trim() } : {}),
          ...(typeof rawLocalPort === 'number' && rawLocalPort > 0 ? { localPort: rawLocalPort } : {}),
          ...(readyTimeoutMs > 0 ? { waitForReadyMs: readyTimeoutMs } : {})
        })
        return {
          output: {
            target: 'ssh',
            status: 'ready',
            url: forward.url,
            localPort: forward.localPort,
            remotePort: forward.remotePort,
            host: forward.remoteHost,
            ...(typeof args.label === 'string' && args.label.trim() ? { label: args.label.trim() } : {})
          }
        }
      } catch (error) {
        return { output: { error: error instanceof Error ? error.message : String(error) }, isError: true }
      }
    }
  })

  return {
    provider: {
      id: 'remote-port-forward',
      kind: 'built-in',
      enabled: true,
      available: true,
      tools: [tool]
    },
    disposeThreadResources(threadId: string): void {
      const manager = managers.get(threadId)
      if (!manager) return
      manager.closeAll()
      managers.delete(threadId)
    },
    shutdown(): void {
      for (const manager of managers.values()) {
        manager.closeAll()
      }
      managers.clear()
    }
  }
}
