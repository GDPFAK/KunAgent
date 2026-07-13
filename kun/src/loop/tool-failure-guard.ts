/** Default number of consecutive tool failures before the turn stops. */
const DEFAULT_THRESHOLD = 3

/** Tools that are exempt from failure counting (interactive GUI gates). */
const EXEMPT_TOOL_NAMES = new Set(['user_input', 'request_user_input'])

/**
 * Turn-scoped consecutive tool failure guard.
 *
 * Detects when the model keeps calling tools that fail one after another
 * and signals to the caller that the turn should be force-stopped,
 * preventing an infinite token-burning loop.
 *
 * Lifecycle (managed by AgentLoop):
 *   new ToolFailureGuard(threshold)  — created at turn start
 *   reset()                           — called between turns
 *   recordSuccess()                   — any successful tool resets the counter
 *   recordFailure(toolName)           — returns verdict; caller acts on it
 */
export class ToolFailureGuard {
  private readonly threshold: number
  private consecutive = 0
  private lastToolName = ''

  constructor(threshold: number = DEFAULT_THRESHOLD) {
    this.threshold = Math.max(1, Math.floor(threshold))
  }

  /**
   * Record a successful tool execution.
   * Resets the consecutive-failure counter.
   */
  recordSuccess(toolName: string): void {
    if (EXEMPT_TOOL_NAMES.has(toolName)) return
    this.consecutive = 0
    this.lastToolName = toolName
  }

  /**
   * Record a tool execution failure.
   *
   * @returns `{ stop: true, reason }` when the consecutive-failure counter
   *          reaches the threshold, or `{ stop: false }` otherwise.
   */
  recordFailure(toolName: string): { stop: boolean; reason?: string } {
    if (EXEMPT_TOOL_NAMES.has(toolName)) return { stop: false }

    this.consecutive += 1
    this.lastToolName = toolName

    if (this.consecutive >= this.threshold) {
      return {
        stop: true,
        reason:
          `Tool execution keeps failing (${this.consecutive} consecutive failures ` +
          `in this turn, threshold: ${this.threshold}). ` +
          'The model appears stuck in a failure loop. ' +
          'Stop retrying the same or similar tool calls and instead rephrase the approach, ' +
          'ask the user for guidance, or provide a different solution.'
      }
    }

    return { stop: false }
  }

  /** Current consecutive failure count (exposed for tests / telemetry). */
  get failureCount(): number {
    return this.consecutive
  }

  /**
   * Reset the guard for a fresh turn.
   * The threshold stays the same (set at construction).
   */
  reset(): void {
    this.consecutive = 0
    this.lastToolName = ''
  }
}
