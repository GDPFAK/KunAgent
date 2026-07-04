import { WRITE_PROTOTYPE_DEFAULT_PROMPT, WRITE_PROTOTYPE_MAX_TEXT_CHARS } from '@shared/write-prototype'
import {
  DESIGN_CRAFT_LINES,
  DESIGN_DELIVERY_LINES,
  DESIGN_RESIZE_RESPONSIVE_LINES,
  defaultFrameSizeForDesignTarget,
  formatDesignContextLines,
  normalizeDesignTarget,
  type DesignContext
} from "../design-context"
import type { CanvasSnapshot } from "../canvas/canvas-snapshot"
import { snapshotToCompactJson } from "../canvas/canvas-snapshot"
import type { OpError } from "../canvas/shape-ops"
import { useDesignSystemStore } from "../canvas/design-system-store"
import type { DesignSystem, DesignToken } from "../canvas/design-system-types"
import { takeLastLintFindings } from "../canvas/design-lint"
import type { DerivedTokens } from "../design-token-extract"
import type { DesignContextLocation, DesignHtmlElementContext } from "../design-composer-context"
import { formatDesignHtmlQualityFindings, type DesignHtmlQualityFinding } from "../design-html-quality"
import { formatDerivedTokenLines, formatDesignTargetAssetLines, formatDesignTargetFrameLines } from './shared'
import { buildCanvasTurnPrompt } from './html-and-canvas'

/**
 * Code-mode entry point for the canvas ShapeOps turn prompt. It uses the same
 * tool vocabulary as Design mode, but screen ops are explicitly framed as
 * editable whiteboard frames rather than HTML artifacts.
 */
export function buildCodeCanvasTurnPrompt(options: {
  workspaceRoot: string
  text?: string
  canvasSnapshot?: CanvasSnapshot
  designContext?: DesignContext
  previousOpErrors?: OpError[]
  canvasFeedbackKey?: string
  canvasDesignSystem?: DesignSystem
}): string {
  const base = buildCanvasTurnPrompt({
    target: 'canvas',
    mode: 'text',
    ...(options.text ? { text: options.text } : {}),
    artifactRelativePath: '',
    workspaceRoot: options.workspaceRoot,
    canvasSurface: 'code',
    ...(options.designContext ? { designContext: options.designContext } : {}),
    ...(options.canvasSnapshot ? { canvasSnapshot: options.canvasSnapshot } : {}),
    ...(options.previousOpErrors ? { previousOpErrors: options.previousOpErrors } : {}),
    ...(options.canvasFeedbackKey ? { canvasFeedbackKey: options.canvasFeedbackKey } : {}),
    ...(options.canvasDesignSystem ? { canvasDesignSystem: options.canvasDesignSystem } : {})
  })
  return [
    base,
    '',
    'Code-mode whiteboard override:',
    '- This is the Code sidebar whiteboard, not Design mode. `design_create_screen` / `add-screen` creates plain editable frame shapes here; it does NOT trigger follow-up HTML screen generation.',
    '- For architecture maps, flows, notes, diagrams, image slots, and UI sketches, prefer `design_update_shapes` with normal frame/rect/text/arrow/image ops.'
  ].join('\n')
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
    ...formatDesignTargetAssetLines(options.designContext),
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
  derivedTokens?: DerivedTokens
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
    ...formatDesignTargetFrameLines(options.designContext),
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
  lines.push(...formatDerivedTokenLines(options.derivedTokens))
  lines.push('', ...DESIGN_DELIVERY_LINES, '', ...DESIGN_CRAFT_LINES)
  return lines.join('\n')
}
