import { memo } from 'react'
import type { CanvasShape } from '../../../../design/canvas/canvas-types'
import { ShapePaintDefs, primaryFillPaint } from './shape-paint'

function RectShapeInner({ shape }: { shape: CanvasShape }) {
  const r = shape.cornerRadius
  const rx = typeof r === 'number' ? r : r[0]
  const ry = typeof r === 'number' ? r : r[1]
  const { fill, fillOpacity } = primaryFillPaint(shape)

  return (
    <>
      <ShapePaintDefs shape={shape} />
      <rect
        x={0}
        y={0}
        width={shape.width}
        height={shape.height}
        rx={rx}
        ry={ry}
        fill={fill}
        fillOpacity={fillOpacity}
      />
      {shape.strokes.map((s, i) => (
        <rect
          key={i}
          x={0}
          y={0}
          width={shape.width}
          height={shape.height}
          rx={rx}
          ry={ry}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width}
          strokeOpacity={s.opacity}
        />
      ))}
    </>
  )
}

export const RectShape = memo(RectShapeInner)
