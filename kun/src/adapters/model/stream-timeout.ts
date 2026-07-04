/**
 * Streaming timeout policy for model requests.
 *
 * Three-tier timeout strategy (addresses GitHub Issue #299):
 * - T1 (first token): time from request start to first data chunk
 * - T2 (inter-token): maximum idle time between consecutive chunks
 * - T3 (total): maximum total wait time for the entire request
 *
 * T2 is already handled by the existing per-chunk idle timeout in
 * compat-model-client.ts (`readStreamChunk`). This module provides
 * T1 and T3 tracking plus telemetry for all three tiers.
 *
 * Timeout events are recorded for observability and diagnostics.
 */

export type TimeoutFallbackStrategy = 'retry' | 'error'

export type StreamTimeoutConfig = {
  /** T1: maximum ms from request start to first chunk (0 = disabled) */
  firstTokenTimeoutMs: number
  /** T2: maximum ms between consecutive chunks (0 = disabled) */
  interTokenTimeoutMs: number
  /** T3: maximum total ms for the entire request (0 = disabled) */
  totalTimeoutMs: number
  /** What to do when a timeout fires */
  fallback: TimeoutFallbackStrategy
  /** Maximum number of retries when fallback is 'retry' */
  maxRetries: number
  /** Base delay between retries */
  retryDelayMs: number
}

export const DEFAULT_STREAM_TIMEOUT_CONFIG: StreamTimeoutConfig = {
  firstTokenTimeoutMs: 30_000,
  interTokenTimeoutMs: 45_000,
  totalTimeoutMs: 600_000,
  fallback: 'retry',
  maxRetries: 2,
  retryDelayMs: 1_000
}

export type TimeoutKind = 'first_token' | 'inter_token' | 'total'

export type StreamTimeoutEvent = {
  kind: TimeoutKind
  provider: string
  model: string
  threadId: string
  turnId: string
  durationMs: number
  fallback: TimeoutFallbackStrategy
  retryAttempt: number
}

export type TimeoutCheckResult =
  | { kind: 'ok' }
  | { kind: 'timeout'; timeoutKind: TimeoutKind; message: string }

/**
 * Tracks timing for a single streaming request.
 *
 * Important: T1 (first token) check MUST be started BEFORE awaiting the
 * initial response. If the first token timeout check happens after await,
 * it will never trigger because the promise resolves only after headers
 * are received.
 */
export class StreamTimeoutTracker {
  private readonly config: StreamTimeoutConfig
  private readonly metadata: { provider: string; model: string; threadId: string; turnId: string }
  private startTime = 0
  private lastChunkTime = 0
  private chunkCount = 0
  private retryCount = 0
  private aborted = false

  constructor(
    config: Partial<StreamTimeoutConfig>,
    metadata: { provider: string; model: string; threadId: string; turnId: string }
  ) {
    this.config = { ...DEFAULT_STREAM_TIMEOUT_CONFIG, ...config }
    this.metadata = metadata
  }

  /**
   * Mark the request as started. MUST be called BEFORE the HTTP fetch.
   */
  start(): void {
    this.startTime = Date.now()
    this.lastChunkTime = this.startTime
    this.chunkCount = 0
    this.aborted = false
  }

  /**
   * T1 check: have we waited too long for the first token?
   * Call this after the HTTP response headers arrive.
   */
  checkFirstToken(): TimeoutCheckResult {
    if (this.chunkCount > 0) return { kind: 'ok' }
    if (this.aborted) return { kind: 'ok' }
    const elapsed = Date.now() - this.startTime
    if (this.config.firstTokenTimeoutMs > 0 && elapsed > this.config.firstTokenTimeoutMs) {
      return {
        kind: 'timeout',
        timeoutKind: 'first_token',
        message: `First token timeout after ${elapsed}ms (limit: ${this.config.firstTokenTimeoutMs}ms)`
      }
    }
    return { kind: 'ok' }
  }

  /**
   * Call on every data chunk received. Checks T2 (inter-token) and
   * T3 (total) timeouts.
   */
  onChunk(): TimeoutCheckResult {
    if (this.aborted) return { kind: 'ok' }
    const now = Date.now()
    const elapsed = now - this.startTime

    // T3: total timeout
    if (this.config.totalTimeoutMs > 0 && elapsed > this.config.totalTimeoutMs) {
      return {
        kind: 'timeout',
        timeoutKind: 'total',
        message: `Total timeout after ${elapsed}ms (limit: ${this.config.totalTimeoutMs}ms)`
      }
    }

    // T2: inter-token timeout (only after first chunk)
    if (this.chunkCount > 0 && this.config.interTokenTimeoutMs > 0) {
      const idleMs = now - this.lastChunkTime
      if (idleMs > this.config.interTokenTimeoutMs) {
        return {
          kind: 'timeout',
          timeoutKind: 'inter_token',
          message: `Inter-token timeout after ${idleMs}ms idle (limit: ${this.config.interTokenTimeoutMs}ms)`
        }
      }
    }

    this.lastChunkTime = now
    this.chunkCount++
    return { kind: 'ok' }
  }

  /** Mark this tracker as aborted (user cancelled the turn). */
  markAborted(): void {
    this.aborted = true
  }

  get retries(): number {
    return this.retryCount
  }

  canRetry(): boolean {
    return this.config.fallback === 'retry' && this.retryCount < this.config.maxRetries
  }

  recordRetry(): void {
    this.retryCount++
    // Reset timers for the retry attempt
    this.startTime = Date.now()
    this.lastChunkTime = this.startTime
    this.chunkCount = 0
  }

  elapsedMs(): number {
    return Date.now() - this.startTime
  }

  getConfig(): StreamTimeoutConfig {
    return this.config
  }

  createTelemetryEvent(timeoutKind: TimeoutKind): StreamTimeoutEvent {
    return {
      kind: timeoutKind,
      provider: this.metadata.provider,
      model: this.metadata.model,
      threadId: this.metadata.threadId,
      turnId: this.metadata.turnId,
      durationMs: this.elapsedMs(),
      fallback: this.config.fallback,
      retryAttempt: this.retryCount
    }
  }
}

/**
 * Create an AbortSignal that fires when the T1 timeout elapses.
 * Wire this signal into the fetch call so the timeout can interrupt
 * an in-flight HTTP request.
 */
export function createFirstTokenTimeoutSignal(
  timeoutMs: number,
  parentSignal?: AbortSignal
): { signal: AbortSignal; cancel: () => void } {
  if (timeoutMs <= 0) {
    const controller = new AbortController()
    if (parentSignal) {
      if (parentSignal.aborted) controller.abort()
      else parentSignal.addEventListener('abort', () => controller.abort(), { once: true })
    }
    return { signal: controller.signal, cancel: () => controller.abort() }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => {
    if (!controller.signal.aborted) controller.abort()
  }, timeoutMs)

  if (parentSignal) {
    if (parentSignal.aborted) {
      clearTimeout(timer)
      controller.abort()
    } else {
      parentSignal.addEventListener('abort', () => {
        clearTimeout(timer)
        controller.abort()
      }, { once: true })
    }
  }

  return {
    signal: controller.signal,
    cancel: () => {
      clearTimeout(timer)
    }
  }
}

export function normalizeStreamTimeoutConfig(
  config?: Partial<StreamTimeoutConfig> | null
): StreamTimeoutConfig {
  return { ...DEFAULT_STREAM_TIMEOUT_CONFIG, ...(config ?? {}) }
}
