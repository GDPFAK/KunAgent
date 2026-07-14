import { dirname } from 'node:path'
import { readFile } from 'node:fs/promises'
import { LocalToolHost, type LocalTool } from './local-tool-host.js'
import {
  applyEditsToNormalizedContent,
  detectLineEnding,
  firstChangedLine,
  generateDisplayDiff,
  generateUnifiedPatch,
  normalizeToLF,
  restoreLineEndings,
  stripBom
} from './edit-diff.js'
import { withFileMutationQueue } from './file-mutation-queue.js'
import type { EditLocalToolOptions, WriteLocalToolOptions } from './builtin-tool-types.js'
import { defaultEditLocalToolOperations, defaultWriteLocalToolOperations } from './builtin-tool-operations.js'
import { parseEditInstructions, resolveWorkspacePath, withToolBoundary } from './builtin-tool-utils.js'
import { assertCanWritePath } from './sandbox-policy.js'
import { tryGetLspDiagnostics, isCodeFile } from './lsp-diagnostics.js'

/** Max real writes (edit or write) to the same absolute path within one turn.
 *  Prevents the model from repeatedly rewriting the same file in a loop.
 *  Set to 8 to leave room for iterative layout refinement (design tasks). */
const MAX_WRITES_PER_FILE_PER_TURN = 8

// ── Per-turn, per-file write counter ──
// Key: `${turnId}:${absolutePath}`. Tracks how many times each file has been
// actually *modified* (not just content-identical checked) in the current turn.
// Module-level is fine: the AgentLoop clears turn state naturally, and the map
// is bounded by concurrent turns × files per turn.
const fileWriteCounters = new Map<string, number>()

function writeCapKey(turnId: string, absolutePath: string): string {
  return `${turnId}::${absolutePath}`
}

/**
 * Check whether the file has exceeded its per-turn write budget.
 * Returns `true` when the write should proceed, `false` when capped.
 * When a write is actually performed, the caller must call
 * {@link incrementWriteCounter} to update the budget.
 */
function canWriteToFile(turnId: string, absolutePath: string): boolean {
  const key = writeCapKey(turnId, absolutePath)
  const count = fileWriteCounters.get(key) ?? 0
  return count < MAX_WRITES_PER_FILE_PER_TURN
}

/** Record that a real (content-changing) write happened. */
function incrementWriteCounter(turnId: string, absolutePath: string): void {
  const key = writeCapKey(turnId, absolutePath)
  fileWriteCounters.set(key, (fileWriteCounters.get(key) ?? 0) + 1)
}

/**
 * Arguments that failed JSON parsing arrive as `{ __raw: "<partial json>" }`
 * (tool-argument-repair fallback). The dominant cause is the model's output
 * limit truncating an oversized payload mid-string, so answer with guidance
 * the model can act on instead of a generic missing-field error.
 */
function truncatedArgumentsError(raw: unknown): { output: { error: string }; isError: true } | null {
  if (typeof raw !== 'string') return null
  return {
    output: {
      error:
        'tool arguments were not valid JSON — they were likely truncated by your output limit. ' +
        `Received ${raw.length} characters. Retry with a much smaller payload: ` +
        'write a short skeleton first, then extend the file with several small edit calls.'
    },
    isError: true
  }
}

export function createWriteLocalTool(_options: WriteLocalToolOptions = {}): LocalTool {
  const mkdirOp = _options.operations?.mkdir ?? defaultWriteLocalToolOperations.mkdir!
  const writeFileOp = _options.operations?.writeFile ?? defaultWriteLocalToolOperations.writeFile!
  return LocalToolHost.defineTool({
    name: 'write',
    description: 'Create or overwrite a workspace file with the provided content.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' }
      },
      required: ['path', 'content'],
      additionalProperties: false
    },
    policy: 'on-request',
    toolKind: 'file_change',
    execute: async (args, context) => withToolBoundary(async () => {
      const truncated = truncatedArgumentsError(args.__raw)
      if (truncated) return truncated
      const rawPath = typeof args.path === 'string' ? args.path : ''
      const content = typeof args.content === 'string' ? args.content : null
      if (!rawPath.trim() || content == null) {
        return { output: { error: 'path and content are required' }, isError: true }
      }
      const { absolutePath, relativePath } = await resolveWorkspacePath(rawPath, context)
      assertCanWritePath(absolutePath, context)
      return withFileMutationQueue(absolutePath, async () => {
        // ── Per-file write frequency cap: prevent loop rewrites ──
        if (!canWriteToFile(context.turnId, absolutePath)) {
          return {
            output: {
              path: absolutePath,
              relative_path: relativePath,
              bytes_written: 0,
              info:
                `write to this file was skipped (file modified ${MAX_WRITES_PER_FILE_PER_TURN} times this turn). ` +
                'Consolidate remaining changes into fewer edits or start a new turn.'
            }
          }
        }

        // ── Content-identical guard: skip write when file already has the same content ──
        try {
          const existing = await readFile(absolutePath, 'utf8')
          if (existing === content) {
            return {
              output: {
                path: absolutePath,
                relative_path: relativePath,
                bytes_written: 0,
                info: 'content unchanged — file already contains the provided content'
              }
            }
          }
        } catch {
          // File doesn't exist or can't be read; proceed with write.
        }
        incrementWriteCounter(context.turnId, absolutePath)
        await mkdirOp(dirname(absolutePath))
        await writeFileOp(absolutePath, content)
        return {
          output: {
            path: absolutePath,
            relative_path: relativePath,
            bytes_written: Buffer.byteLength(content, 'utf8')
          }
        }
      })
    })
  })
}

export const createWriteTool = createWriteLocalTool
export const createWriteToolDefinition = createWriteLocalTool

export function createEditLocalTool(_options: EditLocalToolOptions = {}): LocalTool {
  const readFileOp = _options.operations?.readFile ?? defaultEditLocalToolOperations.readFile!
  const writeFileOp = _options.operations?.writeFile ?? defaultEditLocalToolOperations.writeFile!
  return LocalToolHost.defineTool({
    name: 'edit',
    description: 'Edit a workspace file using exact text replacement. Supports multiple disjoint edits in one call.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        oldText: { type: 'string' },
        newText: { type: 'string' },
        edits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              oldText: { type: 'string' },
              newText: { type: 'string' }
            },
            required: ['oldText', 'newText'],
            additionalProperties: false
          }
        }
      },
      required: ['path'],
      additionalProperties: false
    },
    policy: 'on-request',
    toolKind: 'file_change',
    execute: async (args, context, onUpdate) => withToolBoundary(async () => {
      const truncated = truncatedArgumentsError(args.__raw)
      if (truncated) return truncated
      const rawPath = typeof args.path === 'string' ? args.path : ''
      const edits = parseEditInstructions(args)
      if (!rawPath.trim() || edits.length === 0) {
        return { output: { error: 'path and at least one edit are required' }, isError: true }
      }
      const { absolutePath, relativePath } = await resolveWorkspacePath(rawPath, context)
      assertCanWritePath(absolutePath, context)
      const editResult = await withFileMutationQueue(absolutePath, async () => {
        // ── Per-file write frequency cap: prevent loop rewrites ──
        if (!canWriteToFile(context.turnId, absolutePath)) {
          return {
            output: {
              path: absolutePath,
              relative_path: relativePath,
              replacements: 0,
              bytes_written: 0,
              info:
                `edit to this file was skipped (file modified ${MAX_WRITES_PER_FILE_PER_TURN} times this turn). ` +
                'Consolidate remaining changes into fewer edits or start a new turn.'
            }
          }
        }
        const rawSource = await readFileOp(absolutePath)
        const { bom, text: source } = stripBom(rawSource)
        const lineEnding = detectLineEnding(source)
        const normalizedSource = normalizeToLF(source)
        const { baseContent, newContent } = applyEditsToNormalizedContent(normalizedSource, edits, relativePath)
        // ── No-op edit guard: skip write when edits produced no change ──
        if (baseContent === newContent) {
          return {
            output: {
              path: absolutePath,
              relative_path: relativePath,
              replacements: 0,
              bytes_written: 0,
              info: 'no changes applied — the target content already matches the edits'
            }
          }
        }
        incrementWriteCounter(context.turnId, absolutePath)
        const next = bom + restoreLineEndings(newContent, lineEnding)
        await writeFileOp(absolutePath, next)
        const diff = generateDisplayDiff(baseContent, newContent)
        const patch = generateUnifiedPatch(relativePath, baseContent, newContent)
        return {
          output: {
            path: absolutePath,
            relative_path: relativePath,
            replacements: edits.length,
            bytes_written: Buffer.byteLength(next, 'utf8'),
            diff,
            patch,
            first_changed_line: firstChangedLine(baseContent, newContent)
          }
        }
      })
      // Fire-and-forget LSP diagnostics for code files (V3: edit → EventBus → GUI)
      if (isCodeFile(absolutePath) && onUpdate) {
        tryGetLspDiagnostics(absolutePath, context.workspace).then((diagResult) => {
          if (diagResult.status === 'ok' && diagResult.diagnostics.length > 0 && onUpdate) {
            void onUpdate({
              output: {
                kind: 'lsp_diagnostics',
                filePath: relativePath,
                diagnostics: diagResult.diagnostics
              },
              isError: false
            })
          }
        }).catch(() => {})
      }
      return editResult
    })
  })
}

export const createEditTool = createEditLocalTool
export const createEditToolDefinition = createEditLocalTool
