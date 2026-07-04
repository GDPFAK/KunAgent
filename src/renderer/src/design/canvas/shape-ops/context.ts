import { z } from 'zod'
import type { AutoLayout, CanvasShape, Point, Rect, ShapeType } from '../canvas-types'
import {
  createHtmlFrameShape,
  createShapeId,
  isHtmlFrame,
  shapeBounds,
  type DevicePreset
} from '../canvas-types'
import { collectDescendants, useCanvasShapeStore, withDescendants } from '../canvas-shape-store'
import { computeAutoLayout, defaultAutoLayout } from '../canvas-auto-layout'
import { constrainedBox } from '../canvas-constraints'
import { useDesignSystemStore } from '../design-system-store'
import { resolveTokenPatch, type DesignToken, type TokenProp } from '../design-system-types'
import type { ComponentDef, ComponentOverrides, ComponentSlot } from '../design-system-types'
import { defaultDevicePresetForDesignTarget } from '../../design-context'
import { useDesignWorkspaceStore } from '../../design-workspace-store'
import { GradientFillSchema, PartialAutoLayoutSchema, ShadowSchema, TextStyleSpecSchema } from './schema'

export function findShape(id: string): CanvasShape | null {
  return useCanvasShapeStore.getState().document.objects[id] ?? null
}

export function htmlFramePatchChangesSize(patch: Partial<CanvasShape>): boolean {
  return typeof patch.width === 'number' || typeof patch.height === 'number'
}

export function promoteHtmlFrameToManualNode(shapeId: string): void {
  const shape = useCanvasShapeStore.getState().document.objects[shapeId]
  if (!shape || !isHtmlFrame(shape) || !shape.htmlArtifactId) return
  const designStore = useDesignWorkspaceStore.getState()
  const artifact = designStore.artifacts.find((item) => item.id === shape.htmlArtifactId)
  if (!artifact || artifact.kind !== 'html') return
  designStore.updateArtifactNode(shape.htmlArtifactId, {
    x: Math.round(shape.x),
    y: Math.round(shape.y),
    width: Math.round(shape.width),
    height: Math.round(shape.height),
    sizeMode: 'manual',
    boardHidden: false,
    viewMode: artifact.node?.viewMode ?? 'preview'
  })
}

export function listShapeIds(): string[] {
  const { objects, rootId } = useCanvasShapeStore.getState().document
  return Object.keys(objects).filter((id) => id !== rootId)
}

export function suggestionForMissingId(missing: string): string {
  const ids = listShapeIds()
  const doc = useCanvasShapeStore.getState().document
  const names = ids.map((id) => `"${doc.objects[id].name}" (${id})`).slice(0, 10)
  return `Available shapes: ${names.join(', ')}`
}

export const LINEAR_TYPES = new Set<ShapeType>(['arrow', 'line', 'draw'])

/**
 * Ops supply linear `points` in ABSOLUTE canvas coords (natural for the AI).
 * Convert them to the stored form: bounding box in x/y/width/height + points
 * relative to that box (matching how the drawing tools persist).
 */
export function bboxRelative(pts: Point[]): {
  x: number
  y: number
  width: number
  height: number
  points: Point[]
} {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    points: pts.map((p) => ({ x: p.x - minX, y: p.y - minY }))
  }
}

/**
 * Re-run auto-layout for a frame/group and write the children's new positions.
 * No-op when the shape has no layout. Called after structural edits (add /
 * reparent / delete / resize) so a laid-out container stays tidy automatically.
 */
export function reflowFrame(frameId: string, affectedIds: Set<string>): void {
  const store = useCanvasShapeStore.getState()
  const objects = store.document.objects
  const frame = objects[frameId]
  if (!frame?.layout) return
  const positions = computeAutoLayout(objects, frameId)
  for (const pos of positions) {
    const child = store.document.objects[pos.id]
    if (!child) continue
    if (child.x !== pos.x || child.y !== pos.y) {
      // Children may themselves carry descendants (absolute coords) — shift the
      // whole subtree by the delta so nested content tracks the laid-out child.
      const dx = pos.x - child.x
      const dy = pos.y - child.y
      const objs = store.document.objects
      for (const id of withDescendants(objs, [pos.id])) {
        const s = objs[id]
        if (s) store.updateShape(id, { x: s.x + dx, y: s.y + dy })
      }
      affectedIds.add(pos.id)
    }
  }
}

/** Whether a shape exists and carries an auto-layout. */
export function objectHasLayout(id: string): boolean {
  return Boolean(useCanvasShapeStore.getState().document.objects[id]?.layout)
}

/**
 * Reposition/resize the direct children of a just-resized frame per their
 * `constraints`. Children that have no constraints stick to top-left (the engine
 * default). A child's descendants are shifted by the same positional delta so
 * nested content tracks its constrained parent.
 */
export function applyConstraintsOnResize(
  frameId: string,
  oldBounds: Rect,
  newBounds: Rect,
  affectedIds: Set<string>
): void {
  const store = useCanvasShapeStore.getState()
  const frame = store.document.objects[frameId]
  if (!frame) return
  for (const childId of [...frame.children]) {
    const child = store.document.objects[childId]
    if (!child) continue
    // Only act on children that opted into constraints — leave plain children put.
    if (!child.constraints) continue
    const box = constrainedBox(child, oldBounds, newBounds)
    const dx = box.x - child.x
    const dy = box.y - child.y
    store.updateShape(childId, { x: box.x, y: box.y, width: box.width, height: box.height })
    affectedIds.add(childId)
    if (dx !== 0 || dy !== 0) {
      const objs = store.document.objects
      for (const descId of withDescendants(objs, [childId])) {
        if (descId === childId) continue
        const d = objs[descId]
        if (d) store.updateShape(descId, { x: d.x + dx, y: d.y + dy })
      }
    }
  }
}

type PartialAutoLayout = z.infer<typeof PartialAutoLayoutSchema>

/**
 * Merge a loose layout spec over the frame's existing layout (or defaults).
 * The `padding` shorthand sets all four sides; explicit per-side values win.
 */
export function mergeAutoLayout(existing: AutoLayout | undefined, partial?: PartialAutoLayout): AutoLayout {
  const base = existing ?? defaultAutoLayout()
  const pad = partial?.padding
  return {
    direction: partial?.direction ?? base.direction,
    gap: partial?.gap ?? base.gap,
    paddingTop: partial?.paddingTop ?? pad ?? base.paddingTop,
    paddingRight: partial?.paddingRight ?? pad ?? base.paddingRight,
    paddingBottom: partial?.paddingBottom ?? pad ?? base.paddingBottom,
    paddingLeft: partial?.paddingLeft ?? pad ?? base.paddingLeft,
    primaryAlign: partial?.primaryAlign ?? base.primaryAlign,
    counterAlign: partial?.counterAlign ?? base.counterAlign
  }
}

/** Validate a `define-token` value against its `kind`, returning a typed token or an error. */
export function validateTokenValue(
  name: string,
  kind: DesignToken['kind'],
  value: unknown
): { token: DesignToken } | { error: string } {
  switch (kind) {
    case 'color':
      if (typeof value !== 'string' || !value.trim())
        return { error: `token "${name}" (color) needs a non-empty color string (e.g. "#3b82d8")` }
      return { token: { name, kind, value } }
    case 'space':
    case 'radius':
      if (typeof value !== 'number' || !Number.isFinite(value))
        return { error: `token "${name}" (${kind}) needs a finite number` }
      return { token: { name, kind, value } as DesignToken }
    case 'gradient': {
      const r = GradientFillSchema.safeParse(value)
      if (!r.success)
        return { error: `token "${name}" (gradient) invalid: ${r.error.issues[0]?.message ?? 'bad value'}` }
      return { token: { name, kind, value: r.data } }
    }
    case 'shadow': {
      const r = z.array(ShadowSchema).safeParse(value)
      if (!r.success)
        return { error: `token "${name}" (shadow) invalid: ${r.error.issues[0]?.message ?? 'bad value'}` }
      return { token: { name, kind, value: r.data } }
    }
    case 'type': {
      const r = TextStyleSpecSchema.safeParse(value)
      if (!r.success)
        return { error: `token "${name}" (type) invalid: ${r.error.issues[0]?.message ?? 'bad value'}` }
      return { token: { name, kind, value: r.data } }
    }
  }
}

/**
 * Snapshot a shape subtree into a component template: clone root + descendants
 * and normalize coordinates so the root sits at (0,0) (children keep their
 * relative offset). Internal id references stay consistent within the subtree;
 * `materializeComponentInstance` remaps them to fresh ids per instance.
 */
export function snapshotSubtreeAsTree(rootId: string): CanvasShape[] {
  const objects = useCanvasShapeStore.getState().document.objects
  const ids = [rootId, ...collectDescendants(objects, rootId)]
  const root = objects[rootId]
  const ox = root.x
  const oy = root.y
  return ids.map((id) => {
    const s = objects[id]
    return { ...s, x: s.x - ox, y: s.y - oy }
  })
}

/** Apply a per-instance slot override to a freshly cloned node (matched by name). */
function applyOverridesToClone(
  clone: CanvasShape,
  nodeName: string,
  slots: ComponentSlot[],
  overrides: ComponentOverrides
): void {
  for (const slot of slots) {
    if (slot.path !== nodeName) continue
    const value = overrides[slot.path]
    if (value === undefined) continue
    switch (slot.kind) {
      case 'text':
        clone.textContent = String(value)
        break
      case 'image':
        clone.imageUrl = String(value)
        break
      case 'color':
        clone.fills = [{ type: 'solid', color: String(value), opacity: 1 }]
        break
      case 'visible':
        clone.visible = Boolean(value)
        break
    }
  }
}

/**
 * Materialize one component instance onto the canvas: deep-clone the template
 * tree with fresh ids, translate it to `at`, apply slot overrides, and add the
 * subtree under `parentId` (root tagged with componentId/version/overrides so
 * `update-component`/`detach` can find it). Returns the new root id.
 */
export function materializeComponentInstance(
  comp: ComponentDef,
  at: Point,
  parentId: string,
  overrides: ComponentOverrides
): string {
  const store = useCanvasShapeStore.getState()
  const byId = new Map(comp.tree.map((s) => [s.id, s]))

  function addNode(node: CanvasShape, targetParent: string, isRoot: boolean): string {
    const newId = createShapeId()
    const clone: CanvasShape = {
      ...node,
      id: newId,
      x: node.x + at.x,
      y: node.y + at.y,
      children: [],
      parentId: null,
      frameId: null,
      componentId: isRoot ? comp.id : undefined,
      componentVersion: isRoot ? comp.version : undefined,
      overrides: isRoot ? overrides : undefined
    }
    delete clone.htmlArtifactId
    applyOverridesToClone(clone, node.name, comp.slots, overrides)
    store.addShape(clone, targetParent)
    for (const childId of node.children) {
      const child = byId.get(childId)
      if (child) addNode(child, newId, false)
    }
    return newId
  }

  return addNode(comp.tree[0], parentId, true)
}

export const DEVICE_DIMS: Record<DevicePreset, { width: number; height: number }> = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 }
}

export function defaultScreenDevicePreset(): DevicePreset {
  return defaultDevicePresetForDesignTarget(
    useDesignWorkspaceStore.getState().designContext.designTarget
  ) as DevicePreset
}

export function createScreenLikeShape(
  name: string,
  x: number,
  y: number,
  preset: DevicePreset,
  artifactId: string | null
): CanvasShape {
  const shape = createHtmlFrameShape(name, x, y, artifactId ?? '__plain_frame__', preset)
  if (!artifactId) delete shape.htmlArtifactId
  return shape
}

export function htmlFrameRects(): Rect[] {
  const doc = useCanvasShapeStore.getState().document
  return Object.values(doc.objects)
    .filter((shape): shape is CanvasShape => Boolean(shape) && shape.visible !== false && isHtmlFrame(shape))
    .map(shapeBounds)
}

/** Deep-clone a LIVE subtree (root + descendants) to a translated position under `parentId`. */
export function cloneLiveSubtree(rootId: string, dx: number, dy: number, parentId: string): string {
  const store = useCanvasShapeStore.getState()
  const objects = store.document.objects
  function addNode(node: CanvasShape, targetParent: string): string {
    const newId = createShapeId()
    const clone: CanvasShape = {
      ...node,
      id: newId,
      x: node.x + dx,
      y: node.y + dy,
      children: [],
      parentId: null,
      frameId: null
    }
    delete clone.htmlArtifactId
    store.addShape(clone, targetParent)
    for (const childId of node.children) {
      const child = objects[childId]
      if (child) addNode(child, newId)
    }
    return newId
  }
  return addNode(objects[rootId], parentId)
}

/** Rebind a subtree's token bindings via `remap` (oldToken → newToken) and re-resolve them. */
export function rebindThemeOnSubtree(
  rootId: string,
  remap: Record<string, string>,
  affectedIds: Set<string>
): void {
  const store = useCanvasShapeStore.getState()
  const objects = store.document.objects
  const ds = useDesignSystemStore.getState()
  for (const id of [rootId, ...collectDescendants(objects, rootId)]) {
    const shape = objects[id]
    if (!shape?.tokenBindings) continue
    const newBindings = { ...shape.tokenBindings }
    const patchAcc: Partial<CanvasShape> = {}
    let changed = false
    for (const [prop, tokenName] of Object.entries(shape.tokenBindings)) {
      const newToken = remap[tokenName]
      if (!newToken) continue
      const token = ds.getToken(newToken)
      if (!token) continue
      const patch = resolveTokenPatch(token, prop as TokenProp, shape)
      if (!('error' in patch)) {
        Object.assign(patchAcc, patch)
        newBindings[prop] = newToken
        changed = true
      }
    }
    if (changed) {
      store.updateShape(id, { ...patchAcc, tokenBindings: newBindings })
      affectedIds.add(id)
    }
  }
}

/** Swap exact solid-fill / fontColor hex values across a subtree per `mapping` (oldHex → newHex). */
export function recolorSubtree(
  rootId: string,
  mapping: Record<string, string>,
  affectedIds: Set<string>
): void {
  const store = useCanvasShapeStore.getState()
  const objects = store.document.objects
  for (const id of [rootId, ...collectDescendants(objects, rootId)]) {
    const shape = objects[id]
    if (!shape) continue
    const patch: Partial<CanvasShape> = {}
    let changed = false
    if (shape.fills.some((f) => f.type === 'solid' && mapping[f.color])) {
      patch.fills = shape.fills.map((f) =>
        f.type === 'solid' && mapping[f.color] ? { ...f, color: mapping[f.color] } : f
      )
      changed = true
    }
    if (shape.fontColor && mapping[shape.fontColor]) {
      patch.fontColor = mapping[shape.fontColor]
      changed = true
    }
    if (changed) {
      store.updateShape(id, patch)
      affectedIds.add(id)
    }
  }
}

/** Resize a frame to a device preset and re-apply child constraints / auto-layout. */
export function responsiveReflowFrame(
  frameId: string,
  device: DevicePreset,
  affectedIds: Set<string>
): void {
  const store = useCanvasShapeStore.getState()
  const frame = store.document.objects[frameId]
  if (!frame) return
  const dims = DEVICE_DIMS[device]
  const oldBounds = { x: frame.x, y: frame.y, width: frame.width, height: frame.height }
  const newBounds = { x: frame.x, y: frame.y, width: dims.width, height: dims.height }
  store.updateShape(frameId, { width: dims.width, height: dims.height, devicePreset: device })
  applyConstraintsOnResize(frameId, oldBounds, newBounds, affectedIds)
  if (frame.layout) reflowFrame(frameId, affectedIds)
  affectedIds.add(frameId)
}
