import { memo } from 'react'
import type { CanvasShape } from '../../../../design/canvas/canvas-types'
import { isHtmlFrame } from '../../../../design/canvas/canvas-types'
import { useDesignWorkspaceStore } from '../../../../design/design-workspace-store'
import { ShapeDispatcher } from './ShapeDispatcher'
import { ShapePaintDefs, primaryFillPaint } from './shape-paint'

type HtmlFramePreviewStatus = 'pending' | 'ready' | 'error' | undefined
type HtmlFrameParallelStatus = 'queued' | 'running' | 'done' | 'failed' | undefined

export function isHtmlFramePreviewGenerating(
  previewStatus: HtmlFramePreviewStatus,
  parallelStatus: HtmlFrameParallelStatus
): boolean {
  return previewStatus === 'pending' || parallelStatus === 'queued' || parallelStatus === 'running'
}

function HtmlFramePlaceholder({
  shape,
  generating
}: {
  shape: CanvasShape
  generating: boolean
}) {
  return (
    <>
      <rect
        x={0}
        y={0}
        width={shape.width}
        height={shape.height}
        fill="none"
        stroke="#d1d5db"
        strokeWidth={1}
        strokeDasharray={generating ? '6 3' : '7 4'}
        rx={4}
      />
    </>
  )
}

function FrameShapeInner({
  shape,
  objects
}: {
  shape: CanvasShape
  objects: Record<string, CanvasShape>
}) {
  const previewStatus = useDesignWorkspaceStore((s) => {
    if (!isHtmlFrame(shape) || !shape.htmlArtifactId) return undefined
    return s.artifacts.find((artifact) => artifact.id === shape.htmlArtifactId)?.previewStatus
  })
  const parallelStatus = useDesignWorkspaceStore((s) => {
    if (!isHtmlFrame(shape) || !shape.htmlArtifactId) return undefined
    return s.parallelPageStates[shape.htmlArtifactId]?.status
  })

  if (isHtmlFrame(shape)) {
    return (
      <HtmlFramePlaceholder
        shape={shape}
        generating={isHtmlFramePreviewGenerating(previewStatus, parallelStatus)}
      />
    )
  }

  const { fill, fillOpacity } = primaryFillPaint(shape)
  const clipId = shape.clipContent ? `clip-${shape.id}` : undefined

  // AI image holder: an empty frame the design agent fills in place by setting
  // imageUrl, converting the holder to a single image shape. Until then, show
  // an accent dashed border plus a centered hint.
  const isHolder = Boolean(shape.aiImageHolder)
  const holderHasContent = shape.children.some((id) => objects[id]?.visible)
  const showHolderHint = isHolder && !holderHasContent && shape.width > 56 && shape.height > 32
  const holderFontSize = Math.max(9, Math.min(13, Math.min(shape.width, shape.height) / 8))

  return (
    <>
      <ShapePaintDefs shape={shape} />
      <rect
        x={0}
        y={0}
        width={shape.width}
        height={shape.height}
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
          fill="none"
          stroke={s.color}
          strokeWidth={s.width}
          strokeOpacity={s.opacity}
        />
      ))}
      {isHolder && (
        <rect
          x={0}
          y={0}
          width={shape.width}
          height={shape.height}
          fill="none"
          stroke="#3b82d8"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          rx={4}
        />
      )}
      {showHolderHint && (
        <text
          x={shape.width / 2}
          y={shape.height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={holderFontSize}
          fontFamily="Inter, system-ui, sans-serif"
          fontWeight={600}
          fill="#3b82d8"
        >
          ✨ AI 图片框
        </text>
      )}
      {clipId && (
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={shape.width} height={shape.height} />
          </clipPath>
        </defs>
      )}
      <g clipPath={clipId ? `url(#${clipId})` : undefined}>
        {/*
         * Child x/y are ABSOLUTE canvas coords (the one convention shared by
         * hit-test, selection, the AI snapshot and every creation tool). This
         * group already sits inside the frame's translate(shape.x, shape.y), so
         * we cancel that offset here — otherwise children would render at
         * frame.pos + child.pos (double-offset). The clip rect above stays in
         * frame-local space, so clipping still works after the counter-translate.
         */}
        <g transform={`translate(${-shape.x}, ${-shape.y})`}>
          {shape.children.map((childId) => {
            const child = objects[childId]
            if (!child || !child.visible) return null
            return <ShapeDispatcher key={childId} shapeId={childId} objects={objects} />
          })}
        </g>
      </g>
    </>
  )
}

export const FrameShape = memo(FrameShapeInner)
