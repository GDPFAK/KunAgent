import { memo, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createCanvasMinimapLayout,
  minimapPointToCanvas
} from '../../../design/canvas/canvas-minimap'
import { useCanvasSelectionStore } from '../../../design/canvas/canvas-selection-store'
import { useCanvasShapeStore } from '../../../design/canvas/canvas-shape-store'
import { useCanvasViewportStore } from '../../../design/canvas/canvas-viewport-store'

const MINIMAP_WIDTH = 160
const MINIMAP_HEIGHT = 108

function CanvasMinimapInner() {
  const { t } = useTranslation('common')
  const document = useCanvasShapeStore((s) => s.document)
  const selectedIds = useCanvasSelectionStore((s) => s.selectedIds)
  const vbox = useCanvasViewportStore((s) => s.vbox)
  const setVbox = useCanvasViewportStore((s) => s.setVbox)
  const draggingRef = useRef(false)

  const layout = useMemo(
    () => createCanvasMinimapLayout(document, vbox, selectedIds, {
      width: MINIMAP_WIDTH,
      height: MINIMAP_HEIGHT
    }),
    [document, selectedIds, vbox]
  )

  const centerViewportAt = useCallback(
    (clientX: number, clientY: number, target: SVGSVGElement): void => {
      if (!layout) return
      const rect = target.getBoundingClientRect()
      const point = minimapPointToCanvas(layout, {
        x: ((clientX - rect.left) / rect.width) * MINIMAP_WIDTH,
        y: ((clientY - rect.top) / rect.height) * MINIMAP_HEIGHT
      })
      setVbox({
        ...vbox,
        x: point.x - vbox.width / 2,
        y: point.y - vbox.height / 2
      })
    },
    [layout, setVbox, vbox]
  )

  if (!layout || layout.shapeRects.length === 0) return null

  return (
    <div className="rounded-md border border-ds-border bg-ds-card/95 p-1 shadow-lg backdrop-blur">
      <svg
        role="img"
        aria-label={t('canvasMinimap')}
        className="block cursor-crosshair touch-none"
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        viewBox={`0 0 ${MINIMAP_WIDTH} ${MINIMAP_HEIGHT}`}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.stopPropagation()
          draggingRef.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          centerViewportAt(e.clientX, e.clientY, e.currentTarget)
        }}
        onPointerMove={(e) => {
          if (!draggingRef.current) return
          e.stopPropagation()
          centerViewportAt(e.clientX, e.clientY, e.currentTarget)
        }}
        onPointerUp={(e) => {
          e.stopPropagation()
          draggingRef.current = false
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId)
          }
        }}
        onPointerCancel={(e) => {
          e.stopPropagation()
          draggingRef.current = false
        }}
      >
        <rect
          x={0}
          y={0}
          width={MINIMAP_WIDTH}
          height={MINIMAP_HEIGHT}
          rx={4}
          fill="rgba(148, 163, 184, 0.09)"
        />
        <rect
          x={layout.contentRect.x}
          y={layout.contentRect.y}
          width={layout.contentRect.width}
          height={layout.contentRect.height}
          rx={2}
          fill="rgba(148, 163, 184, 0.08)"
          stroke="rgba(148, 163, 184, 0.28)"
          strokeWidth={1}
        />
        {layout.shapeRects.map((item) => (
          <rect
            key={item.id}
            x={item.rect.x}
            y={item.rect.y}
            width={item.rect.width}
            height={item.rect.height}
            rx={item.selected ? 2 : 1}
            fill={
              item.selected
                ? 'rgba(37, 99, 235, 0.46)'
                : 'rgba(100, 116, 139, 0.42)'
            }
            stroke={
              item.selected
                ? 'rgba(37, 99, 235, 0.85)'
                : 'rgba(100, 116, 139, 0.55)'
            }
            strokeWidth={item.selected ? 1.5 : 1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <rect
          x={layout.viewportRect.x}
          y={layout.viewportRect.y}
          width={layout.viewportRect.width}
          height={layout.viewportRect.height}
          rx={2}
          fill="rgba(255, 255, 255, 0.22)"
          stroke="rgba(37, 99, 235, 0.95)"
          strokeWidth={1.6}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

export const CanvasMinimap = memo(CanvasMinimapInner)
