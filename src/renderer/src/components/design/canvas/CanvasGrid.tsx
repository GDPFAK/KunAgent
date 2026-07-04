import { memo } from 'react'

function CanvasGridInner({ zoom }: { zoom: number }) {
  const dotSize = 12
  const dotRadius = Math.max(0.45, 0.65 / Math.max(zoom, 0.05))
  const dotColor = 'rgba(96,112,132,0.14)'

  return (
    <>
      <defs>
        <pattern id="canvas-dot-grid" width={dotSize} height={dotSize} patternUnits="userSpaceOnUse">
          <circle cx={dotSize / 2} cy={dotSize / 2} r={dotRadius} fill={dotColor} />
        </pattern>
      </defs>
      <rect x="-50000" y="-50000" width="100000" height="100000" fill="url(#canvas-dot-grid)" />
    </>
  )
}

export const CanvasGrid = memo(CanvasGridInner)
