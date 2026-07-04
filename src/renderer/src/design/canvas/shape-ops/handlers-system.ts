import type { ComponentDef, ComponentOverrides, TokenProp } from '../design-system-types'
import { resolveTokenPatch } from '../design-system-types'
import { createShapeId } from '../canvas-types'
import { useCanvasShapeStore } from '../canvas-shape-store'
import { useDesignSystemStore } from '../design-system-store'
import type { OpError, ShapeOp } from './schema'
import {
  findShape,
  listShapeIds,
  materializeComponentInstance,
  snapshotSubtreeAsTree,
  suggestionForMissingId,
  validateTokenValue
} from './context'

export function executeDesignSystemShapeOp(
  op: ShapeOp,
  affectedIds: Set<string>,
  errors: OpError[]
): boolean {
  const store = useCanvasShapeStore.getState()
  switch (op.op) {
    case 'define-token': {
      const validated = validateTokenValue(op.name, op.kind, op.value)
      if ('error' in validated) {
        errors.push({ code: 'INVALID_OP', message: validated.error })
        return true
      }
      const ds = useDesignSystemStore.getState()
      const existed = Boolean(ds.getToken(op.name))
      ds.setToken(validated.token)
      // Editing an existing token re-resolves every shape bound to it, so a
      // single palette change ripples through the whole design (one undo batch).
      if (existed) {
        for (const id of listShapeIds()) {
          const shape = findShape(id)
          if (!shape?.tokenBindings) continue
          for (const [boundProp, boundToken] of Object.entries(shape.tokenBindings)) {
            if (boundToken !== op.name) continue
            const patch = resolveTokenPatch(validated.token, boundProp as TokenProp, shape)
            if (!('error' in patch)) {
              store.updateShape(id, patch)
              affectedIds.add(id)
            }
          }
        }
      }
      break
    }
    case 'apply-token': {
      const ds = useDesignSystemStore.getState()
      const token = ds.getToken(op.token)
      if (!token) {
        const names = ds.listTokens().map((t) => t.name).slice(0, 20)
        errors.push({
          code: 'INVALID_OP',
          message: `Unknown token "${op.token}"`,
          suggestion: names.length
            ? `Available tokens: ${names.join(', ')}`
            : 'No tokens defined yet — call define-token first.'
        })
        break
      }
      for (const id of op.ids) {
        const shape = findShape(id)
        if (!shape) {
          errors.push({
            code: 'SHAPE_NOT_FOUND',
            message: `No shape with id "${id}"`,
            suggestion: suggestionForMissingId(id)
          })
          continue
        }
        const patch = resolveTokenPatch(token, op.prop, shape)
        if ('error' in patch) {
          errors.push({ code: 'INVALID_OP', message: patch.error })
          continue
        }
        const tokenBindings = { ...(shape.tokenBindings ?? {}), [op.prop]: op.token }
        store.updateShape(id, { ...patch, tokenBindings })
        affectedIds.add(id)
      }
      break
    }
    case 'define-component': {
      const root = findShape(op.fromId)
      if (!root) {
        errors.push({
          code: 'SHAPE_NOT_FOUND',
          message: `No shape with id "${op.fromId}" to define component "${op.name}" from`,
          suggestion: suggestionForMissingId(op.fromId)
        })
        return true
      }
      const ds = useDesignSystemStore.getState()
      const existing = ds.getComponent(op.name)
      ds.setComponent({
        id: existing?.id ?? createShapeId(),
        name: op.name,
        version: (existing?.version ?? 0) + 1,
        tree: snapshotSubtreeAsTree(op.fromId),
        slots: op.slots
      })
      // Defining a component does not mutate the canvas; nothing affected.
      break
    }
    case 'instantiate': {
      const ds = useDesignSystemStore.getState()
      const comp = ds.getComponent(op.name)
      if (!comp) {
        const names = ds.listComponents().map((c) => c.name).slice(0, 20)
        errors.push({
          code: 'INVALID_OP',
          message: `Unknown component "${op.name}"`,
          suggestion: names.length
            ? `Available components: ${names.join(', ')}`
            : 'No components defined yet — call define-component first.'
        })
        break
      }
      if (op.parentId && !findShape(op.parentId)) {
        errors.push({
          code: 'PARENT_NOT_FOUND',
          message: `No parent with id "${op.parentId}"`,
          suggestion: suggestionForMissingId(op.parentId)
        })
        break
      }
      const parentId = op.parentId ?? store.document.rootId
      const at = op.at ?? { x: 0, y: 0 }
      affectedIds.add(materializeComponentInstance(comp, at, parentId, op.overrides ?? {}))
      break
    }
    case 'instantiate-many': {
      const ds = useDesignSystemStore.getState()
      const comp = ds.getComponent(op.name)
      if (!comp) {
        const names = ds.listComponents().map((c) => c.name).slice(0, 20)
        errors.push({
          code: 'INVALID_OP',
          message: `Unknown component "${op.name}"`,
          suggestion: names.length
            ? `Available components: ${names.join(', ')}`
            : 'No components defined yet — call define-component first.'
        })
        break
      }
      if (op.parentId && !findShape(op.parentId)) {
        errors.push({
          code: 'PARENT_NOT_FOUND',
          message: `No parent with id "${op.parentId}"`,
          suggestion: suggestionForMissingId(op.parentId)
        })
        break
      }
      const parentId = op.parentId ?? store.document.rootId
      const tpl = comp.tree[0]
      const itemW = tpl.width
      const itemH = tpl.height
      const gap = op.layout?.gap ?? 16
      const kind = op.layout?.kind ?? 'grid'
      const n = op.data.length
      const cols =
        kind === 'row'
          ? n
          : kind === 'column'
            ? 1
            : op.layout?.cols ?? Math.max(1, Math.ceil(Math.sqrt(n)))
      const at = op.at ?? { x: 0, y: 0 }
      for (let i = 0; i < n; i++) {
        const col = i % cols
        const row = Math.floor(i / cols)
        const cellAt = { x: at.x + col * (itemW + gap), y: at.y + row * (itemH + gap) }
        affectedIds.add(materializeComponentInstance(comp, cellAt, parentId, op.data[i]))
      }
      break
    }
    case 'detach': {
      const shape = findShape(op.id)
      if (!shape) {
        errors.push({
          code: 'SHAPE_NOT_FOUND',
          message: `No shape with id "${op.id}"`,
          suggestion: suggestionForMissingId(op.id)
        })
        return true
      }
      store.updateShape(op.id, {
        componentId: undefined,
        componentVersion: undefined,
        overrides: undefined
      })
      affectedIds.add(op.id)
      break
    }
    case 'update-component': {
      const ds = useDesignSystemStore.getState()
      const comp = ds.getComponent(op.name)
      if (!comp) {
        errors.push({ code: 'INVALID_OP', message: `Unknown component "${op.name}"` })
        break
      }
      if (!findShape(op.fromId)) {
        errors.push({
          code: 'SHAPE_NOT_FOUND',
          message: `No shape with id "${op.fromId}" to update component "${op.name}" from`,
          suggestion: suggestionForMissingId(op.fromId)
        })
        return true
      }
      const updated: ComponentDef = {
        ...comp,
        version: comp.version + 1,
        tree: snapshotSubtreeAsTree(op.fromId)
      }
      ds.setComponent(updated)
      // Re-materialize every other instance, preserving its position + overrides,
      // so a master edit ripples through the design (the fromId master stays put).
      const objects = useCanvasShapeStore.getState().document.objects
      const instances = Object.values(objects).filter(
        (s) => s.componentId === comp.id && s.id !== op.fromId
      )
      for (const inst of instances) {
        const at = { x: inst.x, y: inst.y }
        const parentId = inst.parentId ?? store.document.rootId
        const overrides = (inst.overrides as ComponentOverrides | undefined) ?? {}
        store.deleteShape(inst.id)
        affectedIds.add(materializeComponentInstance(updated, at, parentId, overrides))
      }
      break
    }
    default:
      return false
  }
  return true
}
