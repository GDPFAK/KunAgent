import { describe, expect, it } from 'vitest'
import { createDefaultShape, createEmptyDocument } from '../canvas/canvas-types'
import {
  classifyDesignAssetSource,
  collectCanvasImageAssets
} from './design-asset-inventory'

describe('design asset inventory', () => {
  it('classifies image asset sources', () => {
    expect(classifyDesignAssetSource('.kun-design/assets/logo.png')).toBe('workspace')
    expect(classifyDesignAssetSource('https://example.com/image.png')).toBe('remote')
    expect(classifyDesignAssetSource('data:image/png;base64,AAAA')).toBe('data')
    expect(classifyDesignAssetSource('blob:http://localhost/123')).toBe('blob')
  })

  it('collects filled canvas images as reusable assets', () => {
    const doc = createEmptyDocument()
    const logo = createDefaultShape('image', 40, 60)
    logo.id = 'asset_logo'
    logo.name = 'Logo'
    logo.imageUrl = '.kun-design/assets/logo.png'
    const remote = createDefaultShape('image', 120, 60)
    remote.id = 'asset_remote'
    remote.name = 'Remote reference'
    remote.imageUrl = 'https://example.com/reference.png'
    const empty = createDefaultShape('image', 200, 60)
    empty.id = 'asset_empty'
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [logo.id, remote.id, empty.id] }
    doc.objects[logo.id] = { ...logo, parentId: doc.rootId }
    doc.objects[remote.id] = { ...remote, parentId: doc.rootId }
    doc.objects[empty.id] = { ...empty, parentId: doc.rootId }

    expect(collectCanvasImageAssets(doc)).toEqual([
      {
        id: 'asset_logo',
        kind: 'image',
        name: 'Logo',
        path: '.kun-design/assets/logo.png',
        sourceKind: 'workspace',
        modelReady: true,
        canvasShapeId: 'asset_logo',
        parentId: doc.rootId,
        bounds: { x: 40, y: 60, width: 100, height: 100 }
      },
      {
        id: 'asset_remote',
        kind: 'image',
        name: 'Remote reference',
        path: 'https://example.com/reference.png',
        sourceKind: 'remote',
        modelReady: false,
        canvasShapeId: 'asset_remote',
        parentId: doc.rootId,
        bounds: { x: 120, y: 60, width: 100, height: 100 }
      }
    ])
  })
})
