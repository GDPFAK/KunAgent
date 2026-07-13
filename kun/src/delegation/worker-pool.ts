import { Worker } from 'node:worker_threads'
import { EventEmitter } from 'node:events'

/**
 * Lightweight Worker pool for tool execution. Manages a fixed-size set
 * of reusable Worker threads, dispatches tasks to idle workers, and
 * publishes lifecycle events for GUI/SSE visibility.
 *
 * Currently designed as a standalone utility; the DelegationRuntime
 * acquires/releases workers through the pool rather than spawning
 * one-off Workers per child.
 */
export interface WorkerPoolTask {
  /** Opaque payload sent to the worker. */
  data: unknown
  /** Callback when the worker posts a result message (not progress). */
  resolve: (result: unknown) => void
  /** Callback on error / worker crash. */
  reject: (error: Error) => void
  /** Optional handler for streaming progress messages from the worker. */
  onProgress?: (msg: unknown) => void
}

export interface WorkerPoolOptions {
  maxWorkers: number
  /** Path to the worker script (resolved absolute path). */
  workerScript: string
  /** Optional function called for lifecycle events (e.g. publish to EventBus). */
  onEvent?: (event: { kind: string; workerId?: string; childId?: string; exitCode?: number; text?: string; isError?: boolean; position?: number; count?: number }) => void
  /** Max times a crashed task is retried on a fresh worker. Default: 1. */
  retryLimit?: number
}

interface PoolWorker {
  id: string
  worker: Worker
  busy: boolean
  currentTask: WorkerPoolTask | null
}

export class WorkerPool {
  private readonly pool: PoolWorker[] = []
  private readonly queue: Array<{ task: WorkerPoolTask; childId?: string }> = []
  private nextWorkerId = 0
  private closed = false

  constructor(private readonly options: WorkerPoolOptions) {}

  get maxWorkers(): number { return this.options.maxWorkers }
  get activeCount(): number { return this.pool.filter((w) => w.busy).length }
  get idleCount(): number { return this.pool.filter((w) => !w.busy).length }
  get queuedCount(): number { return this.queue.length }
  get totalCount(): number { return this.pool.length }

  async start(): Promise<void> {
    for (let i = 0; i < this.options.maxWorkers; i++) {
      await this.spawnWorker()
    }
  }

  /** Dispatch a task to the pool. Returns when a worker completes it. */
  execute(task: WorkerPoolTask, childId?: string): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      const wrapped: WorkerPoolTask & { _retryCount?: number } = {
        ...task,
        _retryCount: 0,
        resolve: (result) => { resolve(result); task.resolve(result) },
        reject: (err) => { reject(err); task.reject(err) }
      }
      const idle = this.pool.find((w) => !w.busy)
      if (idle) {
        this.dispatch(idle, wrapped)
      } else if (this.pool.length < this.options.maxWorkers) {
        // Lazy spawn if not all workers are created yet
        this.spawnWorker().then(() => {
          const w = this.pool.find((w) => !w.busy)
          if (w) this.dispatch(w, wrapped)
          else this.enqueue(wrapped, childId)
        })
      } else {
        this.enqueue(wrapped, childId)
      }
    })
  }

  /** Gracefully shut down all workers. */
  async close(): Promise<void> {
    this.closed = true
    // Reject queued tasks
    for (const entry of this.queue) {
      entry.task.reject(new Error('worker pool closed'))
    }
    this.queue.length = 0
    // Terminate all workers
    await Promise.allSettled(
      this.pool.map(async (pw) => {
        pw.busy = false
        pw.currentTask = null
        try { await pw.worker.terminate() } catch { /* ignore */ }
      })
    )
    this.pool.length = 0
  }

  /** Return a running worker's id by childId (for diagnostics). */
  workerIdForChild(childId: string): string | undefined {
    const pw = this.pool.find((w) => w.currentTask && w.busy)
    return pw?.id
  }

  private async spawnWorker(): Promise<void> {
    const id = `worker_${++this.nextWorkerId}`
    const worker = new Worker(this.options.workerScript, {
      workerData: { workerId: id }
    })
    const pw: PoolWorker = { id, worker, busy: false, currentTask: null }

    worker.on('message', (msg: unknown) => {
      const m = msg as Record<string, unknown>
      if (m?._relay === 'progress' && pw.currentTask?.onProgress) {
        pw.currentTask.onProgress(m)
        this.emitEvent({ kind: 'worker_pool:task_progress', workerId: id, childId: m.childId as string, text: m.text as string, isError: m.isError as boolean })
        return
      }
      if (pw.currentTask) {
        pw.currentTask.resolve(msg)
        pw.currentTask = null
        pw.busy = false
        this.dispatchNext()
      }
    })

    worker.on('error', (err: unknown) => {
      this.handleWorkerCrash(pw, err instanceof Error ? err : new Error(String(err)))
    })

    worker.on('exit', (code: number | null) => {
      if (!this.closed && pw.busy && pw.currentTask) {
        this.handleWorkerCrash(pw, new Error(`worker exited with code ${code ?? 'null'}`))
      }
    })

    this.pool.push(pw)
    this.emitEvent({ kind: 'worker_pool:worker_started', workerId: id })
  }

  private handleWorkerCrash(pw: PoolWorker, error: Error): void {
    const childId = pw.currentTask ? (pw.currentTask.data as Record<string, unknown>)?.childId as string : undefined
    this.emitEvent({ kind: 'worker_pool:worker_crashed', workerId: pw.id, childId, exitCode: (error as any)?.exitCode ?? undefined, text: error.message, isError: true })
    const task = pw.currentTask
    pw.currentTask = null
    pw.busy = false
    // Remove dead worker
    const idx = this.pool.indexOf(pw)
    if (idx >= 0) this.pool.splice(idx, 1)
    // Spawn replacement worker
    const replace = () => { if (!this.closed) this.spawnWorker().then(() => this.dispatchNext()) }

    if (task && !this.closed) {
      const retryCount = (task as any)._retryCount ?? 0
      const retryLimit = this.options.retryLimit ?? 1
      if (retryCount < retryLimit) {
        // Retry: re-enqueue the task with incremented retry count
        (task as any)._retryCount = retryCount + 1
        this.emitEvent({ kind: 'worker_pool:task_retrying', workerId: pw.id, childId, text: 'attempt ' + (retryCount + 1) + '/' + retryLimit + ': ' + error.message, isError: false })
        this.queue.unshift({ task, childId })
        replace()
      } else {
        // Max retries exhausted — fail the task
        this.emitEvent({ kind: 'worker_pool:task_failed', workerId: pw.id, childId, text: error.message, isError: true })
        task.reject(error)
        replace()
      }
    } else {
      replace()
    }
  }

  private dispatch(pw: PoolWorker, task: WorkerPoolTask): void {
    pw.busy = true
    pw.currentTask = task
    pw.worker.postMessage(task.data)
  }

  private enqueue(task: WorkerPoolTask, childId?: string): void {
    const position = this.queue.length + 1
    this.emitEvent({ kind: 'worker_pool:task_queued', childId, position })
    this.queue.push({ task, childId })
  }

  private dispatchNext(): void {
    if (this.queue.length === 0) return
    const idle = this.pool.find((w) => !w.busy)
    if (!idle) return
    const entry = this.queue.shift()
    if (entry) this.dispatch(idle, entry.task)
  }

  private emitEvent(event: { kind: string; workerId?: string; childId?: string; exitCode?: number; text?: string; isError?: boolean; position?: number; count?: number }): void {
    this.options.onEvent?.(event)
  }
}
