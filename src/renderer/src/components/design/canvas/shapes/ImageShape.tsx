import { memo } from 'react'
import type { CanvasShape } from '../../../../design/canvas/canvas-types'
import { useWorkspaceImageSrc } from '../../../../design/canvas/canvas-image-source'

function ImageShapeInner({ shape }: { shape: CanvasShape }) {
  // Resolve workspace-relative paths (e.g. generated images) to a renderable
  // data URL; direct data:/http(s):/blob: URLs pass through. Null while loading.
  const src = useWorkspaceImageSrc(shape.imageUrl)

  if (!src) {
    // Empty AI image holder — a distinct accent slot the design agent fills on
    // request (selection-aware fill in the canvas turn prompt). Once it has an
    // imageUrl the branch below renders the picture and the holder flag is moot.
    if (shape.aiImageHolder) {
      const { width: w, height: h } = shape
      const showLabel = w > 48 && h > 28
      const fontSize = Math.max(9, Math.min(13, Math.min(w, h) / 7))
      return (
        <>
          <rect
            x={0}
            y={0}
            width={w}
            height={h}
            rx={6}
            fill="#eef4fc"
            stroke="#3b82d8"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
          {showLabel && (
            <text
              x={w / 2}
              y={h / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={fontSize}
              fontFamily="Inter, system-ui, sans-serif"
              fontWeight={600}
              fill="#3b82d8"
            >
              ✨ AI 图片
            </text>
          )}
        </>
      )
    }
    return (
      <rect
        x={0}
        y={0}
        width={shape.width}
        height={shape.height}
        fill="#e5e7eb"
        stroke="#d1d5db"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
    )
  }

  return (
    <image
      x={0}
      y={0}
      width={shape.width}
      height={shape.height}
      href={src}
      preserveAspectRatio="xMidYMid slice"
    />
  )
}

export const ImageShape = memo(ImageShapeInner)
