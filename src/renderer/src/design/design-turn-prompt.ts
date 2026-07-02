import { WRITE_PROTOTYPE_DEFAULT_PROMPT, WRITE_PROTOTYPE_MAX_TEXT_CHARS } from '@shared/write-prototype'
import { DESIGN_CRAFT_LINES, formatDesignContextLines, type DesignContext } from './design-context'
import type { CanvasSnapshot } from './canvas/canvas-snapshot'
import { snapshotToCompactJson } from './canvas/canvas-snapshot'

export type DesignTurnTarget = 'html' | 'canvas'

export type DesignTurnOptions = {
  target: DesignTurnTarget
  mode: 'text' | 'image'
  /** Free-form description of the design to produce (text mode). */
  text?: string
  /** Workspace-relative path the agent must write the artifact to. */
  artifactRelativePath: string
  /** Prior version to iterate on; set = update that design instead of starting fresh. */
  basePath?: string
  workspaceRoot: string
  /** User override prompt; empty = built-in default. */
  customPrompt?: string
  designContext?: DesignContext
  /** Canvas mode only: current snapshot of the shape document for AI reasoning. */
  canvasSnapshot?: CanvasSnapshot
}

/**
 * Turn prompt for the design agent: produce a single-file interactive HTML
 * artifact saved to the exact reserved path. Generalizes
 * `buildSddPrototypeTurnPrompt` (drops the SDD-requirement framing) while
 * keeping the single-file / incremental-write / <4000-char-per-tool-call
 * contract the webview embed + path polling rely on.
 *
 * Single target today; the P2 (`'graph'`) / P3 (`'penpot'`) phases add a
 * `switch (options.target)` branch here without touching the HTML path.
 */
export function buildDesignTurnPrompt(options: DesignTurnOptions): string {
  if (options.target === 'canvas') {
    return buildCanvasTurnPrompt(options)
  }
  const requirements = options.customPrompt?.trim() || WRITE_PROTOTYPE_DEFAULT_PROMPT
  const lines = [
    options.basePath
      ? 'Kun is asking you to ITERATE on an existing single-file HTML design.'
      : 'Kun is asking you to design a single-file interactive HTML artifact.',
    `Workspace: ${options.workspaceRoot}`,
    ...(options.basePath
      ? [
          `Current design to iterate on: ${options.basePath}`,
          'Read it first, reproduce it, then apply ONLY the changes in the brief below — preserve everything else (structure, content, styling).'
        ]
      : []),
    `Reserved artifact file: ${options.artifactRelativePath}`,
    '',
    `Design requirements: ${requirements}`,
    '',
    'Hard rules:',
    `- Produce ONE complete standalone HTML document at \`${options.artifactRelativePath}\`; create parent directories as needed.`,
    '- Build it INCREMENTALLY to stay inside your output limit: first `write` a small valid skeleton (doctype, head, empty body), then extend it with several `edit` calls. Keep every tool call payload under ~4000 characters — oversized tool arguments get truncated and fail.',
    '- Do not create or modify any other file during this turn.',
    '- The file content must be raw HTML — no markdown fences, no commentary inside the file.',
    '- Finish with the document ending in `</html>`, then reply with a one-paragraph summary of what you designed and the interactions you implemented.'
  ]
  const designContextLines = formatDesignContextLines(options.designContext)
  if (designContextLines.length > 0) {
    lines.push('', ...designContextLines)
  }
  lines.push('', ...DESIGN_CRAFT_LINES)
  if (options.mode === 'image') {
    lines.push(
      '',
      'The attached image is the visual specification (a design reference).',
      'Reproduce its layout, colors and typography as faithfully as possible, and make the implied interactions work.'
    )
  }
  const text = options.text?.trim()
  if (text) {
    lines.push('', 'Brief:', text.slice(0, WRITE_PROTOTYPE_MAX_TEXT_CHARS))
  }
  return lines.join('\n')
}

/**
 * Canvas-target turn prompt: teach the AI to emit ShapeOps inside a fenced
 * `shapeops` code block. The renderer parses these blocks and runs them through
 * `executeOps`, which atomically applies the batch with a single undo entry.
 *
 * Keep the schema documentation here in sync with `shape-ops.ts` ShapeOpSchema.
 */
function buildCanvasTurnPrompt(options: DesignTurnOptions): string {
  const snapshot = options.canvasSnapshot
  const snapshotJson = snapshot ? snapshotToCompactJson(snapshot) : '(empty canvas)'
  const lines = [
    'Kun is asking you to modify the SVG design canvas using structured ShapeOps.',
    `Workspace: ${options.workspaceRoot}`,
    '',
    'How to respond:',
    '- Reply with a short plain-text plan (1-3 sentences) describing what you will do.',
    '- Emit one or more ` ```shapeops ` fenced code blocks containing a JSON ARRAY of operations.',
    '- The renderer will validate the JSON, apply every op atomically (one undo entry per batch),',
    '  and visually highlight the affected shapes for ~1s.',
    '',
    'ShapeOp vocabulary (each op is a JSON object inside the array):',
    '- { "op": "add", "shape": { "type": "rect"|"ellipse"|"text"|"frame"|"group"|"image", "name"?, "x"?, "y"?, "width"?, "height"?, "rotation"?, "fills"?, "strokes"?, "cornerRadius"?, "textContent"?, "fontSize"?, "fontFamily"?, "fontColor"? }, "parentId"? }',
    '- { "op": "update", "id": "<shape-id>", "patch": { ...same fields as shape (no type)... } }',
    '- { "op": "delete", "id": "<shape-id>" }',
    '- { "op": "reparent", "id": "<shape-id>", "newParentId": "<parent-id>", "index"? }',
    '- { "op": "move", "ids": ["<id>",...], "dx": N, "dy": N }',
    '- { "op": "resize", "id": "<shape-id>", "bounds": { "x": N, "y": N, "width": N, "height": N } }',
    '- { "op": "align", "ids": ["<id>",...], "axis": "left|h-center|right|top|v-center|bottom" }  // ≥2 ids',
    '- { "op": "distribute", "ids": ["<id>",...], "axis": "horizontal|vertical" }  // ≥3 ids',
    '',
    'Rules:',
    '- Coordinates are in CANVAS pixels (not screen pixels); 1 unit ≈ 1px at 100% zoom.',
    '- Refer to shapes by their `id` from the snapshot below. New shapes you add get auto-named uniquely per parent.',
    '- Prefer composing larger features as a frame containing children (use add for the frame, then add children with `parentId`).',
    '- Keep batches focused — one batch per logical change so undo granularity stays useful.',
    '',
    'Current canvas snapshot (shape ids, names, positions; rendering details omitted):',
    '```json',
    snapshotJson,
    '```'
  ]
  const designContextLines = formatDesignContextLines(options.designContext)
  if (designContextLines.length > 0) {
    lines.push('', ...designContextLines)
  }
  const text = options.text?.trim()
  if (text) {
    lines.push('', 'Brief:', text.slice(0, WRITE_PROTOTYPE_MAX_TEXT_CHARS))
  }
  lines.push('', 'Example response shape:')
  lines.push('```')
  lines.push('I will add a 300×200 frame with a heading inside.')
  lines.push('```shapeops')
  lines.push('[')
  lines.push('  { "op": "add", "shape": { "type": "frame", "name": "Card", "x": 100, "y": 100, "width": 300, "height": 200 } }')
  lines.push(']')
  lines.push('```')
  lines.push('```')
  return lines.join('\n')
}

export type DesignImageNodeOptions = {
  text?: string
  /** Workspace-relative .png path the node's image must end up at. */
  outputRelativePath: string
  workspaceRoot: string
  designContext?: DesignContext
}

/**
 * Image node (node canvas): generate an image with the generate_image tool and
 * land it at the exact reserved .png path so the canvas can display it.
 */
export function buildDesignImageNodePrompt(options: DesignImageNodeOptions): string {
  const lines = [
    'Kun is asking you to generate an IMAGE for a design node.',
    `Workspace: ${options.workspaceRoot}`,
    `Reserved output file: ${options.outputRelativePath}`,
    '',
    'How to proceed:',
    '- Use the generate_image tool to create the image from the brief below.',
    `- The tool saves to its own location; then save or copy the result to the EXACT path \`${options.outputRelativePath}\` (create parent directories as needed) so the canvas can display it.`,
    '- Do not modify any other file.',
    '- Reply with a one-paragraph description of the image you generated.'
  ]
  const contextLines = formatDesignContextLines(options.designContext)
  if (contextLines.length > 0) lines.push('', ...contextLines)
  const text = options.text?.trim()
  if (text) lines.push('', 'Brief:', text.slice(0, WRITE_PROTOTYPE_MAX_TEXT_CHARS))
  return lines.join('\n')
}

export type DesignFromCodeOptions = {
  /** Workspace-relative (or absolute) path to the existing UI code to reverse-design. */
  sourceRelativePath: string
  artifactRelativePath: string
  workspaceRoot: string
  designContext?: DesignContext
}

/**
 * Code → design: produce an HTML design exploration from existing UI code. The
 * agent reads the real component and renders a clean, iterable design of what it
 * produces — the reverse of buildImplementDesignPrompt, closing the round trip.
 */
export function buildDesignFromCodePrompt(options: DesignFromCodeOptions): string {
  const lines = [
    'Kun is asking you to produce a design exploration based on existing code.',
    `Workspace: ${options.workspaceRoot}`,
    `Source UI code: ${options.sourceRelativePath}`,
    `Reserved artifact file: ${options.artifactRelativePath}`,
    '',
    'How to proceed:',
    `- Read \`${options.sourceRelativePath}\` (and the components/styles it imports) to understand what it renders — layout, components, states, interactions.`,
    `- Produce ONE complete standalone HTML document at \`${options.artifactRelativePath}\` that faithfully reproduces what that code renders, as a clean design you can iterate on. Inline all CSS/JS; never reference local files.`,
    '- Build it incrementally: write a small valid skeleton first, then extend with edit calls. Keep every tool call payload under ~4000 characters.',
    '- Do NOT modify the source code or any other file.',
    '- Finish with the document ending in `</html>`, then reply with a one-paragraph summary.'
  ]
  const contextLines = formatDesignContextLines(options.designContext)
  if (contextLines.length > 0) lines.push('', ...contextLines)
  lines.push('', ...DESIGN_CRAFT_LINES)
  return lines.join('\n')
}
