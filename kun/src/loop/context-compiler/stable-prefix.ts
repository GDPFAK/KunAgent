import { createHash } from 'node:crypto'
import type { ImmutablePrefix } from '../../cache/immutable-prefix.js'
import type { TurnItem } from '../../contracts/items.js'
import type { ModelToolSpec } from '../../ports/model-client.js'
import type { FactAnchor } from './fact-anchor.js'
import { formatFactAnchors } from './fact-anchor.js'

/**
 * A compiled stable prefix block. Contains all components that do not
 * change from turn to turn, formatted as a byte-stable string suitable
 * for provider-level prefix caching (e.g. DeepSeek Prompt Cache).
 *
 * The stable prefix builds ON TOP OF the existing `ImmutablePrefix`
 * (kun/src/cache/immutable-prefix.ts), adding fact anchors. It does
 * not replace ImmutablePrefix — it extends it with turn-level stability
 * guarantees for fact anchor growth.
 *
 * Addresses GitHub Issue #229: when none of the prefix components change
 * between turns, the prefix block is byte-identical and can be reused by
 * the provider's prefix cache, turning O(n²) context growth into O(n).
 */
export type StablePrefix = {
  /** SHA256 hash of the compiled prefix content. */
  fingerprint: string
  /** The compiled prefix text block (deterministic). */
  content: string
  /** Source components used to build this prefix. */
  components: StablePrefixComponents
  /** Revision number, incremented on each rebuild. */
  revision: number
  /** ISO timestamp of last build. */
  builtAt: string
  /** Whether this prefix is currently valid. */
  valid: boolean
}

export type StablePrefixComponents = {
  systemPrompt: string
  tools: ReadonlyArray<ModelToolSpec>
  pinnedConstraints: readonly string[]
  factAnchors: readonly FactAnchor[]
  fewShots: readonly TurnItem[]
}

export type StablePrefixBuildOptions = {
  includeFactAnchors?: boolean
  /** Max fact anchors in the compiled prefix text. */
  maxFactAnchors?: number
  includePinnedConstraints?: boolean
}

const DEFAULT_OPTIONS: Required<StablePrefixBuildOptions> = {
  includeFactAnchors: true,
  maxFactAnchors: 32,
  includePinnedConstraints: true,
}

/**
 * Build a stable prefix from its source components.
 *
 * The output is deterministic: same inputs → byte-identical output.
 * This is critical for provider prefix caching — any drift breaks
 * cache hits and silently reverts to O(n²) behavior.
 */
export function buildStablePrefix(
  components: StablePrefixComponents,
  options: StablePrefixBuildOptions = {}
): StablePrefix {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const content = compilePrefixContent(components, opts)
  const fingerprint = sha256(content)

  return {
    fingerprint,
    content,
    components: {
      systemPrompt: components.systemPrompt,
      tools: [...components.tools],
      pinnedConstraints: [...components.pinnedConstraints],
      factAnchors: [...components.factAnchors],
      fewShots: [...components.fewShots],
    },
    revision: 1,
    builtAt: new Date().toISOString(),
    valid: true,
  }
}

/**
 * Check if a stable prefix needs rebuilding based on new component values.
 * Returns which fields changed.
 */
export function detectPrefixChanges(
  current: StablePrefix,
  nextComponents: StablePrefixComponents
): { changed: boolean; changedFields: string[] } {
  const changed: string[] = []

  if (current.components.systemPrompt !== nextComponents.systemPrompt) {
    changed.push('systemPrompt')
  }

  if (!toolsEqual(current.components.tools, nextComponents.tools)) {
    changed.push('tools')
  }

  if (!stringArrayEqual(current.components.pinnedConstraints, nextComponents.pinnedConstraints)) {
    changed.push('pinnedConstraints')
  }

  // Fact anchors can grow by appending without invalidating the cached
  // prefix. Only actual mutations (status changes, statement edits) trigger
  // a rebuild.
  if (!factAnchorsStable(current.components.factAnchors, nextComponents.factAnchors)) {
    changed.push('factAnchors')
  }

  if (!turnItemsEqual(current.components.fewShots, nextComponents.fewShots)) {
    changed.push('fewShots')
  }

  return { changed: changed.length > 0, changedFields: changed }
}

/**
 * Rebuild a stable prefix when components have changed.
 * Preserves the revision counter.
 */
export function rebuildStablePrefix(
  current: StablePrefix,
  nextComponents: StablePrefixComponents,
  options: StablePrefixBuildOptions = {}
): StablePrefix {
  const { changed } = detectPrefixChanges(current, nextComponents)
  if (!changed) {
    return { ...current, valid: true }
  }

  const opts = { ...DEFAULT_OPTIONS, ...options }
  const content = compilePrefixContent(nextComponents, opts)
  const fingerprint = sha256(content)

  return {
    fingerprint,
    content,
    components: {
      systemPrompt: nextComponents.systemPrompt,
      tools: [...nextComponents.tools],
      pinnedConstraints: [...nextComponents.pinnedConstraints],
      factAnchors: [...nextComponents.factAnchors],
      fewShots: [...nextComponents.fewShots],
    },
    revision: current.revision + 1,
    builtAt: new Date().toISOString(),
    valid: true,
  }
}

/**
 * Bridge: create a StablePrefix from the existing ImmutablePrefix,
 * adding fact anchors as a new dimension.
 *
 * This is the primary integration point — it does NOT replace
 * ImmutablePrefix, it wraps it with fact-anchor awareness.
 */
export function stablePrefixFromImmutable(
  immutable: ImmutablePrefix,
  factAnchors: readonly FactAnchor[] = [],
  options: StablePrefixBuildOptions = {}
): StablePrefix {
  return buildStablePrefix(
    {
      systemPrompt: immutable.systemPrompt,
      tools: immutable.tools,
      pinnedConstraints: immutable.pinnedConstraints,
      factAnchors,
      fewShots: immutable.fewShots,
    },
    options
  )
}

/**
 * Compute byte size of the stable prefix content.
 */
export function stablePrefixByteSize(prefix: StablePrefix): number {
  return Buffer.byteLength(prefix.content, 'utf8')
}

// ---------------------------------------------------------------------------
// Compilation
// ---------------------------------------------------------------------------

function compilePrefixContent(
  components: StablePrefixComponents,
  options: Required<StablePrefixBuildOptions>
): string {
  const sections: string[] = []

  // Section 1: System prompt
  if (components.systemPrompt.trim()) {
    sections.push(components.systemPrompt.trim())
  }

  // Section 2: Pinned constraints
  if (options.includePinnedConstraints && components.pinnedConstraints.length > 0) {
    const lines = [
      '## Pinned Constraints',
      'The following constraints apply throughout the conversation:',
      '',
    ]
    for (const constraint of components.pinnedConstraints) {
      lines.push(`- ${constraint}`)
    }
    sections.push(lines.join('\n'))
  }

  // Section 3: Fact anchors (only confirmed/tentative in the prefix text)
  if (options.includeFactAnchors && components.factAnchors.length > 0) {
    const anchorsToInclude =
      options.maxFactAnchors > 0
        ? components.factAnchors.slice(-options.maxFactAnchors)
        : components.factAnchors
    const anchorText = formatFactAnchors(anchorsToInclude)
    if (anchorText.trim()) {
      sections.push('## Confirmed Facts')
      sections.push(anchorText.trim())
    }
  }

  // Note: tool definitions are sent separately in the request body
  // (the `tools` field), not as part of the text prefix. They are
  // still tracked in components.tools for change detection.

  return sections.join('\n\n').trim()
}

// ---------------------------------------------------------------------------
// Comparison utilities
// ---------------------------------------------------------------------------

function toolsEqual(
  a: ReadonlyArray<ModelToolSpec>,
  b: ReadonlyArray<ModelToolSpec>
): boolean {
  if (a.length !== b.length) return false
  const aSorted = [...a].sort(byName)
  const bSorted = [...b].sort(byName)
  for (let i = 0; i < aSorted.length; i++) {
    const ta = aSorted[i]
    const tb = bSorted[i]
    if (!ta || !tb) return false
    if (ta.name !== tb.name) return false
    if (ta.description !== tb.description) return false
    if (ta.toolKind !== tb.toolKind) return false
    if (JSON.stringify(ta.inputSchema) !== JSON.stringify(tb.inputSchema)) return false
  }
  return true
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name)
}

function stringArrayEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * Check if fact anchors are "stable" — no existing anchor has mutated.
 * New anchors appended at the end are fine; the provider can cache the
 * prefix up to the last known anchor and extend it.
 *
 * If any existing anchor changes (status, statement, category, etc.),
 * the entire prefix must be rebuilt.
 */
function factAnchorsStable(
  current: readonly FactAnchor[],
  next: readonly FactAnchor[]
): boolean {
  if (current.length > next.length) {
    // Anchors were removed — prefix is invalid
    return false
  }

  const currentMap = new Map(current.map((a) => [a.id, a]))
  for (const nextAnchor of next) {
    const currentAnchor = currentMap.get(nextAnchor.id)
    if (currentAnchor) {
      if (
        currentAnchor.statement !== nextAnchor.statement ||
        currentAnchor.status !== nextAnchor.status ||
        currentAnchor.sourceTurnId !== nextAnchor.sourceTurnId ||
        currentAnchor.category !== nextAnchor.category ||
        currentAnchor.overriddenBy !== nextAnchor.overriddenBy
      ) {
        return false
      }
    }
    // New anchors (not in current) are fine — append-only
  }

  return true
}

function turnItemsEqual(a: readonly TurnItem[], b: readonly TurnItem[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const ia = a[i]
    const ib = b[i]
    if (!ia || !ib) return false
    if (ia.kind !== ib.kind) return false
    if (ia.kind === 'user_message' && ib.kind === 'user_message') {
      if (ia.text !== ib.text) return false
    } else if (ia.kind === 'assistant_text' && ib.kind === 'assistant_text') {
      if (ia.text !== ib.text) return false
    } else if (ia.kind === 'tool_call' && ib.kind === 'tool_call') {
      if (ia.toolName !== ib.toolName) return false
      if (ia.callId !== ib.callId) return false
      if (JSON.stringify(ia.arguments) !== JSON.stringify(ib.arguments)) return false
    } else if (ia.kind === 'tool_result' && ib.kind === 'tool_result') {
      if (ia.toolName !== ib.toolName) return false
      if (ia.callId !== ib.callId) return false
      if (JSON.stringify(ia.output) !== JSON.stringify(ib.output)) return false
    }
  }
  return true
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}
