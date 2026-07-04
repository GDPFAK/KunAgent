import { describe, expect, it, beforeEach } from 'vitest'
import { executeOps } from './shape-ops'
import { useCanvasShapeStore } from './canvas-shape-store'
import { useCanvasUndoStore } from './canvas-undo-store'
import { useCanvasSelectionStore } from './canvas-selection-store'
import { useDesignSystemStore } from './design-system-store'
import { setScreenArtifactFactory, setScreenCreationFactory, takeScreenBrief } from './screen-artifact-bridge'
import { createLinkedHtmlScreen } from './screen-lifecycle'
import { useCanvasViewportStore } from './canvas-viewport-store'
import { createDefaultShape, createEmptyDocument, createHtmlFrameShape, type CanvasShape } from './canvas-types'
import { useDesignWorkspaceStore } from '../design-workspace-store'
import type { DesignArtifact, DesignDocument } from '../design-types'

const createdAt = '2026-06-20T00:00:00.000Z'

beforeEach(() => {
  useCanvasShapeStore.getState().loadDocument(createEmptyDocument())
  useCanvasUndoStore.getState().clear()
  useCanvasSelectionStore.getState().clearSelection()
  useDesignSystemStore.getState().resetSystem()
  setScreenArtifactFactory(null)
  setScreenCreationFactory(null)
  useCanvasViewportStore.getState().setVbox({ x: -600, y: -400, width: 1200, height: 800 })
  useCanvasViewportStore.getState().setContainerSize(1200, 800)
  useDesignWorkspaceStore.setState({
    workspaceRoot: '',
    documents: [],
    activeDocumentId: null,
    artifacts: [],
    activeArtifactId: null,
    designContext: { designTarget: 'web' },
    fileError: null,
    parallelPageStates: {}
  })
})

function getShape(id: string): CanvasShape {
  return useCanvasShapeStore.getState().getShape(id) as CanvasShape
}
function addRect(x: number, y: number, w = 100, h = 80, parentId?: string): string {
  const op = parentId
    ? { op: 'add' as const, shape: { type: 'rect' as const, x, y, width: w, height: h }, parentId }
    : { op: 'add' as const, shape: { type: 'rect' as const, x, y, width: w, height: h } }
  return executeOps([op]).affectedIds[0]
}

function installHtmlArtifact(id = 'screen'): DesignArtifact {
  const relativePath = `.kun-design/doc/${id}/v1.html`
  const artifact: DesignArtifact = {
    id,
    kind: 'html',
    title: id,
    relativePath,
    createdAt,
    updatedAt: createdAt,
    versions: [{ id: `${id}-v1`, relativePath, createdAt, summary: '' }],
    node: { x: 0, y: 0, width: 390, height: 844, sizeMode: 'auto', viewMode: 'preview' }
  }
  const doc: DesignDocument = {
    id: 'doc',
    title: 'Doc',
    createdAt,
    updatedAt: createdAt,
    order: 0,
    artifacts: [artifact],
    activeArtifactId: artifact.id
  }
  useDesignWorkspaceStore.setState({
    workspaceRoot: '',
    documents: [doc],
    activeDocumentId: doc.id,
    artifacts: doc.artifacts,
    activeArtifactId: artifact.id,
    designContext: { designTarget: 'app' }
  })
  return artifact
}

function installLinkedScreenFactory(): void {
  const board: DesignArtifact = {
    id: 'board',
    kind: 'canvas',
    title: 'Design board',
    relativePath: '.kun-design/doc/board/canvas.json',
    createdAt,
    updatedAt: createdAt,
    versions: [{ id: 'board-v1', relativePath: '.kun-design/doc/board/canvas.json', createdAt, summary: '' }]
  }
  const doc: DesignDocument = {
    id: 'doc',
    title: 'Doc',
    createdAt,
    updatedAt: createdAt,
    order: 0,
    artifacts: [board],
    activeArtifactId: board.id
  }
  useDesignWorkspaceStore.setState({
    workspaceRoot: '',
    documents: [doc],
    activeDocumentId: doc.id,
    artifacts: [board],
    activeArtifactId: board.id,
    designContext: { designTarget: 'web' }
  })
  setScreenCreationFactory((request) => {
    expect(request.preparePreview).toBe(false)
    const created = createLinkedHtmlScreen({
      boardArtifactId: board.id,
      name: request.name,
      brief: request.brief,
      x: request.x,
      y: request.y,
      width: request.width,
      height: request.height,
      targetFrameId: request.targetFrameId,
      devicePreset: request.devicePreset,
      preparePreview: request.preparePreview
    })
    return created ? { artifactId: created.artifactId, shapeId: created.shape.id } : null
  })
}

describe('grid', () => {
  it('lays a frame’s children out on a grid by cell size + gaps', () => {
    const frame = executeOps([
      { op: 'add', shape: { type: 'frame', name: 'Grid', x: 0, y: 0, width: 500, height: 500 } }
    ]).affectedIds[0]
    const ids = [0, 1, 2, 3].map((i) => addRect(i * 7, i * 7, 100, 80, frame))
    const r = executeOps([{ op: 'grid', id: frame, cols: 2, rowGap: 10, colGap: 10 }])
    expect(r.ok).toBe(true)
    const pos = ids.map((id) => [getShape(id).x, getShape(id).y])
    // cellW 100 + colGap 10 = 110 step; cellH 80 + rowGap 10 = 90 step
    expect(pos).toEqual([
      [0, 0],
      [110, 0],
      [0, 90],
      [110, 90]
    ])
  })
})

describe('stack', () => {
  it('wraps shapes in an auto-layout container and reflows them', () => {
    const a = addRect(0, 0, 50, 50)
    const b = addRect(200, 0, 50, 50)
    const r = executeOps([{ op: 'stack', ids: [a, b], direction: 'horizontal', gap: 10 }])
    expect(r.ok).toBe(true)
    const sa = getShape(a)
    const sb = getShape(b)
    expect(sa.parentId).toBe(sb.parentId)
    const container = getShape(sa.parentId as string)
    expect(container.layout?.direction).toBe('horizontal')
    // horizontal row: b sits one width + gap to the right of a, regardless of padding
    expect(sb.x - sa.x).toBe(sa.width + 10)
  })
})

describe('bulk-edit', () => {
  it('applies a style to every shape matching a type filter', () => {
    const r1 = addRect(0, 0)
    const r2 = addRect(120, 0)
    const e = executeOps([{ op: 'add', shape: { type: 'ellipse', x: 0, y: 120, width: 50, height: 50 } }])
      .affectedIds[0]
    const red = { fills: [{ type: 'solid' as const, color: '#ff0000', opacity: 1 }] }
    const r = executeOps([{ op: 'bulk-edit', filter: { type: 'rect' }, set: red }])
    expect(r.ok).toBe(true)
    expect(r.affectedIds.sort()).toEqual([r1, r2].sort())
    expect(getShape(r1).fills[0]).toEqual(red.fills[0])
    expect(getShape(e).fills[0]).not.toEqual(red.fills[0])
  })

  it('targets token-bound shapes via boundToken', () => {
    executeOps([{ op: 'define-token', name: 'brand/primary', kind: 'color', value: '#111' }])
    const bound1 = addRect(0, 0)
    const bound2 = addRect(120, 0)
    const free = addRect(240, 0)
    executeOps([{ op: 'apply-token', ids: [bound1, bound2], prop: 'fill', token: 'brand/primary' }])
    const r = executeOps([
      { op: 'bulk-edit', filter: { boundToken: 'brand/primary' }, set: { cornerRadius: 8 } }
    ])
    expect(r.ok).toBe(true)
    expect(getShape(bound1).cornerRadius).toBe(8)
    expect(getShape(bound2).cornerRadius).toBe(8)
    expect(getShape(free).cornerRadius).toBe(0)
  })

  it('reports when the filter matches nothing', () => {
    addRect(0, 0)
    const r = executeOps([{ op: 'bulk-edit', filter: { type: 'image' }, set: { opacity: 0.5 } }])
    expect(r.ok).toBe(false)
    expect(r.errors[0].code).toBe('INVALID_OP')
  })
})

describe('apply-theme + recolor', () => {
  it('apply-theme rebinds token-bound props to themed tokens and re-resolves', () => {
    executeOps([{ op: 'define-token', name: 'light/bg', kind: 'color', value: '#ffffff' }])
    executeOps([{ op: 'define-token', name: 'dark/bg', kind: 'color', value: '#000000' }])
    const r = addRect(0, 0)
    executeOps([{ op: 'apply-token', ids: [r], prop: 'fill', token: 'light/bg' }])
    executeOps([{ op: 'apply-theme', ids: [r], remap: { 'light/bg': 'dark/bg' } }])
    expect(getShape(r).fills[0]).toEqual({ type: 'solid', color: '#000000', opacity: 1 })
    expect(getShape(r).tokenBindings).toEqual({ fill: 'dark/bg' })
  })

  it('recolor swaps exact hex fills across a subtree', () => {
    const r = addRect(0, 0) // default fill #d9d9d9
    executeOps([{ op: 'recolor', ids: [r], mapping: { '#d9d9d9': '#ff0000' } }])
    const fill = getShape(r).fills[0]
    expect(fill.type === 'solid' && fill.color).toBe('#ff0000')
  })
})

describe('responsive-reflow', () => {
  it('resizes a frame to a device preset', () => {
    const f = executeOps([
      { op: 'add', shape: { type: 'frame', x: 0, y: 0, width: 1280, height: 800 } }
    ]).affectedIds[0]
    executeOps([{ op: 'responsive-reflow', frameId: f, device: 'mobile' }])
    const frame = getShape(f)
    expect(frame.width).toBe(390)
    expect(frame.height).toBe(844)
    expect(frame.devicePreset).toBe('mobile')
  })
})

describe('HTML screen frame resize ops', () => {
  it('locks a linked HTML frame to manual size after an explicit resize op', () => {
    installHtmlArtifact('screen')
    const frame = createHtmlFrameShape('Screen', 0, 0, 'screen', 'mobile')
    useCanvasShapeStore.getState().addShape(frame)

    executeOps([{ op: 'resize', id: frame.id, bounds: { x: 10, y: 20, width: 520, height: 900 } }])

    const shape = getShape(frame.id)
    const artifact = useDesignWorkspaceStore.getState().artifacts.find((item) => item.id === 'screen')
    expect(shape).toMatchObject({ x: 10, y: 20, width: 520, height: 900 })
    expect(artifact?.node).toMatchObject({
      x: 10,
      y: 20,
      width: 520,
      height: 900,
      sizeMode: 'manual',
      boardHidden: false,
      viewMode: 'preview'
    })
  })

  it('locks a linked HTML frame to manual size after an explicit update op changes size', () => {
    installHtmlArtifact('screen')
    const frame = createHtmlFrameShape('Screen', 0, 0, 'screen', 'mobile')
    useCanvasShapeStore.getState().addShape(frame)

    executeOps([{ op: 'update', id: frame.id, patch: { height: 2400 } }])

    const shape = getShape(frame.id)
    const artifact = useDesignWorkspaceStore.getState().artifacts.find((item) => item.id === 'screen')
    expect(shape.height).toBe(2400)
    expect(artifact?.node).toMatchObject({
      x: 0,
      y: 0,
      width: 390,
      height: 2400,
      sizeMode: 'manual',
      boardHidden: false,
      viewMode: 'preview'
    })
  })

})

describe('AI image holder fill ops', () => {
  it('fills a selected empty frame as one image shape instead of adding a child image', () => {
    const frame = createDefaultShape('frame', 100, 120)
    frame.name = 'Logo frame'
    frame.width = 586
    frame.height = 643
    useCanvasShapeStore.getState().addShape(frame)
    useCanvasSelectionStore.getState().select([frame.id])

    const result = executeOps([
      {
        op: 'add',
        parentId: frame.id,
        shape: {
          type: 'image',
          name: 'iKun Logo',
          x: 132,
          y: 149,
          width: 430,
          height: 430,
          imageUrl: '.deepseekgui-images/ikun-logo.png'
        }
      }
    ])

    const shape = getShape(frame.id)
    const document = useCanvasShapeStore.getState().document
    expect(result.affectedIds).toEqual([frame.id])
    expect(document.objects[document.rootId]?.children).toEqual([frame.id])
    expect(shape).toMatchObject({
      id: frame.id,
      type: 'image',
      name: 'iKun Logo',
      x: 100,
      y: 120,
      width: 586,
      height: 643,
      imageUrl: '.deepseekgui-images/ikun-logo.png',
      aiImageHolder: false
    })
    expect(shape.children).toEqual([])
  })
})

describe('variant-matrix', () => {
  it('tiles base × devices × themes, reflowing + theming each cell', () => {
    executeOps([{ op: 'define-token', name: 'light/bg', kind: 'color', value: '#ffffff' }])
    executeOps([{ op: 'define-token', name: 'dark/bg', kind: 'color', value: '#000000' }])
    const base = executeOps([
      { op: 'add', shape: { type: 'frame', name: 'Screen', x: 0, y: 0, width: 1280, height: 800 } }
    ]).affectedIds[0]
    const child = addRect(20, 20, 100, 60, base)
    executeOps([{ op: 'apply-token', ids: [child], prop: 'fill', token: 'light/bg' }])

    const before = new Set(useCanvasShapeStore.getState().getAllShapeIds())
    const r = executeOps([
      {
        op: 'variant-matrix',
        baseId: base,
        devices: ['mobile', 'desktop'],
        themes: [
          { name: 'light', remap: {} },
          { name: 'dark', remap: { 'light/bg': 'dark/bg' } }
        ],
        at: { x: 0, y: 2000 }
      }
    ])
    expect(r.ok).toBe(true)
    const newShapes = useCanvasShapeStore
      .getState()
      .getAllShapeIds()
      .filter((id) => !before.has(id))
      .map(getShape)
    // 2 devices × 2 themes = 4 cells
    expect(newShapes.filter((s) => s.type === 'frame')).toHaveLength(4)
    const darkChildren = newShapes.filter(
      (s) => s.type === 'rect' && s.fills[0]?.type === 'solid' && s.fills[0].color === '#000000'
    )
    expect(darkChildren).toHaveLength(2) // dark theme × 2 devices
  })

  it('does not clone htmlArtifactId links when tiling a linked HTML frame', () => {
    installHtmlArtifact('screen')
    const base = createHtmlFrameShape('Screen', 0, 0, 'screen', 'desktop')
    useCanvasShapeStore.getState().addShape(base)

    const before = new Set(useCanvasShapeStore.getState().getAllShapeIds())
    executeOps([
      {
        op: 'variant-matrix',
        baseId: base.id,
        devices: ['mobile', 'tablet'],
        themes: [{ name: 'default', remap: {} }],
        at: { x: 0, y: 1200 }
      }
    ])

    const clones = useCanvasShapeStore
      .getState()
      .getAllShapeIds()
      .filter((id) => !before.has(id))
      .map(getShape)
      .filter((shape) => shape.type === 'frame')

    expect(clones).toHaveLength(2)
    expect(getShape(base.id).htmlArtifactId).toBe('screen')
    expect(clones.every((shape) => shape.htmlArtifactId === undefined)).toBe(true)
  })
})

describe('add-screens', () => {
  it('keeps screen artifact creation strict unless plain-frame fallback is enabled', () => {
    setScreenArtifactFactory(() => null)

    const strict = executeOps([{ op: 'add-screen', name: 'Architecture' }])
    expect(strict.ok).toBe(false)
    expect(strict.errors[0]?.message).toContain('Cannot create screen artifact')

    const fallback = executeOps(
      [{ op: 'add-screen', name: 'Architecture', brief: 'Sketch the runtime layers' }],
      'code-canvas-screen',
      { screenFallback: 'plain-frame' }
    )

    expect(fallback.ok).toBe(true)
    const shape = getShape(fallback.affectedIds[0])
    expect(shape).toMatchObject({
      type: 'frame',
      name: 'Architecture',
      width: 1280,
      height: 800
    })
    expect(shape.htmlArtifactId).toBeUndefined()
    expect(takeScreenBrief(shape.id)).toBeNull()
  })

  it('keeps code whiteboard plain-frame fallback ahead of any linked screen factory', () => {
    installLinkedScreenFactory()

    const result = executeOps(
      [{ op: 'add-screen', name: 'Architecture' }],
      'code-canvas-screen',
      { screenFallback: 'plain-frame' }
    )

    expect(result.ok).toBe(true)
    const shape = getShape(result.affectedIds[0])
    expect(shape).toMatchObject({
      type: 'frame',
      name: 'Architecture',
      width: 1280,
      height: 800
    })
    expect(shape.htmlArtifactId).toBeUndefined()
    expect(useDesignWorkspaceStore.getState().artifacts.filter((item) => item.kind === 'html')).toEqual([])
  })

  it('creates linked HTML artifacts and frames through the screen lifecycle factory', () => {
    installLinkedScreenFactory()

    const r = executeOps([
      {
        op: 'add-screen',
        name: 'Checkout',
        brief: 'A compact checkout screen',
        x: 24,
        y: 48,
        width: 390,
        height: 844,
        devicePreset: 'mobile'
      }
    ])

    expect(r.ok).toBe(true)
    const shape = getShape(r.affectedIds[0])
    const artifact = useDesignWorkspaceStore.getState().artifacts.find((item) => item.id === shape.htmlArtifactId)
    expect(shape).toMatchObject({
      type: 'frame',
      name: 'Checkout',
      x: 24,
      y: 48,
      width: 390,
      height: 844,
      devicePreset: 'mobile'
    })
    expect(artifact?.node).toMatchObject({
      x: 24,
      y: 48,
      width: 390,
      height: 844,
      sizeMode: 'auto',
      viewMode: 'preview'
    })
    expect(artifact?.versions[0]?.summary).toBe('A compact checkout screen')
    expect(takeScreenBrief(shape.id)).toBe('A compact checkout screen')
  })

  it('reuses the selected empty frame when creating a linked HTML screen', () => {
    installLinkedScreenFactory()
    const target = createDefaultShape('frame', -1724, -2410)
    target.name = 'Frame'
    target.width = 1834
    target.height = 930
    useCanvasShapeStore.getState().addShape(target)
    useCanvasSelectionStore.getState().select([target.id])

    const r = executeOps([
      { op: 'add-screen', name: 'Introduction', brief: 'Intro page for the community site' }
    ])

    expect(r.ok).toBe(true)
    expect(r.affectedIds).toEqual([target.id])
    const shape = getShape(target.id)
    expect(shape).toMatchObject({
      type: 'frame',
      name: 'Introduction',
      x: -1724,
      y: -2410,
      width: 1834,
      height: 930,
      devicePreset: 'desktop'
    })
    expect(shape.htmlArtifactId).toBeTruthy()
    const document = useCanvasShapeStore.getState().document
    expect(document.objects[document.rootId]?.children).toEqual([target.id])
    expect(useCanvasSelectionStore.getState().selectedIds.has(target.id)).toBe(true)

    const artifact = useDesignWorkspaceStore.getState().artifacts.find((item) => item.id === shape.htmlArtifactId)
    expect(artifact).toMatchObject({
      kind: 'html',
      title: 'Introduction',
      node: {
        x: -1724,
        y: -2410,
        width: 1834,
        height: 930,
        sizeMode: 'manual',
        viewMode: 'preview'
      }
    })
    expect(takeScreenBrief(target.id)).toBe('Intro page for the community site')
  })

  it('creates batched linked screens with auto nodes matching their frames', () => {
    useCanvasViewportStore.getState().setVbox({ x: 1000, y: 500, width: 1600, height: 1000 })
    installLinkedScreenFactory()

    const r = executeOps([
      {
        op: 'add-screens',
        specs: [
          { name: 'Home', brief: 'Landing page' },
          { name: 'Settings', brief: 'Account settings' }
        ]
      }
    ])

    expect(r.ok).toBe(true)
    expect(r.affectedIds).toHaveLength(2)
    for (const id of r.affectedIds) {
      const shape = getShape(id)
      const artifact = useDesignWorkspaceStore.getState().artifacts.find((item) => item.id === shape.htmlArtifactId)
      expect(artifact?.node).toMatchObject({
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height,
        sizeMode: 'auto'
      })
      expect(takeScreenBrief(shape.id)).toBeTruthy()
    }
  })

  it('keeps duplicate linked screen artifact titles aligned with unique frame names', () => {
    installLinkedScreenFactory()

    const r = executeOps([
      {
        op: 'add-screens',
        specs: [{ name: 'Home' }, { name: 'Home' }]
      }
    ])

    expect(r.ok).toBe(true)
    const shapes = r.affectedIds.map(getShape)
    expect(shapes.map((shape) => shape.name)).toEqual(['Home', 'Home 2'])
    for (const shape of shapes) {
      const artifact = useDesignWorkspaceStore.getState().artifacts.find((item) => item.id === shape.htmlArtifactId)
      expect(artifact?.title).toBe(shape.name)
    }
  })

  it('keeps new linked screen titles unique against hidden HTML artifacts', () => {
    installLinkedScreenFactory()
    const state = useDesignWorkspaceStore.getState()
    const hidden: DesignArtifact = {
      id: 'hidden-home',
      kind: 'html',
      title: 'Home',
      relativePath: '.kun-design/doc/hidden-home/v1.html',
      createdAt,
      updatedAt: createdAt,
      versions: [{ id: 'hidden-home-v1', relativePath: '.kun-design/doc/hidden-home/v1.html', createdAt, summary: '' }],
      node: { x: 40, y: 60, width: 1280, height: 800, sizeMode: 'auto', boardHidden: true }
    }
    useDesignWorkspaceStore.setState({
      documents: state.documents.map((doc) =>
        doc.id === state.activeDocumentId ? { ...doc, artifacts: [...doc.artifacts, hidden] } : doc
      ),
      artifacts: [...state.artifacts, hidden]
    })

    const r = executeOps([{ op: 'add-screen', name: 'Home' }])

    expect(r.ok).toBe(true)
    const shape = getShape(r.affectedIds[0])
    const artifact = useDesignWorkspaceStore.getState().artifacts.find((item) => item.id === shape.htmlArtifactId)
    expect(shape.name).toBe('Home 2')
    expect(artifact?.title).toBe('Home 2')
  })

  it('places a single screen in the current viewport when x/y are omitted', () => {
    useCanvasViewportStore.getState().setVbox({ x: 1000, y: 500, width: 1600, height: 1000 })
    setScreenArtifactFactory((name) => `art_${name}`)
    const r = executeOps([{ op: 'add-screen', name: 'Home' }])
    expect(r.ok).toBe(true)
    const shape = getShape(r.affectedIds[0])
    expect(shape.x).toBe(1160)
    expect(shape.y).toBe(600)
    expect(shape.width).toBe(1280)
    expect(shape.height).toBe(800)
    setScreenArtifactFactory(null as unknown as (name: string) => string | null)
  })

  it('defaults omitted screen presets to mobile in app target mode', () => {
    useDesignWorkspaceStore.setState({ designContext: { designTarget: 'app' } })
    useCanvasViewportStore.getState().setVbox({ x: 1000, y: 500, width: 1600, height: 1000 })
    setScreenArtifactFactory((name) => `art_${name}`)

    const r = executeOps([
      {
        op: 'add-screens',
        specs: [{ name: 'Home' }, { name: 'Settings' }]
      }
    ])

    expect(r.ok).toBe(true)
    const shapes = r.affectedIds.map(getShape)
    expect(shapes.map((s) => [s.devicePreset, s.width, s.height])).toEqual([
      ['mobile', 390, 844],
      ['mobile', 390, 844]
    ])
    setScreenArtifactFactory(null as unknown as (name: string) => string | null)
  })

  it('defaults a single add-screen op to mobile dimensions in app target mode', () => {
    useDesignWorkspaceStore.setState({ designContext: { designTarget: 'app' } })
    useCanvasViewportStore.getState().setVbox({ x: 1000, y: 500, width: 1600, height: 1000 })
    setScreenArtifactFactory((name) => `art_${name}`)

    const r = executeOps([{ op: 'add-screen', name: 'Checkout' }])

    expect(r.ok).toBe(true)
    const shape = getShape(r.affectedIds[0])
    expect(shape).toMatchObject({
      type: 'frame',
      name: 'Checkout',
      htmlArtifactId: 'art_Checkout',
      devicePreset: 'mobile',
      width: 390,
      height: 844
    })
    setScreenArtifactFactory(null as unknown as (name: string) => string | null)
  })

  it('places repeated single add-screen calls without stacking them', () => {
    useCanvasViewportStore.getState().setVbox({ x: 1000, y: 500, width: 1600, height: 1000 })
    setScreenArtifactFactory((name) => `art_${name}`)

    const first = executeOps([{ op: 'add-screen', name: 'Home' }])
    const second = executeOps([{ op: 'add-screen', name: 'Settings' }])

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    const a = getShape(first.affectedIds[0])
    const b = getShape(second.affectedIds[0])
    expect([a.x, a.y, a.width, a.height]).toEqual([1160, 600, 1280, 800])
    expect([b.x, b.y, b.width, b.height]).toEqual([2520, 600, 1280, 800])
    setScreenArtifactFactory(null as unknown as (name: string) => string | null)
  })

  it('creates N HTML screens around the current viewport, wrapping when needed', () => {
    useCanvasViewportStore.getState().setVbox({ x: 1000, y: 500, width: 1600, height: 1000 })
    setScreenArtifactFactory((name) => `art_${name}`)
    const r = executeOps([
      {
        op: 'add-screens',
        specs: [{ name: 'Home', devicePreset: 'mobile' }, { name: 'Search', devicePreset: 'mobile' }]
      }
    ])
    expect(r.ok).toBe(true)
    expect(r.affectedIds).toHaveLength(2)
    const shapes = r.affectedIds.map(getShape)
    expect(shapes.every((s) => Boolean(s.htmlArtifactId))).toBe(true)
    expect(shapes.map((s) => [s.x, s.y, s.width, s.height])).toEqual([
      [1370, 578, 390, 844],
      [1840, 578, 390, 844]
    ])
    setScreenArtifactFactory(null as unknown as (name: string) => string | null)
  })
})
