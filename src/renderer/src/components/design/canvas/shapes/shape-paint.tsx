/**
 * Shared SVG paint helpers for canvas shapes: gradient fills, drop/inner shadow
 * filters, and a single "primary fill" resolver that returns either a solid
 * color or a `url(#…)` gradient reference. Keeping this in one place means every
 * shape (rect/ellipse/frame) renders gradients and shadows the same way.
 */
import type { CanvasShape, GradientFill } from '../../../../design/canvas/canvas-types'
import { isGradientFill } from '../../../../design/canvas/canvas-types'

export function fillDefId(shapeId: string): string {
  return `cv-fill-${shapeId}`
}

export function shadowFilterId(shapeId: string): string {
  return `cv-shadow-${shapeId}`
}

/** Whether the shape needs an SVG filter for its shadows. */
export function hasShadow(shape: CanvasShape): boolean {
  return Array.isArray(shape.shadows) && shape.shadows.length > 0
}

/** Whether the shape's primary fill is a gradient (needs a `<defs>` entry). */
export function hasGradientFill(shape: CanvasShape): boolean {
  const fill = shape.fills[0]
  return Boolean(fill && isGradientFill(fill))
}

/**
 * Resolve the primary fill into an SVG `fill` + `fillOpacity`. Solid fills paint
 * directly; gradient fills reference the `<defs>` gradient (render `GradientDef`
 * for the same shape so the id exists). No fill → transparent.
 */
export function primaryFillPaint(shape: CanvasShape): { fill: string; fillOpacity: number } {
  const fill = shape.fills[0]
  if (!fill) return { fill: 'none', fillOpacity: 0 }
  if (isGradientFill(fill)) {
    return { fill: `url(#${fillDefId(shape.id)})`, fillOpacity: fill.opacity }
  }
  return { fill: fill.color, fillOpacity: fill.opacity }
}

/** Linear-gradient angle (deg, clockwise from +X) → objectBoundingBox vector. */
function angleToVector(angle: number): { x1: number; y1: number; x2: number; y2: number } {
  const rad = ((angle - 90) * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  // Map the unit direction into the [0,1] bounding box centered at (0.5, 0.5).
  return {
    x1: 0.5 - dx / 2,
    y1: 0.5 - dy / 2,
    x2: 0.5 + dx / 2,
    y2: 0.5 + dy / 2
  }
}

function GradientStops({ fill }: { fill: GradientFill }) {
  return (
    <>
      {fill.stops.map((stop, i) => (
        <stop
          key={i}
          offset={`${Math.max(0, Math.min(1, stop.offset)) * 100}%`}
          stopColor={stop.color}
          stopOpacity={stop.opacity ?? 1}
        />
      ))}
    </>
  )
}

/** Gradient `<defs>` entry for a shape whose primary fill is a gradient. */
export function GradientDef({ shape }: { shape: CanvasShape }) {
  const fill = shape.fills[0]
  if (!fill || !isGradientFill(fill)) return null
  const id = fillDefId(shape.id)
  if (fill.type === 'radial') {
    return (
      <radialGradient id={id} cx="50%" cy="50%" r="50%">
        <GradientStops fill={fill} />
      </radialGradient>
    )
  }
  const v = angleToVector(fill.angle ?? 90)
  return (
    <linearGradient id={id} x1={v.x1} y1={v.y1} x2={v.x2} y2={v.y2}>
      <GradientStops fill={fill} />
    </linearGradient>
  )
}

/**
 * Drop-shadow `<filter>` for a shape. Stacks every entry in `shape.shadows` as a
 * chained `feDropShadow` (each layer casts off the previous result, so multiple
 * shadows compound into layered depth). `inner` shadows are rendered as drop
 * shadows for now — a faithful inset filter is a follow-up.
 */
export function ShadowFilterDef({ shape }: { shape: CanvasShape }) {
  if (!hasShadow(shape)) return null
  const shadows = shape.shadows ?? []
  return (
    <filter
      id={shadowFilterId(shape.id)}
      x="-50%"
      y="-50%"
      width="200%"
      height="200%"
      colorInterpolationFilters="sRGB"
    >
      {shadows.map((sh, i) => (
        <feDropShadow
          key={i}
          dx={sh.x}
          dy={sh.y}
          stdDeviation={Math.max(0, sh.blur) / 2}
          floodColor={sh.color}
          floodOpacity={sh.opacity}
        />
      ))}
    </filter>
  )
}

/** Combined per-shape `<defs>` (gradient + shadow). Render once inside the shape `<g>`. */
export function ShapePaintDefs({ shape }: { shape: CanvasShape }) {
  if (!hasGradientFill(shape) && !hasShadow(shape)) return null
  return (
    <defs>
      <GradientDef shape={shape} />
      <ShadowFilterDef shape={shape} />
    </defs>
  )
}
