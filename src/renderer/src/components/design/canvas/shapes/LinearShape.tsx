import { memo, type ReactNode } from 'react'
import type { Arrowhead, CanvasShape, Point, StrokeDash } from '../../../../design/canvas/canvas-types'

const DEFAULT_COLOR = '#1e1e1e'
const DEFAULT_WIDTH = 2
const SPREAD = Math.PI / 7

function dashArray(dash: StrokeDash | undefined, width: number): string | undefined {
  if (dash === 'dashed') return `${width * 3.5} ${width * 2.5}`
  if (dash === 'dotted') return `${width} ${width * 2}`
  return undefined
}

/**
 * Smooth a polyline through ≥3 points into a Catmull-Rom curve, expressed as
 * cubic Bezier segments. Endpoints are clamped (P₋₁ = P₀, Pₙ = P_{n-1}) so the
 * curve passes through both ends exactly — that matters for arrowhead angles.
 */
function smoothPath(pts: Point[]): string {
  if (pts.length < 2) return ''
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? pts[i + 1]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
  }
  return d
}

function back(tip: Point, angle: number, dist: number): Point {
  return { x: tip.x - dist * Math.cos(angle), y: tip.y - dist * Math.sin(angle) }
}

/** Arrowhead decoration at `tip`; `angle` points along the stroke toward the tip. */
function arrowhead(
  tip: Point,
  angle: number,
  style: Arrowhead,
  size: number,
  color: string,
  width: number
): ReactNode {
  if (style === 'none') return null
  const l = back(tip, angle - SPREAD, size)
  const r = back(tip, angle + SPREAD, size)
  switch (style) {
    case 'arrow':
      return <path d={`M ${l.x} ${l.y} L ${tip.x} ${tip.y} L ${r.x} ${r.y}`} fill="none" stroke={color} strokeWidth={width} />
    case 'triangle':
      return <path d={`M ${tip.x} ${tip.y} L ${l.x} ${l.y} L ${r.x} ${r.y} Z`} fill={color} stroke={color} strokeWidth={width * 0.5} />
    case 'circle':
      return <circle cx={tip.x} cy={tip.y} r={size * 0.42} fill={color} />
    case 'bar': {
      const perp = angle + Math.PI / 2
      const half = size * 0.6
      const a = { x: tip.x + half * Math.cos(perp), y: tip.y + half * Math.sin(perp) }
      const b = { x: tip.x - half * Math.cos(perp), y: tip.y - half * Math.sin(perp) }
      return <path d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`} fill="none" stroke={color} strokeWidth={width} />
    }
    case 'diamond': {
      const center = back(tip, angle, size / 2)
      const tail = back(tip, angle, size)
      const perp = angle + Math.PI / 2
      const halfW = size * 0.42
      const left = { x: center.x + halfW * Math.cos(perp), y: center.y + halfW * Math.sin(perp) }
      const right = { x: center.x - halfW * Math.cos(perp), y: center.y - halfW * Math.sin(perp) }
      return <path d={`M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${tail.x} ${tail.y} L ${right.x} ${right.y} Z`} fill={color} />
    }
    default:
      return null
  }
}

/**
 * Renders `arrow` / `line` / `draw` shapes from their `points` polyline (local
 * coords, already relative to the shape origin via ShapeDispatcher's translate),
 * honoring stroke dash style and start/end arrowhead decorations.
 */
function LinearShapeInner({ shape }: { shape: CanvasShape }) {
  const pts = shape.points ?? []
  if (pts.length < 2) return null

  const stroke = shape.strokes[0]
  const color = stroke?.color ?? DEFAULT_COLOR
  const width = stroke?.width ?? DEFAULT_WIDTH
  const opacity = stroke?.opacity ?? 1
  const size = Math.max(10, width * 4)

  // `draw` is a high-density freehand polyline — keep it as a folded path so the
  // rendering cost stays bounded. `arrow`/`line` with ≥3 vertices smooth into a
  // Catmull-Rom curve (the excalidraw "curved arrow" look).
  const useSmooth = (shape.type === 'arrow' || shape.type === 'line') && pts.length >= 3
  const d = useSmooth
    ? smoothPath(pts)
    : pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  const startStyle: Arrowhead = shape.arrowheadStart ?? 'none'
  const endStyle: Arrowhead =
    shape.arrowheadEnd ?? (shape.type === 'arrow' ? 'arrow' : 'none')

  const p0 = pts[0]
  const p0n = pts[1]
  const startAngle = Math.atan2(p0.y - p0n.y, p0.x - p0n.x)
  const pN = pts[pts.length - 1]
  const pNp = pts[pts.length - 2]
  const endAngle = Math.atan2(pN.y - pNp.y, pN.x - pNp.x)

  return (
    <g opacity={opacity}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashArray(stroke?.dash, width)}
      />
      {arrowhead(p0, startAngle, startStyle, size, color, width)}
      {arrowhead(pN, endAngle, endStyle, size, color, width)}
    </g>
  )
}

export const LinearShape = memo(LinearShapeInner)
