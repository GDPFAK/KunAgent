import { afterEach, describe, expect, it, vi } from 'vitest'
import { RemotePortForwardManager } from './remote-port-forward-manager.js'
import type { SshChildProcess } from './ssh-executor.js'

function fakeChild() {
  const handlers: Record<string, ((...a: unknown[]) => void)[]> = {}
  const child = {
    stdout: null,
    stderr: null,
    on(event: string, listener: (...a: unknown[]) => void) {
      ;(handlers[event] ??= []).push(listener as never)
    },
    kill: vi.fn()
  } as unknown as SshChildProcess
  return { child, emit: (e: string, ...a: unknown[]) => handlers[e]?.forEach((h) => h(...a)) }
}

describe('RemotePortForwardManager', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens a tunnel on an allocated local port and returns a preview url', async () => {
    const { child } = fakeChild()
    const spawn = vi.fn(() => child)
    const manager = new RemotePortForwardManager({ spawn, allocatePort: async () => 54321 })
    const forward = await manager.open({ alias: 'prod', remotePort: 3000 })
    expect(forward.localPort).toBe(54321)
    expect(forward.url).toBe('http://127.0.0.1:54321')
    expect(spawn).toHaveBeenCalledWith('ssh', expect.arrayContaining(['-N', '-T', '-L']))
    expect(manager.list()).toHaveLength(1)
  })

  it('tears down and throws when the tunnel never becomes ready', async () => {
    const { child } = fakeChild()
    let now = 0
    const manager = new RemotePortForwardManager({
      spawn: () => child,
      allocatePort: async () => 5000,
      probeReady: async () => false,
      delay: async () => { now += 100 },
      nowMs: () => now
    })
    await expect(manager.open({ alias: 'prod', remotePort: 3000, waitForReadyMs: 200 })).rejects.toThrow(/did not become ready/)
    expect(child.kill).toHaveBeenCalledWith('SIGTERM')
    expect(manager.list()).toHaveLength(0)
  })

  it('drops a tunnel from the registry when its child exits on its own', async () => {
    const { child, emit } = fakeChild()
    const manager = new RemotePortForwardManager({ spawn: () => child, allocatePort: async () => 5000 })
    await manager.open({ alias: 'prod', remotePort: 8080 })
    expect(manager.list()).toHaveLength(1)
    emit('close', 0, null)
    expect(manager.list()).toHaveLength(0)
  })

  it('escalates from SIGTERM to SIGKILL when a tunnel does not exit', async () => {
    vi.useFakeTimers()
    const { child } = fakeChild()
    const manager = new RemotePortForwardManager({ spawn: () => child, allocatePort: async () => 5000 })
    const forward = await manager.open({ alias: 'prod', remotePort: 8080 })
    manager.close(forward.id)
    expect(child.kill).toHaveBeenCalledWith('SIGTERM')
    await vi.advanceTimersByTimeAsync(2_000)
    expect(child.kill).toHaveBeenCalledWith('SIGKILL')
  })
})
