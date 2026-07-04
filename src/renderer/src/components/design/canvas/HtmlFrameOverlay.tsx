import { useEffect, useMemo, type ReactElement } from 'react'
import { useCanvasShapeStore } from '../../../design/canvas/canvas-shape-store'
import { useCanvasViewportStore } from '../../../design/canvas/canvas-viewport-store'
import { useCanvasSelectionStore } from '../../../design/canvas/canvas-selection-store'
import {
  isCanvasPortalFrame,
  isHtmlFrame,
  isRunningAppFrame,
  type CanvasDocument,
  type CanvasShape,
  type Rect
} from '../../../design/canvas/canvas-types'
import type { DesignHtmlElementContext } from '../../../design/design-composer-context'
import type { DesignRuntimeQualityPayload } from '../../../design/design-html-quality'
import { ScreenOverlay } from './html-frame/HtmlFrameScreenOverlay'
import { htmlFrameOverlayCanMountAtZoom } from './html-frame/html-frame-helpers'
import { RunningAppFrameOverlay } from './RunningAppFrameOverlay'

export {
  HTML_FRAME_CONTENT_SIZE_QUERY,
  buildHtmlFrameScrollbarSuppressionScript,
  executeHtmlFrameWebviewScript,
  htmlFrameAllowsWidthAutoGrow,
  htmlFrameDrawingActive,
  htmlFrameOverlayCanMountAtZoom,
  htmlFrameOverlayPointerEvents,
  htmlFramePreviewAsyncEpochMatches,
  htmlFrameShouldClearElementContextOnEditingChange,
  htmlFrameShouldApplyScrollbarSuppression,
  htmlFrameShouldPromotePreviewToReady,
  htmlFrameShouldSuppressDocumentScrollbars,
  htmlFrameWebviewCanvasStyle,
  htmlFrameWebviewPartition,
  resolveHtmlFrameMeasurementDecision,
  shouldAutoResizeHtmlFrame,
  shouldRenderHtmlFrameWebview
} from './html-frame/html-frame-helpers'
export type { HtmlFrameMeasurementDecision } from './html-frame/html-frame-helpers'

const MAX_ACTIVE_WEBVIEWS = 10

export type HtmlFrameCanvasScreenTransform = {
  scale: number
  offsetX: number
  offsetY: number
}

export function htmlFrameCanvasScreenTransform({
  vbox,
  containerWidth,
  containerHeight
}: {
  vbox: Rect
  containerWidth: number
  containerHeight: number
}): HtmlFrameCanvasScreenTransform {
  const safeVboxWidth = Number.isFinite(vbox.width) && vbox.width > 0 ? vbox.width : 1
  const safeVboxHeight = Number.isFinite(vbox.height) && vbox.height > 0 ? vbox.height : 1
  const safeContainerWidth = Number.isFinite(containerWidth) && containerWidth > 0 ? containerWidth : 1
  const safeContainerHeight = Number.isFinite(containerHeight) && containerHeight > 0 ? containerHeight : 1
  const scale = Math.min(safeContainerWidth / safeVboxWidth, safeContainerHeight / safeVboxHeight)
  return {
    scale,
    offsetX: (safeContainerWidth - safeVboxWidth * scale) / 2,
    offsetY: (safeContainerHeight - safeVboxHeight * scale) / 2
  }
}

export function htmlFrameCanvasRectToScreenRect(
  shape: Pick<CanvasShape, 'x' | 'y' | 'width' | 'height'>,
  vbox: Rect,
  transform: HtmlFrameCanvasScreenTransform
): Rect {
  return {
    x: transform.offsetX + (shape.x - vbox.x) * transform.scale,
    y: transform.offsetY + (shape.y - vbox.y) * transform.scale,
    width: shape.width * transform.scale,
    height: shape.height * transform.scale
  }
}

export function htmlFramesInCanvasPaintOrder(document: CanvasDocument): CanvasShape[] {
  return canvasPortalFramesInCanvasPaintOrder(document).filter(isHtmlFrame)
}

export function canvasPortalFramesInCanvasPaintOrder(document: CanvasDocument): CanvasShape[] {
  const frames: CanvasShape[] = []
  const visit = (id: string): void => {
    const shape = document.objects[id]
    if (!shape || !shape.visible) return
    if (id !== document.rootId && isCanvasPortalFrame(shape)) {
      frames.push(shape)
      return
    }
    for (const childId of shape.children) visit(childId)
  }
  for (const childId of document.objects[document.rootId]?.children ?? []) visit(childId)
  return frames
}

export function htmlFrameIntersectsViewport(shape: CanvasShape, vbox: Rect): boolean {
  const right = shape.x + shape.width
  const bottom = shape.y + shape.height
  const vRight = vbox.x + vbox.width
  const vBottom = vbox.y + vbox.height
  return right > vbox.x && shape.x < vRight && bottom > vbox.y && shape.y < vBottom
}

export function selectHtmlFramesForOverlay(
  framesInPaintOrder: CanvasShape[],
  selectedIds: ReadonlySet<string>,
  maxActive: number = MAX_ACTIVE_WEBVIEWS
): CanvasShape[] {
  const priority = framesInPaintOrder
    .map((shape, index) => ({
      shape,
      index,
      selected: selectedIds.has(shape.id) ? 1 : 0
    }))
    .sort((a, b) => b.selected - a.selected || b.index - a.index)
    .slice(0, Math.max(0, maxActive))
  const mountedIds = new Set(priority.map((item) => item.shape.id))
  return framesInPaintOrder.filter((shape) => mountedIds.has(shape.id))
}

type Props = {
  workspaceRoot: string
  interactiveId: string | null
  editingId: string | null
  onToggleInteractive: (shapeId: string) => void
  onToggleModify: (shapeId: string) => void
  onUseElementAsContext?: (context: DesignHtmlElementContext | null, promptSeed?: string) => void
  onRuntimeQualityFindings?: (payload: DesignRuntimeQualityPayload) => void
  onRequestQualityRepair?: (payload: DesignRuntimeQualityPayload) => void
}

export function HtmlFrameOverlay({
  workspaceRoot,
  interactiveId,
  editingId,
  onToggleInteractive,
  onToggleModify,
  onUseElementAsContext,
  onRuntimeQualityFindings,
  onRequestQualityRepair
}: Props): ReactElement {
  const document = useCanvasShapeStore((s) => s.document)
  const objects = document.objects
  const vbox = useCanvasViewportStore((s) => s.vbox)
  const containerWidth = useCanvasViewportStore((s) => s.containerWidth)
  const containerHeight = useCanvasViewportStore((s) => s.containerHeight)
  const activeTool = useCanvasViewportStore((s) => s.activeTool)
  const selectedIds = useCanvasSelectionStore((s) => s.selectedIds)

  const canvasScreenTransform = useMemo(() => htmlFrameCanvasScreenTransform({
    vbox,
    containerWidth,
    containerHeight
  }), [containerHeight, containerWidth, vbox])
  const zoom = canvasScreenTransform.scale
  const panning = activeTool === 'hand'

  const portalFrames = useMemo(() => {
    return canvasPortalFramesInCanvasPaintOrder(document)
  }, [document])

  // Mount priority favors selected/topmost frames, then we render in paint order
  // so the DOM overlay matches the SVG canvas stacking order.
  const visibleFrames = useMemo(() => {
    return selectHtmlFramesForOverlay(
      portalFrames.filter((shape) => htmlFrameIntersectsViewport(shape, vbox)),
      selectedIds
    )
  }, [portalFrames, vbox, selectedIds])

  const selectedIdsKey = useMemo(() => [...selectedIds].sort().join(','), [selectedIds])

  useEffect(() => {
    onUseElementAsContext?.(null)
  }, [onUseElementAsContext, selectedIdsKey])

  if (portalFrames.length === 0 || !htmlFrameOverlayCanMountAtZoom(zoom)) return <></>

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {visibleFrames.map((shape) => {
        const screenRect = htmlFrameCanvasRectToScreenRect(shape, vbox, canvasScreenTransform)
        const active = selectedIds.has(shape.id)

        if (isRunningAppFrame(shape)) {
          return (
            <RunningAppFrameOverlay
              key={shape.id}
              shape={shape}
              screenX={screenRect.x}
              screenY={screenRect.y}
              screenWidth={screenRect.width}
              screenHeight={screenRect.height}
              zoom={zoom}
              active={active}
              interactive={interactiveId === shape.id}
              panning={panning}
              editing={editingId === shape.id}
              onDoubleClick={onToggleInteractive}
            />
          )
        }

        return (
          <ScreenOverlay
            key={shape.id}
            shape={shape}
            workspaceRoot={workspaceRoot}
            screenX={screenRect.x}
            screenY={screenRect.y}
            screenWidth={screenRect.width}
            screenHeight={screenRect.height}
            zoom={zoom}
            active={active}
            interactive={interactiveId === shape.id}
            panning={panning}
            editing={editingId === shape.id}
            onDoubleClick={onToggleInteractive}
            onToggleModify={onToggleModify}
            onUseElementAsContext={onUseElementAsContext}
            onRuntimeQualityFindings={onRuntimeQualityFindings}
            onRequestQualityRepair={onRequestQualityRepair}
          />
        )
      })}
    </div>
  )
}
