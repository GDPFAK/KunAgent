import { describe, expect, it } from 'vitest'
import {
  createDefaultShape,
  createEmptyDocument,
  createHtmlFrameShape,
  ROOT_SHAPE_ID,
  type CanvasDocument
} from '../canvas/canvas-types'
import type { DesignSystem } from '../canvas/design-system-types'
import type { DesignArtifact, DesignDocument } from '../design-types'
import {
  buildPenpotHandoffPackage,
  PENPOT_HANDOFF_PACKAGE_PATH,
  serializePenpotHandoffPackage
} from './penpot-handoff-package'

const now = '2026-06-29T00:00:00.000Z'

function artifact(): DesignArtifact {
  const relativePath = '.kun-design/doc/home/v1.html'
  return {
    id: 'home',
    kind: 'html',
    title: 'Home',
    relativePath,
    designMdPath: '.kun-design/doc/home/DESIGN.md',
    createdAt: now,
    updatedAt: now,
    versions: [{ id: 'home-v1', relativePath, createdAt: now, summary: '' }],
    direction: { id: 'dir_1', name: 'Calm ops', status: 'accepted' },
    prototypeLinks: [{ targetTitle: 'Settings', targetArtifactId: 'settings', href: '../settings/v1.html' }]
  }
}

function designDocument(artifacts: DesignArtifact[]): DesignDocument {
  return {
    id: 'doc',
    title: 'Ops app',
    createdAt: now,
    updatedAt: now,
    order: 0,
    artifacts,
    activeArtifactId: artifacts[0]?.id ?? null
  }
}

function canvasDocument(): CanvasDocument {
  const doc = createEmptyDocument()
  const frame = {
    ...createHtmlFrameShape('Home', 12, 24, 'home', 'mobile'),
    id: 'frame_home',
    parentId: ROOT_SHAPE_ID
  }
  const image = {
    ...createDefaultShape('image', 40, 60),
    id: 'asset_logo',
    name: 'Logo',
    parentId: ROOT_SHAPE_ID,
    imageUrl: '.kun-design/assets/logo.png'
  }
  doc.objects[ROOT_SHAPE_ID] = { ...doc.objects[ROOT_SHAPE_ID], children: [frame.id, image.id] }
  doc.objects[frame.id] = frame
  doc.objects[image.id] = image
  return doc
}

const designSystem: DesignSystem = {
  tokens: {
    'brand/primary': { name: 'brand/primary', kind: 'color', value: '#2563eb' }
  },
  components: {
    card: {
      id: 'card',
      name: 'Metric card',
      version: 2,
      tree: [createDefaultShape('frame', 0, 0)],
      slots: [{ path: 'Title', kind: 'text' }]
    }
  }
}

describe('penpot handoff package', () => {
  it('uses the stable package path', () => {
    expect(PENPOT_HANDOFF_PACKAGE_PATH).toBe('.kun-design/penpot-package.json')
  })

  it('exports tokens, components, frames, assets, and graph summary', () => {
    const artifacts = [artifact()]
    const pkg = buildPenpotHandoffPackage({
      document: designDocument(artifacts),
      canvasDocument: canvasDocument(),
      designSystem,
      artifacts,
      updatedAt: now
    })

    expect(pkg).toMatchObject({
      version: 1,
      kind: 'kun.penpot.handoff',
      document: { id: 'doc', title: 'Ops app', artifactCount: 1 },
      graph: {
        projectId: 'doc',
        objectCount: 4,
        rootObjectCount: 2,
        directionCount: 1,
        tokenObjectCount: 1,
        componentObjectCount: 1
      }
    })
    expect(pkg.tokens).toEqual([{ name: 'brand/primary', kind: 'color', value: '#2563eb' }])
    expect(pkg.components).toEqual([
      { id: 'card', name: 'Metric card', version: 2, rootShapeCount: 1, slotCount: 1 }
    ])
    expect(pkg.frames).toEqual([
      {
        id: 'frame_home',
        name: 'Home',
        kind: 'html-frame',
        bounds: { x: 12, y: 24, width: 390, height: 844 },
        htmlArtifactId: 'home',
        htmlPath: '.kun-design/doc/home/v1.html',
        designMdPath: '.kun-design/doc/home/DESIGN.md',
        direction: { id: 'dir_1', name: 'Calm ops', status: 'accepted' },
        prototypeLinks: [{ targetTitle: 'Settings', targetArtifactId: 'settings', href: '../settings/v1.html' }]
      }
    ])
    expect(pkg.assets).toEqual([
      {
        id: 'asset_logo',
        name: 'Logo',
        kind: 'image',
        path: '.kun-design/assets/logo.png',
        bounds: { x: 40, y: 60, width: 100, height: 100 }
      }
    ])
  })

  it('serializes with a trailing newline for workspace writes', () => {
    const content = serializePenpotHandoffPackage(
      buildPenpotHandoffPackage({
        document: designDocument([]),
        canvasDocument: createEmptyDocument(),
        designSystem,
        updatedAt: now
      })
    )

    expect(content.endsWith('\n')).toBe(true)
    expect(JSON.parse(content)).toMatchObject({ kind: 'kun.penpot.handoff' })
  })
})
