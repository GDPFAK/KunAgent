/**
 * Builtin PostToolUse hook: the design-quality linter.
 *
 * After the agent writes or edits a frontend file, this hook scans the
 * result and, when it finds design "tells" or craft issues, folds a
 * `design_quality_review` block into the tool result. The model sees that
 * block on its next turn and self-corrects — no separate review pass, no
 * user action. It is advisory only: it never marks the tool as errored and
 * never blocks the turn.
 */

import { readFileSync } from 'node:fs'
import type { HookInvocation, HookResult, ResolvedHook } from '../hook-engine.js'
import { detectFrontend, isFrontendPath, type DesignFinding } from '../../quality/index.js'
import type { QualityConfig } from '../../config/kun-config.js'

const HOOK_TIMEOUT_MS = 5_000
/** Skip pathologically large files; the regex scan is line-based but cheap to bound. */
const MAX_SOURCE_BYTES = 512 * 1024

type PostToolUseInvocation = Extract<HookInvocation, { phase: 'PostToolUse' }>

function asOutputRecord(output: unknown): { path?: string; relative_path?: string } | null {
  if (!output || typeof output !== 'object') return null
  return output as { path?: string; relative_path?: string }
}

/**
 * Minimal glob: `*` matches within a path segment, `**` across segments.
 * Used for `ignoreFiles`. Operates on `/`-normalized relative paths.
 */
export function matchesGlob(pattern: string, value: string): boolean {
  const normalized = value.replace(/\\/g, '/')
  const escaped = pattern
    .replace(/\\/g, '/')
    .replace(/[.+^${}()|[\]]/g, '\\$&')
    .replace(/\*\*/g, '\uffff')
    .replace(/\*/g, '[^/]*')
    .replace(/\uffff/g, '.*')
  try {
    return new RegExp(`^${escaped}$`).test(normalized)
  } catch {
    return false
  }
}

function readSource(invocation: PostToolUseInvocation, absolutePath: string): string | null {
  // `write` carries the full content in its arguments — use it and skip the
  // disk read. `edit` does not, so re-read the (already written) file.
  const content = invocation.call.arguments?.content
  if (typeof content === 'string') {
    return content.length > MAX_SOURCE_BYTES ? null : content
  }
  try {
    const text = readFileSync(absolutePath, 'utf8')
    return text.length > MAX_SOURCE_BYTES ? null : text
  } catch {
    return null
  }
}

function summarize(findings: readonly DesignFinding[]): Array<Record<string, unknown>> {
  return findings.map((f) => ({
    rule: f.ruleId,
    severity: f.severity,
    line: f.line,
    message: f.message,
    snippet: f.snippet
  }))
}

/**
 * Build the design-quality hook from config, or null when disabled. The
 * returned hook only fires for `write`/`edit` on frontend files.
 */
export function buildDesignQualityHook(config: QualityConfig): ResolvedHook | null {
  if (!config.enabled) return null
  return {
    phase: 'PostToolUse',
    toolNames: ['write', 'edit'],
    timeoutMs: HOOK_TIMEOUT_MS,
    run: (invocation): HookResult | void => {
      if (invocation.phase !== 'PostToolUse') return
      const { result } = invocation
      if (result.isError) return
      const out = asOutputRecord(result.output)
      if (!out) return
      const relativePath = out.relative_path ?? out.path
      const absolutePath = out.path
      if (!relativePath || !absolutePath || !isFrontendPath(relativePath)) return
      if (config.ignoreFiles.some((glob) => matchesGlob(glob, relativePath))) return

      const source = readSource(invocation, absolutePath)
      if (source == null) return

      const findings = detectFrontend(source, {
        filePath: relativePath,
        strictness: config.strictness,
        ignoreRules: config.ignoreRules,
        maxFindings: config.maxFindings
      })
      if (findings.length === 0) return

      const base =
        result.output && typeof result.output === 'object'
          ? (result.output as Record<string, unknown>)
          : {}
      return {
        output: {
          ...base,
          design_quality_review: {
            strictness: config.strictness,
            note: 'Kun 设计质量自检（自动检查，非用户指令）：请在后续修改中处理下列问题，或说明为何保留。',
            findings: summarize(findings)
          }
        }
      }
    }
  }
}
