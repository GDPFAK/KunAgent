import type { TurnItem } from '../../contracts/items.js'
import type { ImmutablePrefix } from '../../cache/immutable-prefix.js'
import type { FactAnchor, FactAnchorExtractOptions } from './fact-anchor.js'
import { extractFactAnchorsFromTurn, mergeFactAnchors, formatFactAnchors } from './fact-anchor.js'
import { isolateCurrentTurn, createTurnBoundaryMarker, type TurnIsolationOptions } from './turn-isolator.js'
import {
  buildStablePrefix,
  rebuildStablePrefix,
  stablePrefixFromImmutable,
  detectPrefixChanges,
  type StablePrefix,
  type StablePrefixBuildOptions,
} from './stable-prefix.js'

/**
 * Compiled context for a single turn.
 *
 * Separates the stable prefix (cacheable, byte-deterministic) from the
 * active working set (current turn only). The model receives the prefix
 * as background context and the active set as "what to work on now."
 */
export type CompiledContext = {
  /** The stable prefix text (system prompt + constraints + fact anchors). */
  prefixText: string
  /** SHA256 fingerprint of the prefix for cache keying. */
  prefixFingerprint: string
  /** Active working set items (current turn only). */
  activeItems: TurnItem[]
  /** Historical items (previous turns, managed by compaction). */
  historicalItems: TurnItem[]
  /** Boundary marker item between historical and active sets. */
  boundaryItem: TurnItem
  /** Turn boundary ID for provider cache scoping. */
  turnBoundaryId: string
  /** The current turn ID. */
  currentTurnId: string
  /** Number of completed turns. */
  completedTurnCount: number
}

export type ContextCompilerOptions = {
  factAnchor?: FactAnchorExtractOptions
  turnIsolation?: TurnIsolationOptions
  stablePrefix?: StablePrefixBuildOptions
}

/**
 * Context Compiler.
 *
 * Orchestrates three concerns that together fix GitHub Issues #247, #155, #229:
 *
 * 1. **Fact Anchors (#247)**: Extracts confirmed decisions from each completed
 *    turn and injects them into the stable prefix, preventing context drift.
 *
 * 2. **Turn Isolation (#155)**: Partitions conversation items into historical
 *    and active sets, preventing old keywords from leaking into current thinking.
 *
 * 3. **Stable Prefix (#229)**: Builds a byte-deterministic prefix block that
 *    can be cached by the provider, preventing O(n²) re-processing.
 *
 * IMPORTANT: This class EXTENDS the existing `ImmutablePrefix`
 * (kun/src/cache/immutable-prefix.ts), not replaces it. The ImmutablePrefix
 * remains the source of truth for system prompt, tools, pinned constraints,
 * and few-shots. The ContextCompiler adds fact anchors and turn-level
 * compilation on top.
 */
export class ContextCompiler {
  private anchors: FactAnchor[] = []
  private prefix: StablePrefix | null = null
  private options: ContextCompilerOptions

  constructor(options: ContextCompilerOptions = {}) {
    this.options = options
  }

  // -----------------------------------------------------------------------
  // Fact Anchors (#247)
  // -----------------------------------------------------------------------

  /**
   * Extract fact anchors from a completed turn and merge them into the
   * compiler's anchor list. Call this after each turn completes.
   */
  extractAnchorsFromTurn(turnItems: TurnItem[]): FactAnchor[] {
    const newAnchors = extractFactAnchorsFromTurn(turnItems, this.options.factAnchor)
    if (newAnchors.length === 0) return []

    this.anchors = mergeFactAnchors(this.anchors, newAnchors)
    return newAnchors
  }

  /**
   * Load fact anchors from a persisted conversation history.
   * Re-extracts anchors from all completed turns.
   */
  loadAnchorsFromHistory(items: TurnItem[]): void {
    const turns = new Map<string, TurnItem[]>()
    for (const item of items) {
      if (!turns.has(item.turnId)) {
        turns.set(item.turnId, [])
      }
      turns.get(item.turnId)!.push(item)
    }

    this.anchors = []
    for (const [, turnItems] of turns) {
      const extracted = extractFactAnchorsFromTurn(turnItems, this.options.factAnchor)
      if (extracted.length > 0) {
        this.anchors = mergeFactAnchors(this.anchors, extracted)
      }
    }
  }

  /**
   * Get all current fact anchors (for diagnostics).
   */
  getFactAnchors(): readonly FactAnchor[] {
    return this.anchors
  }

  // -----------------------------------------------------------------------
  // Context Compilation
  // -----------------------------------------------------------------------

  /**
   * Compile the context for a turn.
   *
   * 1. Builds (or rebuilds) the stable prefix from ImmutablePrefix + fact anchors.
   * 2. Isolates the current turn from historical items.
   * 3. Produces a `CompiledContext` ready for request building.
   *
   * @param items Full conversation history
   * @param currentTurnId The turn currently being built
   * @param immutable The existing ImmutablePrefix (system prompt, tools, etc.)
   */
  compileTurn(
    items: TurnItem[],
    currentTurnId: string,
    immutable: ImmutablePrefix
  ): CompiledContext {
    // Build or update stable prefix
    if (!this.prefix) {
      this.prefix = stablePrefixFromImmutable(immutable, this.anchors, this.options.stablePrefix)
    } else {
      const nextComponents = {
        systemPrompt: immutable.systemPrompt,
        tools: immutable.tools,
        pinnedConstraints: immutable.pinnedConstraints,
        factAnchors: this.anchors,
        fewShots: immutable.fewShots,
      }
      this.prefix = rebuildStablePrefix(this.prefix, nextComponents, this.options.stablePrefix)
    }

    // Isolate current turn
    const isolation = isolateCurrentTurn(items, currentTurnId, this.options.turnIsolation)
    const boundaryItem = createTurnBoundaryMarker(currentTurnId)

    return {
      prefixText: this.prefix.content,
      prefixFingerprint: this.prefix.fingerprint,
      activeItems: isolation.activeTurnItems,
      historicalItems: isolation.historicalItems,
      boundaryItem,
      turnBoundaryId: isolation.turnBoundaryId,
      currentTurnId: isolation.currentTurnId,
      completedTurnCount: isolation.completedTurnCount,
    }
  }

  /**
   * Apply the compiled context to a request's system prompt.
   *
   * Returns an enriched system prompt with fact anchors injected.
   * The original ImmutablePrefix.systemPrompt is preserved as the base.
   */
  applyToRequest(compiled: CompiledContext): {
    enrichedSystemPrompt: string
    prefixFingerprint: string
    turnBoundaryId: string
  } {
    return {
      enrichedSystemPrompt: compiled.prefixText,
      prefixFingerprint: compiled.prefixFingerprint,
      turnBoundaryId: compiled.turnBoundaryId,
    }
  }

  /**
   * Format fact anchors for display/diagnostics.
   */
  formatAnchors(): string {
    return formatFactAnchors(this.anchors)
  }

  /**
   * Reset the compiler state (e.g., on thread reset).
   */
  reset(): void {
    this.anchors = []
    this.prefix = null
  }

  // -----------------------------------------------------------------------
  // Diagnostics
  // -----------------------------------------------------------------------

  /**
   * Verify prefix stability: returns true if the prefix would not change
   * given the same components. Used in tests.
   */
  verifyPrefixStability(immutable: ImmutablePrefix): boolean {
    if (!this.prefix) return false

    const nextComponents = {
      systemPrompt: immutable.systemPrompt,
      tools: immutable.tools,
      pinnedConstraints: immutable.pinnedConstraints,
      factAnchors: this.anchors,
      fewShots: immutable.fewShots,
    }

    const { changed } = detectPrefixChanges(this.prefix, nextComponents)
    return !changed
  }
}
