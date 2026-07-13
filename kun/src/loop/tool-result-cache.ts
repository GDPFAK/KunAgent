import { createHash } from 'node:crypto'
import type { ToolCallLike } from '../ports/tool-host.js'

/**
 * Cacheable key derived from tool name + stable-serialised arguments.
 */
type CacheKey = string

/**
 * Cached payload: the output returned to the model, and a flag to
 * distinguish "this is from cache" for telemetry.
 */
interface CacheEntry {
  output: unknown
  hits: number
}

// ── Read-only tool detection ──────────────────────────────────────

const READ_ONLY_TOOL_NAMES = new Set([
  'read',
  'grep',
  'find',
  'ls',
  'search',
  'list',
  'read_file',
  'list_directory'
])

const TOOL_KIND_READ_ONLY: ReadonlySet<string | undefined> = new Set([
  undefined,
  'tool_call'   // default kind for generic read-only tools
])

const FILE_CHANGE_TOOL_NAMES = new Set([
  'write',
  'edit',
  'edit_diff',
  'apply_patch',
  'delete',
  'move',
  'mkdir'
])

/**
 * Hash the tool call arguments into a stable string key.
 *
 * We use SHA-1 of the canonical JSON so that:
 *  - deep equality (not reference equality) drives cache hits
 *  - argument order does not matter
 *  - the key is bounded (~44 bytes) regardless of payload size
 */
function hashArgs(args: Record<string, unknown>): string {
  const canonical = JSON.stringify(args, Object.keys(args).sort())
  return createHash('sha1').update(canonical).digest('base64url')
}

// ── Public API ────────────────────────────────────────────────────

export class ToolResultCache {
  private readonly cache = new Map<CacheKey, CacheEntry>()
  private readonly maxEntries: number

  /**
   * @param maxEntries  Maximum number of cached tool results.
   *                    LRU eviction discards the oldest entry when exceeded.
   */
  constructor(maxEntries = 20) {
    this.maxEntries = Math.max(1, maxEntries)
  }

  // ── Query ──────────────────────────────────────────────────────

  /**
   * Attempt a cache lookup.
   *
   * @returns  `{ output }` when cached, or `null` for a cache miss.
   */
  get(toolName: string, args: Record<string, unknown>): { output: unknown } | null {
    const key = this.makeKey(toolName, args)
    const entry = this.cache.get(key)
    if (!entry) return null
    entry.hits += 1
    // Move to end (most-recently-used) by re-inserting
    this.cache.delete(key)
    this.cache.set(key, entry)
    return { output: entry.output }
  }

  /**
   * Store a tool result in the cache.
   *
   * Only caches if the tool looks read-only.  Silently ignores
   * mutating tools (they go through the normal path).
   */
  set(toolName: string, args: Record<string, unknown>, output: unknown): void {
    if (!isReadOnlyTool(toolName)) return
    const key = this.makeKey(toolName, args)
    if (this.cache.has(key)) return   // already cached, nothing to do
    // LRU eviction
    while (this.cache.size >= this.maxEntries) {
      const oldest = this.cache.keys().next()
      if (oldest.done) break
      this.cache.delete(oldest.value)
    }
    this.cache.set(key, { output, hits: 0 })
  }

  // ── Invalidation ───────────────────────────────────────────────

  /**
   * Invalidate the ENTIRE cache.
   *
   * Called after any file-mutation tool completes so that subsequent
   * reads do not return stale content.
   */
  invalidateAll(): void {
    this.cache.clear()
  }

  /**
   * Return true when the tool name or toolKind identifies a mutating
   * tool that should invalidate the cache.
   */
  static invalidatesCache(toolName: string, toolKind?: string): boolean {
    if (toolKind === 'file_change') return true
    return FILE_CHANGE_TOOL_NAMES.has(toolName)
  }

  // ── Turn lifecycle ─────────────────────────────────────────────

  /** Discard all cached entries (fresh turn). */
  reset(): void {
    this.cache.clear()
  }

  /**
   * Number of unique keys currently cached.
   * Exposed primarily for tests / telemetry.
   */
  get size(): number {
    return this.cache.size
  }

  /**
   * Total cache-hit count across all entries.
   */
  get totalHits(): number {
    let sum = 0
    for (const entry of this.cache.values()) sum += entry.hits
    return sum
  }

  // ── Internals ──────────────────────────────────────────────────

  private makeKey(toolName: string, args: Record<string, unknown>): CacheKey {
    return `${toolName}::${hashArgs(args)}`
  }
}

// ── Package-level helpers ─────────────────────────────────────────

/**
 * Determine whether a tool is read-only and thus safe to cache.
 */
export function isReadOnlyTool(toolName: string, toolKind?: string): boolean {
  if (toolKind === 'file_change') return false
  if (toolKind && !TOOL_KIND_READ_ONLY.has(toolKind)) return false
  if (FILE_CHANGE_TOOL_NAMES.has(toolName)) return false
  return READ_ONLY_TOOL_NAMES.has(toolName)
}
