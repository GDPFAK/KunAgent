import type { CanvasDocument, Rect } from '../canvas/canvas-types'

export type DesignAssetKind = 'image'

export type DesignAssetSourceKind = 'workspace' | 'remote' | 'data' | 'blob'

export type CanvasDesignAsset = {
  id: string
  kind: DesignAssetKind
  name: string
  path: string
  sourceKind: DesignAssetSourceKind
  modelReady: boolean
  canvasShapeId: string
  parentId: string | null
  bounds: Rect
  aiImageHolder?: boolean
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

export function classifyDesignAssetSource(path: string): DesignAssetSourceKind {
  if (/^data:/i.test(path)) return 'data'
  if (/^blob:/i.test(path)) return 'blob'
  if (/^https?:/i.test(path)) return 'remote'
  return 'workspace'
}

export function assetModelReady(sourceKind: DesignAssetSourceKind): boolean {
  return sourceKind === 'workspace'
}

export function collectCanvasImageAssets(document: CanvasDocument): CanvasDesignAsset[] {
  return Object.values(document.objects)
    .filter((shape) => shape.type === 'image' && Boolean(clean(shape.imageUrl)))
    .map((shape) => {
      const path = clean(shape.imageUrl)!
      const sourceKind = classifyDesignAssetSource(path)
      return {
        id: shape.id,
        kind: 'image' as const,
        name: clean(shape.name) ?? 'Image asset',
        path,
        sourceKind,
        modelReady: assetModelReady(sourceKind),
        canvasShapeId: shape.id,
        parentId: shape.parentId,
        bounds: { x: shape.x, y: shape.y, width: shape.width, height: shape.height },
        ...(shape.aiImageHolder ? { aiImageHolder: true } : {})
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}

export function canvasAssetByShapeId(document: CanvasDocument, shapeId: string): CanvasDesignAsset | undefined {
  return collectCanvasImageAssets(document).find((asset) => asset.canvasShapeId === shapeId)
}
