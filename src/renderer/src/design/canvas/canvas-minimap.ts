import { isShapeEffectivelyVisible } from './canvas-editability'
import { getCanvasDocumentContentBounds } from './canvas-placement'
import {
  shapeGeometry,
  type CanvasDocument,
  type Point,
  type Rect,
  type ViewBox
} from './canvas-types'

export type MinimapShapeRect = {
  id: string
  rect: Rect
  selected: boolean
}

export type MinimapLayout = {
  width: number
  height: number
  worldBounds: Rect
  contentRect: Rect
  viewportRect: Rect
  shapeRects: MinimapShapeRect[]
  offsetX: number
  offsetY: number
  scale: number
}

const DEFAULT_PADDING_PX = 8
const MIN_WORLD_PADDING = 80

function finite(n: number, fallback = 0): number {
  return Number.isFinite(n) ? n : fallback
}

function positive(n: number, fallback = 1): number {
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function unionRect(a: Rect, b: Rect): Rect {
  const minX = Math.min(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxX = Math.max(a.x + a.width, b.x + b.width)
  const maxY = Math.max(a.y + a.height, b.y + b.height)
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  }
}

function padRect(rect: Rect): Rect {
  const pad = Math.max(MIN_WORLD_PADDING, Math.max(rect.width, rect.height) * 0.08)
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2
  }
}

function mapRect(rect: Rect, world: Rect, scale: number, offsetX: number, offsetY: number): Rect {
  return {
    x: offsetX + (finite(rect.x) - world.x) * scale,
    y: offsetY + (finite(rect.y) - world.y) * scale,
    width: Math.max(1, positive(rect.width) * scale),
    height: Math.max(1, positive(rect.height) * scale)
  }
}

function collectTopLevelShapeRects(
  doc: CanvasDocument,
  selectedIds: ReadonlySet<string>
): MinimapShapeRect[] {
  const root = doc.objects[doc.rootId]
  if (!root) return []
  const rows: MinimapShapeRect[] = []
  const seen = new Set<string>()

  const addShape = (id: string, selected: boolean): void => {
    if (seen.has(id)) return
    const shape = doc.objects[id]
    if (!shape || !isShapeEffectivelyVisible(doc.objects, id)) return
    const bounds = shapeGeometry(shape).selrect
    if (bounds.width <= 0 || bounds.height <= 0) return
    seen.add(id)
    rows.push({ id, rect: bounds, selected })
  }

  for (const id of root.children) addShape(id, selectedIds.has(id))
  for (const id of selectedIds) addShape(id, true)
  return rows
}

export function createCanvasMinimapLayout(
  doc: CanvasDocument,
  vbox: ViewBox,
  selectedIds: ReadonlySet<string>,
  size: { width: number; height: number },
  paddingPx = DEFAULT_PADDING_PX
): MinimapLayout | null {
  const contentBounds = getCanvasDocumentContentBounds(doc)
  if (!contentBounds) return null

  const width = positive(size.width, 1)
  const height = positive(size.height, 1)
  const viewportBounds = {
    x: finite(vbox.x),
    y: finite(vbox.y),
    width: positive(vbox.width),
    height: positive(vbox.height)
  }
  const worldBounds = padRect(unionRect(contentBounds, viewportBounds))
  const safePadding = Math.max(0, Math.min(width / 3, height / 3, finite(paddingPx)))
  const availableWidth = Math.max(1, width - safePadding * 2)
  const availableHeight = Math.max(1, height - safePadding * 2)
  const scale = Math.min(availableWidth / worldBounds.width, availableHeight / worldBounds.height)
  const mappedWorldWidth = worldBounds.width * scale
  const mappedWorldHeight = worldBounds.height * scale
  const offsetX = (width - mappedWorldWidth) / 2
  const offsetY = (height - mappedWorldHeight) / 2

  return {
    width,
    height,
    worldBounds,
    contentRect: mapRect(contentBounds, worldBounds, scale, offsetX, offsetY),
    viewportRect: mapRect(viewportBounds, worldBounds, scale, offsetX, offsetY),
    shapeRects: collectTopLevelShapeRects(doc, selectedIds).map((item) => ({
      ...item,
      rect: mapRect(item.rect, worldBounds, scale, offsetX, offsetY)
    })),
    offsetX,
    offsetY,
    scale
  }
}

export function minimapPointToCanvas(layout: MinimapLayout, point: Point): Point {
  const x = (finite(point.x) - layout.offsetX) / layout.scale + layout.worldBounds.x
  const y = (finite(point.y) - layout.offsetY) / layout.scale + layout.worldBounds.y
  const minX = layout.worldBounds.x
  const minY = layout.worldBounds.y
  const maxX = layout.worldBounds.x + layout.worldBounds.width
  const maxY = layout.worldBounds.y + layout.worldBounds.height
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y))
  }
}
