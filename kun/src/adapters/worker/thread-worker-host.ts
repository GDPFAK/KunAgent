import { Worker } from 'node:worker_threads'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { WorkerTaskRequest, WorkerTaskResult } from './tool-worker.js'

export type WorkerPoolOptions = {
  poolSize?: number
  workerPath?: string
  taskTimeoutMs?: number
}

type PendingTask = {
  taskId: string
  resolve: (result: unknown) => void
  reject: (error: unknown) => void
  timer?: ReturnType<typeof setTimeout>
}

/**
 * Pre-warmed Worker thread pool for CPU-heavy tool execution.
 * Workers are created at startup and reused. Crashed workers are auto-restarted.
 * All tasks have a configurable timeout; timed-out tasks reject and the worker is terminated.
 */
export class ThreadWorkerHost {
  private workers: Worker[] = []
  private idle: number[] = []
  private pending = new Map<string, PendingTask>()
  private taskTimeoutMs: number

  constructor(options: WorkerPoolOptions = {}) {
    this.taskTimeoutMs = options.taskTimeoutMs ?? 60_000
    const size = options.poolSize ?? 2
    const workerPath = options.workerPath ?? join(dirname(fileURLToPath(import.meta.url)), 'tool-worker.js')
    for (let i = 0; i < size; i++) this.spawnWorker(i, workerPath)
  }

  private spawnWorker(index: number, workerPath: string): void {
    const worker = new Worker(workerPath)
    this.workers[index] = worker
    this.idle.push(index)
    worker.on('message', (result: WorkerTaskResult) => {
      this.idle.push(index)
      const pending = this.pending.get(result.taskId)
      if (!pending) return
      clearTimeout(pending.timer)
      this.pending.delete(result.taskId)
      if (result.ok) pending.resolve(result.result)
      else pending.reject(new Error(result.error))
    })
    worker.on('error', (err) => {
      console.warn('[worker] error:', err instanceof Error ? err.message : String(err))
      this.spawnWorker(index, workerPath)
    })
    worker.on('exit', (code) => {
      if (code !== 0) this.spawnWorker(index, workerPath)
    })
  }

  async execute(taskId: string, tool: WorkerTaskRequest['tool'], args: Record<string, unknown>): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      if (this.idle.length === 0) {
        reject(new Error('all workers busy'))
        return
      }
      const idx = this.idle.shift()!
      const timer = setTimeout(() => {
        this.pending.delete(taskId)
        this.workers[idx].terminate()
        this.spawnWorker(idx, join(dirname(fileURLToPath(import.meta.url)), 'tool-worker.js'))
        reject(new Error('task timed out'))
      }, this.taskTimeoutMs)
      this.pending.set(taskId, { taskId, resolve, reject, timer })
      this.workers[idx].postMessage({ taskId, tool, args } satisfies WorkerTaskRequest)
    })
  }

  cancel(taskId: string): void {
    const pending = this.pending.get(taskId)
    if (pending) {
      clearTimeout(pending.timer)
      this.pending.delete(taskId)
      pending.reject(new Error('cancelled'))
    }
  }

  async shutdown(): Promise<void> {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(new Error('shutting down'))
    }
    this.pending.clear()
    await Promise.all(this.workers.map((w) => w.terminate()))
    this.workers = []
    this.idle = []
  }
}
