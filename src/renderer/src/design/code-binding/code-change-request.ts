import type { Fill, Stroke } from '../canvas/canvas-types'
import type { ShapeOp } from '../canvas/shape-ops/schema'
import type { DesignOperation } from '../graph/design-graph-types'
import type { DesignCodeBinding } from './code-binding-types'

export type DesignCodeChangeRequestKind =
  | 'update-style'
  | 'edit-text'
  | 'update-layout'
  | 'remove-node'
  | 'bind-object'

export type DesignCodeChangeRequest = {
  id: string
  kind: DesignCodeChangeRequestKind
  designObjectId: string
  bindingId: string
  sourceFile?: string
  componentName?: string
  domId?: string
  onlookId?: string
  astPath?: string
  payload: Record<string, unknown>
}

export type DesignCodeChangePlan = {
  requests: DesignCodeChangeRequest[]
  skipped: Array<{ operationId: string; reason: string }>
}

function requestId(operation: DesignOperation, binding: DesignCodeBinding, kind: DesignCodeChangeRequestKind): string {
  return `${operation.id}:${binding.id}:${kind}`
}

function requestBase(
  operation: DesignOperation,
  binding: DesignCodeBinding,
  kind: DesignCodeChangeRequestKind,
  payload: Record<string, unknown>
): DesignCodeChangeRequest {
  return {
    id: requestId(operation, binding, kind),
    kind,
    designObjectId: binding.designObjectId,
    bindingId: binding.id,
    ...(binding.target.sourceFile ? { sourceFile: binding.target.sourceFile } : {}),
    ...(binding.target.componentName ? { componentName: binding.target.componentName } : {}),
    ...(binding.target.domId ? { domId: binding.target.domId } : {}),
    ...(binding.target.onlookId ? { onlookId: binding.target.onlookId } : {}),
    ...(binding.target.astPath ? { astPath: binding.target.astPath } : {}),
    payload
  }
}

function bindingsByObject(bindings: readonly DesignCodeBinding[]): Map<string, DesignCodeBinding[]> {
  const map = new Map<string, DesignCodeBinding[]>()
  for (const binding of bindings) {
    if (binding.status !== 'active') continue
    const list = map.get(binding.designObjectId) ?? []
    list.push(binding)
    map.set(binding.designObjectId, list)
  }
  return map
}

function isShapeOp(value: unknown): value is ShapeOp {
  return Boolean(value && typeof value === 'object' && 'op' in value)
}

function stylePayloadFromPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const key of ['fills', 'strokes', 'cornerRadius', 'opacity', 'fontColor', 'fontSize', 'fontFamily', 'fontWeight', 'textAlign', 'lineHeight']) {
    if (key in patch) payload[key] = patch[key]
  }
  return payload
}

function layoutPayloadFromPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const key of ['x', 'y', 'width', 'height', 'rotation', 'layout', 'constraints']) {
    if (key in patch) payload[key] = patch[key]
  }
  return payload
}

function stylePayloadFromStyle(style: {
  fills?: Fill[]
  strokes?: Stroke[]
  [key: string]: unknown
}): Record<string, unknown> {
  return { ...style }
}

function requestsForTarget(
  operation: DesignOperation,
  targetId: string,
  kind: DesignCodeChangeRequestKind,
  payload: Record<string, unknown>,
  bindingMap: Map<string, DesignCodeBinding[]>
): DesignCodeChangeRequest[] {
  return (bindingMap.get(targetId) ?? []).map((binding) => requestBase(operation, binding, kind, payload))
}

function requestsForShapeOp(
  operation: DesignOperation,
  op: ShapeOp,
  bindingMap: Map<string, DesignCodeBinding[]>
): DesignCodeChangeRequest[] {
  switch (op.op) {
    case 'update': {
      const patch = op.patch as Record<string, unknown>
      const requests: DesignCodeChangeRequest[] = []
      if (typeof patch.textContent === 'string') {
        requests.push(...requestsForTarget(operation, op.id, 'edit-text', { textContent: patch.textContent }, bindingMap))
      }
      const stylePayload = stylePayloadFromPatch(patch)
      if (Object.keys(stylePayload).length > 0) {
        requests.push(...requestsForTarget(operation, op.id, 'update-style', stylePayload, bindingMap))
      }
      const layoutPayload = layoutPayloadFromPatch(patch)
      if (Object.keys(layoutPayload).length > 0) {
        requests.push(...requestsForTarget(operation, op.id, 'update-layout', layoutPayload, bindingMap))
      }
      return requests
    }
    case 'set-style':
      return op.ids.flatMap((id) =>
        requestsForTarget(operation, id, 'update-style', stylePayloadFromStyle(op.style), bindingMap)
      )
    case 'move':
      return op.ids.flatMap((id) =>
        requestsForTarget(operation, id, 'update-layout', { dx: op.dx, dy: op.dy }, bindingMap)
      )
    case 'resize':
      return requestsForTarget(operation, op.id, 'update-layout', { bounds: op.bounds }, bindingMap)
    case 'delete':
      return requestsForTarget(operation, op.id, 'remove-node', {}, bindingMap)
    default:
      return []
  }
}

export function designOperationsToCodeChangePlan(
  operations: readonly DesignOperation[],
  bindings: readonly DesignCodeBinding[]
): DesignCodeChangePlan {
  const bindingMap = bindingsByObject(bindings)
  const requests: DesignCodeChangeRequest[] = []
  const skipped: DesignCodeChangePlan['skipped'] = []
  for (const operation of operations) {
    if (!isShapeOp(operation.payload)) {
      skipped.push({ operationId: operation.id, reason: 'Operation payload is not a shape op.' })
      continue
    }
    const next = requestsForShapeOp(operation, operation.payload, bindingMap)
    if (next.length === 0) {
      skipped.push({ operationId: operation.id, reason: 'No active code binding for operation targets.' })
      continue
    }
    requests.push(...next)
  }
  return { requests, skipped }
}
