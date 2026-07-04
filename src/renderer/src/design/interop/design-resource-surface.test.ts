import { describe, expect, it } from 'vitest'
import {
  createDefaultShape,
  createEmptyDocument,
  createHtmlFrameShape,
  ROOT_SHAPE_ID,
  type CanvasDocument
} from '../canvas/canvas-types'
import { createRunningAppFrameShape } from '../canvas/running-app-frame'
import type { DesignSystem } from '../canvas/design-system-types'
import type { DesignArtifact, DesignDocument } from '../design-types'
import {
  buildDesignResourceSurface,
  DESIGN_RESOURCE_SURFACE_PATH,
  serializeDesignResourceSurface
} from './design-resource-surface'

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

function documentWithArtifacts(artifacts: DesignArtifact[]): DesignDocument {
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
  const child = {
    ...createDefaultShape('text', 32, 48),
    id: 'title',
    name: 'Title',
    parentId: frame.id,
    frameId: frame.id
  }
  frame.children = [child.id]
  const liveFrame = {
    ...createRunningAppFrameShape({
      x: 1500,
      y: 24,
      url: 'localhost:5173/home',
      title: 'Live home',
      routePath: '/home',
      sourceFile: 'src/Home.tsx'
    })!,
    id: 'frame_live',
    parentId: ROOT_SHAPE_ID
  }
  const image = {
    ...createDefaultShape('image', 2100, 80),
    id: 'asset_logo',
    name: 'Logo',
    parentId: ROOT_SHAPE_ID,
    imageUrl: '.kun-design/assets/logo.png'
  }
  doc.objects[ROOT_SHAPE_ID] = { ...doc.objects[ROOT_SHAPE_ID], children: [frame.id, liveFrame.id, image.id] }
  doc.objects[frame.id] = frame
  doc.objects[liveFrame.id] = liveFrame
  doc.objects[image.id] = image
  doc.objects[child.id] = child
  doc.codeBindings = [
    {
      id: 'binding_1',
      designObjectId: 'frame_home',
      kind: 'component',
      status: 'active',
      createdAt: now,
      target: { sourceFile: 'src/Home.tsx', componentName: 'HomeView' }
    }
  ]
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
      version: 1,
      tree: [createDefaultShape('frame', 0, 0)],
      slots: [{ path: 'Title', kind: 'text' }]
    }
  }
}

describe('design resource surface', () => {
  it('uses the stable resource-surface path', () => {
    expect(DESIGN_RESOURCE_SURFACE_PATH).toBe('.kun-design/design-resources.json')
  })

  it('exports MCP-like board, frame, token, component, and direction resources', () => {
    const artifacts = [artifact()]
    const surface = buildDesignResourceSurface({
      document: documentWithArtifacts(artifacts),
      canvasDocument: canvasDocument(),
      designSystem,
      artifacts,
      updatedAt: now
    })

    expect(surface).toMatchObject({
      version: 1,
      kind: 'kun.design.resources',
      document: { id: 'doc', title: 'Ops app' },
      counts: { board: 1, frame: 2, asset: 1, token: 1, component: 1, direction: 1, tool: 1, mode: 1 }
    })
    expect(surface.resources.map((resource) => resource.uri)).toEqual([
      'kun-design://documents/doc/boards/main',
      'kun-design://documents/doc/frames/frame_home',
      'kun-design://documents/doc/frames/frame_live',
      'kun-design://documents/doc/assets/asset_logo',
      'kun-design://documents/doc/tokens/brand%2Fprimary',
      'kun-design://documents/doc/components/card',
      'kun-design://documents/doc/directions/dir_1',
      'kun-design://documents/doc/modes/design-mode-surface',
      'kun-design://documents/doc/tools/design-tool-protocol'
    ])

    const board = JSON.parse(surface.resources[0].text)
    const frame = JSON.parse(surface.resources[1].text)
    const liveFrame = JSON.parse(surface.resources[2].text)
    const asset = JSON.parse(surface.resources[3].text)
    const token = JSON.parse(surface.resources[4].text)
    const direction = JSON.parse(surface.resources[6].text)
    const modeSurface = JSON.parse(surface.resources[7].text)
    const toolProtocol = JSON.parse(surface.resources[8].text)

    expect(board.graph).toMatchObject({
      projectId: 'doc',
      objectCount: 6,
      directionCount: 1,
      designSystem: {
        tokenCount: 1,
        componentCount: 1,
        tokenUsageCount: 0,
        componentInstanceCount: 0
      }
    })
    expect(frame).toMatchObject({
      id: 'frame_home',
      kind: 'html-frame',
      htmlPath: '.kun-design/doc/home/v1.html',
      codeBindings: [{ id: 'binding_1', kind: 'component', status: 'active' }]
    })
    expect(liveFrame).toMatchObject({
      id: 'frame_live',
      kind: 'running-app-frame',
      runningApp: {
        url: 'http://localhost:5173/home',
        routePath: '/home',
        sourceFile: 'src/Home.tsx'
      }
    })
    expect(asset).toMatchObject({
      id: 'asset_logo',
      kind: 'image',
      path: '.kun-design/assets/logo.png',
      sourceKind: 'workspace',
      modelReady: true
    })
    expect(token).toEqual({ name: 'brand/primary', kind: 'color', value: '#2563eb' })
    expect(direction.scorecard).toMatchObject({
      directionId: 'dir_1',
      readiness: 'needs-review',
      implementationCost: 'medium',
      screenCount: 1,
      flowCoverage: 1,
      risks: ['unreviewed', 'not-implemented']
    })
    expect(direction.screens).toEqual([
      {
        id: 'home',
        title: 'Home',
        htmlPath: '.kun-design/doc/home/v1.html',
        designMdPath: '.kun-design/doc/home/DESIGN.md',
        prototypeLinks: [{ targetTitle: 'Settings', targetArtifactId: 'settings', href: '../settings/v1.html' }]
      }
    ])
    expect(modeSurface).toMatchObject({
      kind: 'kun.design.mode-surface',
      recommendedSurfaceId: 'whiteboard',
      counts: { screenCount: 1, directionCount: 1, activeBindingCount: 1 },
      workflow: {
        kind: 'kun.design.mode-workflow',
        recommendedStepId: 'critique-current-direction'
      }
    })
    expect(toolProtocol.kind).toBe('kun.design.tool-protocol')
    expect(toolProtocol.tools).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'design.plan' }),
      expect.objectContaining({ id: 'design.ops' })
    ]))
  })

  it('serializes as newline-terminated JSON', () => {
    const content = serializeDesignResourceSurface(
      buildDesignResourceSurface({
        document: documentWithArtifacts([]),
        canvasDocument: createEmptyDocument(),
        designSystem,
        updatedAt: now
      })
    )

    expect(content.endsWith('\n')).toBe(true)
    expect(JSON.parse(content)).toMatchObject({ kind: 'kun.design.resources' })
  })
})
