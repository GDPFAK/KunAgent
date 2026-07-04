import { Brush } from 'lucide-react'
import type { ReactElement } from 'react'

/**
 * Full-frame "AI brush sketching a wireframe" placeholder shown inside a
 * screen frame while its HTML is being generated. It replaces the old
 * skeleton-HTML webview (which centered a small card and fought the frame's
 * drawn height); this overlay always fills whatever size the user drew.
 *
 * Rendering is pure CSS/SVG: each wireframe stroke is dash-revealed inside its
 * own window of one shared animation cycle, and a brush glyph glides between
 * stroke endpoints on the same timeline, so the whole loop stays declarative
 * and cheap (no JS timers, one style tag).
 */

type SketchRect = {
  kind: 'rect'
  x: number
  y: number
  w: number
  h: number
  r: number
  weight: number
}

type SketchLine = {
  kind: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
  weight: number
}

export type SketchElement = SketchRect | SketchLine

const CYCLE_MS = 5600
const DRAW_START_PCT = 2
const DRAW_END_PCT = 90
const GAP_PCT = 0.7
/**
 * Dash geometry for the draw-in effect (normalized by pathLength=100). The
 * gap is 2 units longer than the path and the hidden offset is 101 (not 100)
 * so a not-yet-drawn stroke has no dash boundary landing exactly on a path
 * endpoint — with round linecaps that boundary would paint a stray dot at
 * every pending stroke corner.
 */
export const SKETCH_DASH_ARRAY = '100 102'
export const SKETCH_DASH_HIDDEN_OFFSET = 101

/** Generic page wireframe: header, hero + copy, card row, footer. Coordinates are % of the frame. */
export const SKETCH_ELEMENTS: readonly SketchElement[] = [
  { kind: 'rect', x: 6, y: 5, w: 18, h: 6, r: 3, weight: 7 },
  { kind: 'line', x1: 58, y1: 8, x2: 74, y2: 8, weight: 3 },
  { kind: 'line', x1: 79, y1: 8, x2: 94, y2: 8, weight: 3 },
  { kind: 'rect', x: 6, y: 17, w: 52, h: 36, r: 2, weight: 13 },
  { kind: 'line', x1: 6, y1: 17, x2: 58, y2: 53, weight: 4 },
  { kind: 'line', x1: 58, y1: 17, x2: 6, y2: 53, weight: 4 },
  { kind: 'line', x1: 63, y1: 24, x2: 94, y2: 24, weight: 4 },
  { kind: 'line', x1: 63, y1: 31, x2: 88, y2: 31, weight: 3.5 },
  { kind: 'rect', x: 63, y: 38, w: 15, h: 8, r: 4, weight: 5 },
  { kind: 'rect', x: 6, y: 61, w: 26, h: 21, r: 2, weight: 8 },
  { kind: 'rect', x: 37, y: 61, w: 26, h: 21, r: 2, weight: 8 },
  { kind: 'rect', x: 68, y: 61, w: 26, h: 21, r: 2, weight: 8 },
  { kind: 'line', x1: 6, y1: 87, x2: 24, y2: 87, weight: 2.5 },
  { kind: 'line', x1: 37, y1: 87, x2: 55, y2: 87, weight: 2.5 },
  { kind: 'line', x1: 68, y1: 87, x2: 86, y2: 87, weight: 2.5 },
  { kind: 'line', x1: 6, y1: 94, x2: 94, y2: 94, weight: 5 }
]

export type SketchWindow = { start: number; end: number }

export type SketchBrushFrame = { pct: number; left: number; top: number }

export type SketchTimeline = {
  windows: SketchWindow[]
  brushFrames: SketchBrushFrame[]
}

export function htmlFrameGeneratingSketchTimeline(
  elements: readonly SketchElement[] = SKETCH_ELEMENTS
): SketchTimeline {
  const totalWeight = elements.reduce((sum, el) => sum + el.weight, 0)
  const gapTotal = GAP_PCT * Math.max(0, elements.length - 1)
  const span = DRAW_END_PCT - DRAW_START_PCT - gapTotal
  const windows: SketchWindow[] = []
  const brushFrames: SketchBrushFrame[] = []
  let cursor = DRAW_START_PCT
  for (const el of elements) {
    const length = totalWeight > 0 ? (el.weight / totalWeight) * span : 0
    const start = cursor
    const end = cursor + length
    windows.push({ start, end })
    if (el.kind === 'line') {
      brushFrames.push(
        { pct: start, left: el.x1, top: el.y1 },
        { pct: end, left: el.x2, top: el.y2 }
      )
    } else {
      // Approximate the rect stroke path (top-left, clockwise, back to start).
      brushFrames.push(
        { pct: start, left: el.x, top: el.y },
        { pct: start + length * 0.35, left: el.x + el.w, top: el.y },
        { pct: start + length * 0.5, left: el.x + el.w, top: el.y + el.h },
        { pct: start + length * 0.85, left: el.x, top: el.y + el.h },
        { pct: end, left: el.x, top: el.y }
      )
    }
    cursor = end + GAP_PCT
  }
  return { windows, brushFrames }
}

function pct(value: number): string {
  return Number(value.toFixed(2)).toString()
}

export function buildHtmlFrameGeneratingSketchCss(
  elements: readonly SketchElement[] = SKETCH_ELEMENTS
): string {
  const { windows, brushFrames } = htmlFrameGeneratingSketchTimeline(elements)
  const parts: string[] = []
  elements.forEach((el, index) => {
    const window = windows[index]
    if (!window) return
    const name = `kun-hfgen-el-${index}`
    if (el.kind === 'rect') {
      const fillIn = Math.min(window.end + 3, 92)
      parts.push(
        `@keyframes ${name}{0%,${pct(window.start)}%{stroke-dashoffset:${SKETCH_DASH_HIDDEN_OFFSET};fill-opacity:0}` +
          `${pct(window.end)}%{stroke-dashoffset:0;fill-opacity:0}` +
          `${pct(fillIn)}%,100%{stroke-dashoffset:0;fill-opacity:0.05}}`
      )
    } else {
      parts.push(
        `@keyframes ${name}{0%,${pct(window.start)}%{stroke-dashoffset:${SKETCH_DASH_HIDDEN_OFFSET}}` +
          `${pct(window.end)}%,100%{stroke-dashoffset:0}}`
      )
    }
    parts.push(`.${name}{animation:${name} ${CYCLE_MS}ms linear infinite}`)
  })

  const first = brushFrames[0]
  const last = brushFrames[brushFrames.length - 1]
  if (first && last) {
    const waypointFrames = brushFrames
      .map((frame) => `${pct(frame.pct)}%{left:${pct(frame.left)}%;top:${pct(frame.top)}%}`)
      .join('')
    parts.push(
      `@keyframes kun-hfgen-brush{0%{left:${pct(first.left)}%;top:${pct(first.top)}%;opacity:1}` +
        waypointFrames +
        `93%{opacity:1}96%{opacity:0}` +
        `100%{left:${pct(last.left)}%;top:${pct(last.top)}%;opacity:0}}`
    )
    parts.push(`.kun-hfgen-brush{animation:kun-hfgen-brush ${CYCLE_MS}ms linear infinite}`)
  }

  parts.push(`@keyframes kun-hfgen-fade{0%,93%{opacity:1}97%,100%{opacity:0}}`)
  parts.push(`.kun-hfgen-sketch{animation:kun-hfgen-fade ${CYCLE_MS}ms linear infinite}`)
  parts.push(
    `@media (prefers-reduced-motion: reduce){` +
      `.kun-hfgen-sketch{animation:none}` +
      `.kun-hfgen-sketch rect,.kun-hfgen-sketch line{animation:none;stroke-dashoffset:0}` +
      `.kun-hfgen-brush{display:none}}`
  )
  return parts.join('\n')
}

const SKETCH_CSS = buildHtmlFrameGeneratingSketchCss()

type HtmlFrameGeneratingCanvasProps = {
  label: string
  detail?: string
  screenWidth: number
}

export function HtmlFrameGeneratingCanvas({
  label,
  detail,
  screenWidth
}: HtmlFrameGeneratingCanvasProps): ReactElement {
  const brushSize = Math.min(30, Math.max(18, screenWidth * 0.035))
  const showDetail = Boolean(detail) && screenWidth > 260
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden text-accent">
      <style>{SKETCH_CSS}</style>
      <div className="absolute inset-0 bg-gradient-to-br from-[#fffaf0]/95 to-[#eef6ff]/95 dark:from-[#15171c]/95 dark:to-[#101625]/95" />
      <svg className="kun-hfgen-sketch absolute inset-0 h-full w-full" aria-hidden="true">
        {SKETCH_ELEMENTS.map((el, index) =>
          el.kind === 'rect' ? (
            <rect
              key={index}
              className={`kun-hfgen-el-${index}`}
              x={`${el.x}%`}
              y={`${el.y}%`}
              width={`${el.w}%`}
              height={`${el.h}%`}
              rx={el.r}
              pathLength={100}
              fill="currentColor"
              fillOpacity={0}
              stroke="currentColor"
              strokeOpacity={0.55}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeDasharray={SKETCH_DASH_ARRAY}
              strokeDashoffset={SKETCH_DASH_HIDDEN_OFFSET}
            />
          ) : (
            <line
              key={index}
              className={`kun-hfgen-el-${index}`}
              x1={`${el.x1}%`}
              y1={`${el.y1}%`}
              x2={`${el.x2}%`}
              y2={`${el.y2}%`}
              pathLength={100}
              stroke="currentColor"
              strokeOpacity={0.55}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeDasharray={SKETCH_DASH_ARRAY}
              strokeDashoffset={SKETCH_DASH_HIDDEN_OFFSET}
            />
          )
        )}
      </svg>
      <div
        className="kun-hfgen-brush absolute"
        aria-hidden="true"
        style={{
          width: brushSize,
          height: brushSize,
          transform: 'translate(-28%, -82%) rotate(-14deg)'
        }}
      >
        <Brush
          className="h-full w-full text-accent drop-shadow-[0_2px_6px_rgba(101,87,255,0.35)]"
          strokeWidth={1.7}
          aria-hidden="true"
        />
      </div>
      <div className="absolute inset-x-0 bottom-3 flex justify-center">
        <div
          className="flex max-w-[80%] items-center gap-1.5 rounded-full border border-accent/25 bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-accent shadow-[0_10px_30px_rgba(20,47,95,0.12)] backdrop-blur-md dark:bg-ds-card/90"
          style={{ fontSize: Math.min(13, Math.max(11, screenWidth * 0.016)) }}
        >
          <Brush className="h-3.5 w-3.5 shrink-0 animate-pulse" strokeWidth={1.8} aria-hidden="true" />
          <span className="min-w-0 truncate">{label}</span>
          {showDetail ? (
            <span className="min-w-0 max-w-[14em] truncate font-normal text-ds-muted">· {detail}</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
