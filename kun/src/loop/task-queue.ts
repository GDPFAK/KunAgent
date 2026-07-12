import type { TurnItem } from '../contracts/items.js'

export type QueuedTask = {
  id: string
  turnId: string
  priority: number
  execute: () => Promise<unknown>
  resolve: (value: unknown | PromiseLike<unknown>) => void
  reject: (reason?: unknown) => void
  startedAt?: number
}

export type TaskQueueOptions = {
  maxConcurrency?: number
}

export class TaskQueue {
  private queue: QueuedTask[] = []
  private active = 0
  private readonly maxConcurrency: number

  constructor(options: TaskQueueOptions = {}) {
    this.maxConcurrency = options.maxConcurrency ?? 2
  }

  push<T>(id: string, turnId: string, execute: () => Promise<T>, priority = 0): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task: QueuedTask = { id, turnId, priority, execute: execute as () => Promise<unknown>, resolve: resolve as (v: unknown) => void, reject }
      const idx = this.queue.findIndex((t) => t.priority < priority)
      if (idx < 0) this.queue.push(task)
      else this.queue.splice(idx, 0, task)
      this.processNext()
    })
  }

  cancel(turnId: string): void {
    const remaining: QueuedTask[] = []
    for (const task of this.queue) {
      if (task.turnId === turnId) task.reject(new Error('task cancelled'))
      else remaining.push(task)
    }
    this.queue = remaining
  }

  clear(): void {
    for (const t of this.queue) t.reject(new Error('queue cleared'))
    this.queue = []
  }

  get pendingCount(): number { return this.queue.length }
  get activeCount(): number { return this.active }

  private processNext(): void {
    while (this.active < this.maxConcurrency && this.queue.length > 0) {
      const task = this.queue.shift()!
      this.active++
      task.startedAt = Date.now()
      Promise.resolve(task.execute()).then(
        (r) => { task.resolve(r); this.active--; this.processNext() },
        (e) => { task.reject(e); this.active--; this.processNext() }
      )
    }
  }
}
