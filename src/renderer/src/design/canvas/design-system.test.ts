import { describe, expect, it, beforeEach } from 'vitest'
import { executeOps } from './shape-ops'
import { useCanvasShapeStore } from './canvas-shape-store'
import { useCanvasUndoStore } from './canvas-undo-store'
import { useCanvasSelectionStore } from './canvas-selection-store'
import { useCanvasViewportStore } from './canvas-viewport-store'
import { useDesignSystemStore } from './design-system-store'
import { useDesignWorkspaceStore } from '../design-workspace-store'
import { createEmptyDocument, createHtmlFrameShape, type CanvasShape } from './canvas-types'
import { createDefaultShape, shapeGeometry, type Rect } from './canvas-types'
import { takeLastLintFindings } from './design-lint'
import { resolveTokenPatch } from './design-system-types'

beforeEach(() => {
  useCanvasShapeStore.getState().loadDocument(createEmptyDocument())
  useCanvasUndoStore.getState().clear()
  useCanvasSelectionStore.getState().clearSelection()
  useCanvasViewportStore.getState().resetView()
  useDesignSystemStore.getState().resetSystem()
  useDesignWorkspaceStore.setState({ designContext: { designTarget: 'web' } })
})

function addRect(): string {
  const r = executeOps([{ op: 'add', shape: { type: 'rect', x: 0, y: 0, width: 50, height: 50 } }])
  return r.affectedIds[0]
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  )
}

describe('define-token', () => {
  it('registers a color token', () => {
    const r = executeOps([{ op: 'define-token', name: 'brand/primary', kind: 'color', value: '#3b82d8' }])
    expect(r.ok).toBe(true)
    expect(useDesignSystemStore.getState().getToken('brand/primary')).toEqual({
      name: 'brand/primary',
      kind: 'color',
      value: '#3b82d8'
    })
  })

  it('rejects a color token whose value is not a string', () => {
    const r = executeOps([{ op: 'define-token', name: 'bad', kind: 'color', value: 42 }])
    expect(r.ok).toBe(false)
    expect(r.errors[0].code).toBe('INVALID_OP')
    expect(useDesignSystemStore.getState().getToken('bad')).toBeUndefined()
  })

  it('validates a gradient token value against the gradient schema', () => {
    const ok = executeOps([
      {
        op: 'define-token',
        name: 'brand/hero',
        kind: 'gradient',
        value: {
          type: 'linear',
          angle: 90,
          opacity: 1,
          stops: [
            { offset: 0, color: '#6366f1' },
            { offset: 1, color: '#8b5cf6' }
          ]
        }
      }
    ])
    expect(ok.ok).toBe(true)
    const bad = executeOps([
      { op: 'define-token', name: 'brand/bad', kind: 'gradient', value: { type: 'linear' } }
    ])
    expect(bad.ok).toBe(false)
  })
})

describe('design-system-template', () => {
  it('creates a reusable style-kit board with tokens and token-bound shapes', () => {
    const r = executeOps([
      {
        op: 'design-system-template',
        operation: 'create',
        name: 'IKUN World',
        seedColor: '#D4AF37',
        mode: 'dark',
        template: 'game'
      }
    ])
    expect(r.ok).toBe(true)
    expect(r.affectedIds.length).toBeGreaterThan(20)
    expect(useDesignSystemStore.getState().getToken('brand/primary')).toEqual({
      name: 'brand/primary',
      kind: 'color',
      value: '#D4AF37'
    })
    expect(useDesignSystemStore.getState().getComponent('Button')?.slots).toEqual([
      { path: 'label', kind: 'text', label: 'Label' }
    ])
    const shapes = Object.values(useCanvasShapeStore.getState().document.objects)
    expect(shapes.some((shape) => shape.name.includes('IKUN World Style Kit'))).toBe(true)
    expect(shapes.some((shape) => shape.tokenBindings?.fill === 'brand/primary')).toBe(true)
  })

  it('auto-places a style-kit board away from an existing image when coordinates are omitted', () => {
    useCanvasViewportStore.getState().setVbox({ x: 0, y: 0, width: 2200, height: 1400 })
    const existing = executeOps([
      {
        op: 'add',
        shape: {
          type: 'image',
          name: 'Existing design reference',
          x: 310,
          y: 260,
          width: 1580,
          height: 880,
          imageUrl: '.deepseekgui-images/existing.png'
        }
      }
    ]).affectedIds[0]

    const r = executeOps([
      {
        op: 'design-system-template',
        operation: 'create',
        name: 'Placed Kit',
        seedColor: '#2563EB'
      }
    ])

    expect(r.ok).toBe(true)
    const objects = useCanvasShapeStore.getState().document.objects
    const board = Object.values(objects).find((shape) => shape.name === 'Placed Kit Style Kit')
    expect(board).toBeDefined()
    expect(rectsOverlap(shapeGeometry(objects[existing]).selrect, shapeGeometry(board!).selrect)).toBe(false)
  })

  it('creates paired light and dark style-kit boards with namespaced tokens', () => {
    const r = executeOps([
      {
        op: 'design-system-template',
        operation: 'create',
        name: 'IKUN World',
        seedColor: '#D4AF37',
        mode: 'both',
        x: 120,
        y: 240
      }
    ])

    expect(r.ok).toBe(true)
    expect(useDesignSystemStore.getState().getToken('brand/primary')?.value).toBe('#D4AF37')
    expect(useDesignSystemStore.getState().getToken('dark/brand/primary')?.value).toBe('#D4AF37')
    expect(useDesignSystemStore.getState().getToken('light/brand/primary')?.value).toBe('#D4AF37')
    const shapes = Object.values(useCanvasShapeStore.getState().document.objects)
    expect(shapes.some((shape) => shape.name.includes('IKUN World Dark Style Kit'))).toBe(true)
    expect(shapes.some((shape) => shape.name.includes('IKUN World Light Style Kit'))).toBe(true)
    expect(shapes.some((shape) => shape.tokenBindings?.fill === 'dark/brand/primary')).toBe(true)
    expect(shapes.some((shape) => shape.tokenBindings?.fill === 'light/brand/primary')).toBe(true)
  })

  it('defaults omitted templates to web style-kit specimens for the web target', () => {
    const r = executeOps([
      {
        op: 'design-system-template',
        operation: 'create',
        name: 'Web Kit',
        seedColor: '#2563EB'
      }
    ])

    expect(r.ok).toBe(true)
    const shapes = Object.values(useCanvasShapeStore.getState().document.objects)
    expect(shapes.some((shape) => shape.name === 'Top nav surface')).toBe(true)
    expect(shapes.some((shape) => shape.name === 'Bottom nav surface')).toBe(false)
    expect(shapes.some((shape) => shape.type === 'text' && shape.textContent === 'Web target - saas kit')).toBe(true)
  })

  it('defaults omitted templates to mobile style-kit specimens for the app target', () => {
    useDesignWorkspaceStore.setState({ designContext: { designTarget: 'app' } })

    const r = executeOps([
      {
        op: 'design-system-template',
        operation: 'create',
        name: 'App Kit',
        seedColor: '#2563EB'
      }
    ])

    expect(r.ok).toBe(true)
    const shapes = Object.values(useCanvasShapeStore.getState().document.objects)
    expect(shapes.some((shape) => shape.name === 'Bottom nav surface')).toBe(true)
    expect(shapes.some((shape) => shape.name === 'Top nav surface')).toBe(false)
    expect(shapes.some((shape) => shape.type === 'text' && shape.textContent === 'App target - mobile kit')).toBe(true)
  })

  it('apply operation reflows existing token-bound shapes without creating a new board', () => {
    executeOps([{ op: 'define-token', name: 'brand/primary', kind: 'color', value: '#111111' }])
    const id = addRect()
    executeOps([{ op: 'apply-token', ids: [id], prop: 'fill', token: 'brand/primary' }])
    const beforeCount = useCanvasShapeStore.getState().getAllShapeIds().length

    const r = executeOps([
      { op: 'design-system-template', operation: 'apply', seedColor: '#D4AF37' }
    ])

    expect(r.ok).toBe(true)
    expect(useCanvasShapeStore.getState().getAllShapeIds()).toHaveLength(beforeCount)
    expect((useCanvasShapeStore.getState().getShape(id) as CanvasShape).fills[0]).toEqual({
      type: 'solid',
      color: '#D4AF37',
      opacity: 1
    })
  })

  it('accepts validate as a direct design-system-template op for legacy canvas calls', () => {
    executeOps([{ op: 'define-token', name: 'brand/primary', kind: 'color', value: '#123456' }])
    executeOps([{ op: 'define-token', name: 'brand/secondary', kind: 'color', value: '#654321' }])
    const id = addRect()
    const outsideScope = addRect()
    useCanvasShapeStore.getState().updateShape(id, {
      name: 'Primary swatch',
      fills: [{ type: 'solid', color: '#123456', opacity: 1 }]
    })
    useCanvasShapeStore.getState().updateShape(outsideScope, {
      name: 'Secondary swatch',
      fills: [{ type: 'solid', color: '#654321', opacity: 1 }]
    })

    const r = executeOps([{ op: 'design-system-template', operation: 'validate', targetIds: [id] }])

    expect(r.ok).toBe(true)
    expect(r.affectedIds).toEqual([])
    expect(takeLastLintFindings()).toEqual([
      expect.objectContaining({ code: 'off-token-color', shapeId: id })
    ])
  })

  it('scopes standalone design-system lint ops to target ids', () => {
    executeOps([{ op: 'define-token', name: 'brand/primary', kind: 'color', value: '#123456' }])
    executeOps([{ op: 'define-token', name: 'brand/secondary', kind: 'color', value: '#654321' }])
    const id = addRect()
    const outsideScope = addRect()
    useCanvasShapeStore.getState().updateShape(id, {
      name: 'Primary swatch',
      fills: [{ type: 'solid', color: '#123456', opacity: 1 }]
    })
    useCanvasShapeStore.getState().updateShape(outsideScope, {
      name: 'Secondary swatch',
      fills: [{ type: 'solid', color: '#654321', opacity: 1 }]
    })

    const r = executeOps([{ op: 'lint-design-system', targetIds: [id] }])

    expect(r.ok).toBe(true)
    expect(takeLastLintFindings()).toEqual([
      expect.objectContaining({ code: 'off-token-color', shapeId: id })
    ])
  })
})

describe('apply-token', () => {
  it('binds a color token to a shape fill and records the binding', () => {
    executeOps([{ op: 'define-token', name: 'brand/primary', kind: 'color', value: '#3b82d8' }])
    const id = addRect()
    const r = executeOps([{ op: 'apply-token', ids: [id], prop: 'fill', token: 'brand/primary' }])
    expect(r.ok).toBe(true)
    const shape = useCanvasShapeStore.getState().getShape(id) as CanvasShape
    expect(shape.fills).toEqual([{ type: 'solid', color: '#3b82d8', opacity: 1 }])
    expect(shape.tokenBindings).toEqual({ fill: 'brand/primary' })
  })

  it('reports an unknown token with the available list as a suggestion', () => {
    executeOps([{ op: 'define-token', name: 'brand/primary', kind: 'color', value: '#111' }])
    const id = addRect()
    const r = executeOps([{ op: 'apply-token', ids: [id], prop: 'fill', token: 'nope' }])
    expect(r.ok).toBe(false)
    expect(r.errors[0].code).toBe('INVALID_OP')
    expect(r.errors[0].suggestion).toContain('brand/primary')
  })

  it('rejects a prop/kind mismatch (font needs a type token)', () => {
    executeOps([{ op: 'define-token', name: 'brand/primary', kind: 'color', value: '#111' }])
    const id = addRect()
    const r = executeOps([{ op: 'apply-token', ids: [id], prop: 'font', token: 'brand/primary' }])
    expect(r.ok).toBe(false)
    expect(r.errors[0].message).toContain('font')
  })
})

describe('redefining a token re-flows bound shapes', () => {
  it('updates every shape bound to the token in one batch', () => {
    executeOps([{ op: 'define-token', name: 'brand/primary', kind: 'color', value: '#111111' }])
    const a = addRect()
    const b = addRect()
    executeOps([{ op: 'apply-token', ids: [a, b], prop: 'fill', token: 'brand/primary' }])

    const r = executeOps([{ op: 'define-token', name: 'brand/primary', kind: 'color', value: '#222222' }])
    expect(r.ok).toBe(true)
    expect(r.affectedIds.sort()).toEqual([a, b].sort())
    const fillOf = (id: string) =>
      (useCanvasShapeStore.getState().getShape(id) as CanvasShape).fills[0]
    expect(fillOf(a)).toEqual({ type: 'solid', color: '#222222', opacity: 1 })
    expect(fillOf(b)).toEqual({ type: 'solid', color: '#222222', opacity: 1 })
  })
})

function getShape(id: string): CanvasShape | undefined {
  return useCanvasShapeStore.getState().getShape(id)
}

function buildCard(): string {
  const f = executeOps([
    { op: 'add', shape: { type: 'frame', name: 'Card', x: 0, y: 0, width: 200, height: 120 } }
  ])
  const frameId = f.affectedIds[0]
  executeOps([
    {
      op: 'add',
      shape: { type: 'text', name: 'title', x: 10, y: 10, width: 180, height: 24, textContent: 'Title' },
      parentId: frameId
    }
  ])
  return frameId
}

describe('define-component + instantiate', () => {
  it('registers a component and stamps an instance with overrides at a position', () => {
    const frameId = buildCard()
    const d = executeOps([
      { op: 'define-component', name: 'Card', fromId: frameId, slots: [{ path: 'title', kind: 'text' }] }
    ])
    expect(d.ok).toBe(true)
    const comp = useDesignSystemStore.getState().getComponent('Card')
    expect(comp?.version).toBe(1)
    expect(comp?.tree).toHaveLength(2)

    const r = executeOps([
      { op: 'instantiate', name: 'Card', at: { x: 500, y: 500 }, overrides: { title: 'Hello' } }
    ])
    expect(r.ok).toBe(true)
    const root = getShape(r.affectedIds[0]) as CanvasShape
    expect(root.componentId).toBe(comp?.id)
    expect(root.x).toBe(500)
    expect(root.y).toBe(500)
    const child = getShape(root.children[0]) as CanvasShape
    expect(child.textContent).toBe('Hello')
    // child kept its relative offset (10,10) → absolute (510,510)
    expect(child.x).toBe(510)
    expect(child.y).toBe(510)
  })

  it('reports an unknown component with the available list', () => {
    const r = executeOps([{ op: 'instantiate', name: 'Nope', at: { x: 0, y: 0 } }])
    expect(r.ok).toBe(false)
    expect(r.errors[0].code).toBe('INVALID_OP')
  })

  it('does not copy linked HTML artifact ids into component instances', () => {
    const frame = createHtmlFrameShape('Linked screen', 0, 0, 'artifact-login', 'mobile')
    useCanvasShapeStore.getState().addShape(frame)
    const frameId = frame.id
    executeOps([{ op: 'define-component', name: 'LinkedScreenCard', fromId: frameId, slots: [] }])

    const r = executeOps([{ op: 'instantiate', name: 'LinkedScreenCard', at: { x: 500, y: 0 } }])

    expect(r.ok).toBe(true)
    expect(getShape(frameId)?.htmlArtifactId).toBe('artifact-login')
    expect(getShape(r.affectedIds[0])?.htmlArtifactId).toBeUndefined()
  })
})

describe('instantiate-many', () => {
  it('stamps N instances on a grid, one data row each', () => {
    const frameId = buildCard()
    executeOps([
      { op: 'define-component', name: 'Card', fromId: frameId, slots: [{ path: 'title', kind: 'text' }] }
    ])
    const r = executeOps([
      {
        op: 'instantiate-many',
        name: 'Card',
        data: [{ title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' }],
        layout: { kind: 'grid', cols: 2, gap: 20 },
        at: { x: 0, y: 1000 }
      }
    ])
    expect(r.ok).toBe(true)
    expect(r.affectedIds).toHaveLength(4)
    const roots = r.affectedIds.map((id) => getShape(id) as CanvasShape)
    // itemW 200 + gap 20 = 220 step in x; itemH 120 + gap 20 = 140 step in y
    const xs = roots.map((s) => s.x).sort((a, b) => a - b)
    const ys = roots.map((s) => s.y).sort((a, b) => a - b)
    expect(xs).toEqual([0, 0, 220, 220])
    expect(ys).toEqual([1000, 1000, 1140, 1140])
    const titles = roots
      .map((root) => (getShape(root.children[0]) as CanvasShape).textContent)
      .sort()
    expect(titles).toEqual(['A', 'B', 'C', 'D'])
  })
})

describe('detach + update-component', () => {
  it('detach cuts the component link', () => {
    const frameId = buildCard()
    executeOps([{ op: 'define-component', name: 'Card', fromId: frameId, slots: [] }])
    const id = executeOps([{ op: 'instantiate', name: 'Card', at: { x: 0, y: 0 } }]).affectedIds[0]
    expect(getShape(id)?.componentId).toBeDefined()
    executeOps([{ op: 'detach', id }])
    expect(getShape(id)?.componentId).toBeUndefined()
  })

  it('update-component re-flows existing instances, preserving overrides', () => {
    const frameId = buildCard()
    executeOps([
      { op: 'define-component', name: 'Card', fromId: frameId, slots: [{ path: 'title', kind: 'text' }] }
    ])
    const i1 = executeOps([
      { op: 'instantiate', name: 'Card', at: { x: 0, y: 300 }, overrides: { title: 'A' } }
    ]).affectedIds[0]
    const i2 = executeOps([
      { op: 'instantiate', name: 'Card', at: { x: 0, y: 500 }, overrides: { title: 'B' } }
    ]).affectedIds[0]

    // Edit the master, then push it to the component.
    executeOps([{ op: 'update', id: frameId, patch: { width: 300 } }])
    const r = executeOps([{ op: 'update-component', name: 'Card', fromId: frameId }])
    expect(r.ok).toBe(true)

    // Old instance roots were replaced.
    expect(getShape(i1)).toBeUndefined()
    expect(getShape(i2)).toBeUndefined()
    const newRoots = r.affectedIds.map((id) => getShape(id)).filter(Boolean) as CanvasShape[]
    expect(newRoots).toHaveLength(2)
    for (const root of newRoots) {
      expect(root.width).toBe(300)
      expect(['A', 'B']).toContain((getShape(root.children[0]) as CanvasShape).textContent)
    }
    expect(useDesignSystemStore.getState().getComponent('Card')?.version).toBe(2)
  })
})

describe('resolveTokenPatch (pure)', () => {
  const shape = createDefaultShape('text', 0, 0)

  it('maps a type token onto font fields', () => {
    const patch = resolveTokenPatch(
      { name: 't', kind: 'type', value: { fontSize: 24, fontWeight: 700 } },
      'font',
      shape
    )
    expect(patch).toEqual({ fontSize: 24, fontWeight: 700 })
  })

  it('maps a radius token onto cornerRadius', () => {
    const patch = resolveTokenPatch({ name: 'r', kind: 'radius', value: 8 }, 'radius', shape)
    expect(patch).toEqual({ cornerRadius: 8 })
  })

  it('errors when a gap token has no layout target', () => {
    const patch = resolveTokenPatch({ name: 's', kind: 'space', value: 16 }, 'gap', shape)
    expect('error' in patch).toBe(true)
  })
})
