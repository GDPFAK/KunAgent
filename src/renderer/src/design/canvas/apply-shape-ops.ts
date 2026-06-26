import { executeOps, type OpError } from './shape-ops'

/**
 * Extract every `shapeops` fenced code block from a markdown-ish string.
 * Tolerates leading/trailing whitespace inside the fence and json/array shapes.
 */
export function extractShapeOpsBlocks(text: string): unknown[][] {
  const out: unknown[][] = []
  const re = /```shapeops\s*([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const raw = m[1].trim()
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) out.push(parsed)
      else out.push([parsed])
    } catch {
      // ignore malformed JSON — executor will report via Zod when called with garbage
    }
  }
  return out
}

/**
 * Extract renderer-executed design canvas tool calls from assistant text.
 *
 * The model is instructed to "call" this as a fenced JSON block:
 *
 * ```design_canvas
 * { "action": "add_screen", "name": "Login", "width": 390, "height": 844 }
 * ```
 *
 * Keeping this as an explicit tool-shaped block lets the design agent decide
 * when a canvas/screen exists. The old `shapeops` fence remains supported for
 * existing turns and code-canvas compatibility.
 */
export function extractDesignCanvasToolBlocks(text: string): unknown[][] {
  const out: unknown[][] = []
  const re = /```design_canvas\s*([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const raw = m[1].trim()
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw)
      const ops = normalizeDesignCanvasToolCall(parsed)
      if (ops.length > 0) out.push(ops)
    } catch {
      // ignore malformed JSON — the next model turn can self-correct
    }
  }
  return out
}

function normalizeDesignCanvasToolCall(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    if (value.every((item) => isRecord(item) && typeof item.op === 'string')) {
      return value
    }
    return value.flatMap((item) => normalizeDesignCanvasToolCall(item))
  }
  if (!isRecord(value)) return []

  const action = typeof value.action === 'string' ? value.action : ''
  if (action === 'create_board') {
    return []
  }
  if (action === 'update_shapes') {
    const ops = value.ops
    if (Array.isArray(ops)) return ops
    if (isRecord(ops)) return [ops]
    return []
  }
  if (action === 'add_screen') {
    return [
      copyOptionalFields(
        {
          op: 'add-screen',
          name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : 'Screen'
        },
        value,
        ['x', 'y', 'width', 'height', 'devicePreset']
      )
    ]
  }
  return []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function copyOptionalFields(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  keys: string[]
): Record<string, unknown> {
  for (const key of keys) {
    if (source[key] !== undefined) target[key] = source[key]
  }
  return target
}

export type ApplyShapeOpsResult = {
  affectedIds: string[]
  errors: OpError[]
  /** Number of canvas operation blocks parsed and executed (each is one undo batch). */
  batchCount: number
}

/**
 * Parse every design-canvas tool block in `text` and execute each as its own
 * atomic undo batch against the singleton canvas stores. Pure engine — no UI
 * side effects (no glow, no viewport focus). Callers layer those on top.
 */
export function applyShapeOpsFromText(text: string): ApplyShapeOpsResult {
  const blocks = [
    ...extractDesignCanvasToolBlocks(text),
    ...extractShapeOpsBlocks(text)
  ]
  const affectedIds: string[] = []
  const errors: OpError[] = []
  blocks.forEach((ops, i) => {
    const result = executeOps(ops, `ai:${i}`)
    affectedIds.push(...result.affectedIds)
    errors.push(...result.errors)
  })
  return { affectedIds, errors, batchCount: blocks.length }
}
