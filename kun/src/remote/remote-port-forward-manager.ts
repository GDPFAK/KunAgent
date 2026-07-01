import { buildSshPortForwardArgv, type SshPortForwardOptions } from './ssh-port-forward.js'
import type { SshChildProcess, SshSpawnFn } from './ssh-executor.js'

export type PortForward = {
  id: string
  localPort: number
  remotePort: number
  remoteHost: string
  alias: string
  url: string
}

export type AllocatePortFn = () => Promise<number>

export type RemotePortForwardManagerDeps = {
  spawn: SshSpawnFn
  allocatePort: AllocatePortFn
  nowMs?: () => number
  probeReady?: (port: number) => Promise<boolean>
  delay?: (ms: number) => Promise<void>
}

type ActiveForward = {
  forward: PortForward
  child: SshChildProcess
  hardKillTimer?: ReturnType<typeof setTimeout>
}

const DEFAULT_READY_PROBE_INTERVAL_MS = 150

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    if (timer && typeof timer === 'object' && 'unref' in timer) {
      ;(timer as { unref: () => void }).unref()
    }
  })
}

export class RemotePortForwardManager {
  private readonly forwards = new Map<string, ActiveForward>()
  private counter = 0

  constructor(private readonly deps: RemotePortForwardManagerDeps) {}

  async open(options: Omit<SshPortForwardOptions, 'localPort'> & { localPort?: number; waitForReadyMs?: number }): Promise<PortForward> {
    const localPort = options.localPort ?? (await this.deps.allocatePort())
    const argv = buildSshPortForwardArgv({ ...options, localPort })
    const child = this.deps.spawn('ssh', argv)
    const id = 'pf_' + String(++this.counter)
    const remoteHost = options.remoteHost ?? '127.0.0.1'
    const forward: PortForward = {
      id,
      localPort,
      remotePort: options.remotePort,
      remoteHost,
      alias: options.alias,
      url: 'http://127.0.0.1:' + String(localPort)
    }
    const active: ActiveForward = { forward, child }
    child.on('close', () => {
      if (active.hardKillTimer) clearTimeout(active.hardKillTimer)
      this.forwards.delete(id)
    })
    child.on('error', () => {
      if (active.hardKillTimer) clearTimeout(active.hardKillTimer)
      this.forwards.delete(id)
    })
    this.forwards.set(id, active)

    if (options.waitForReadyMs && options.waitForReadyMs > 0 && this.deps.probeReady) {
      await this.waitForReady(id, localPort, options.waitForReadyMs)
    }
    return forward
  }

  list(): PortForward[] {
    return [...this.forwards.values()].map((entry) => entry.forward)
  }

  close(id: string): boolean {
    const entry = this.forwards.get(id)
    if (!entry) return false
    this.terminate(entry)
    this.forwards.delete(id)
    return true
  }

  closeAll(): void {
    for (const entry of this.forwards.values()) {
      this.terminate(entry)
    }
    this.forwards.clear()
  }

  private async waitForReady(id: string, port: number, timeoutMs: number): Promise<void> {
    const now = this.deps.nowMs ?? (() => Date.now())
    const delay = this.deps.delay ?? defaultDelay
    const probe = this.deps.probeReady!
    const deadline = now() + timeoutMs
    for (;;) {
      if (!this.forwards.has(id)) {
        throw new Error('SSH tunnel exited before it became ready')
      }
      if (await probe(port)) return
      if (now() >= deadline) {
        this.close(id)
        throw new Error('SSH tunnel did not become ready within ' + String(timeoutMs) + 'ms')
      }
      await delay(DEFAULT_READY_PROBE_INTERVAL_MS)
    }
  }

  private terminate(entry: ActiveForward): void {
    entry.child.kill('SIGTERM')
    if (entry.hardKillTimer) return
    entry.hardKillTimer = setTimeout(() => {
      try {
        entry.child.kill('SIGKILL')
      } catch {
        // already exited
      }
    }, 2_000)
    if (typeof entry.hardKillTimer === 'object' && 'unref' in entry.hardKillTimer) {
      ;(entry.hardKillTimer as { unref: () => void }).unref()
    }
  }
}
