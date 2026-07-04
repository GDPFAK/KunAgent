import type { CanvasDocument } from '../canvas/canvas-types'
import type { DesignCodeBinding, DesignCodeBindingKind, DesignCodeBindingTarget } from './code-binding-types'

export type DomSourceSnapshotNode = {
  id?: string
  tagName: string
  text?: string
  rect?: {
    left: number
    top: number
    width: number
    height: number
  }
  sourceFile?: string
  componentName?: string
  exportName?: string
  domId?: string
  onlookId?: string
  astPath?: string
  routePath?: string
  line?: number
  column?: number
  children?: DomSourceSnapshotNode[]
}

export type DomSourceSnapshot = {
  capturedAt: string
  routePath?: string
  sourceFile?: string
  nodes: DomSourceSnapshotNode[]
}

export type DomSourceBindingMatch = {
  designObjectId: string
  node: DomSourceSnapshotNode
}

export type DomSourceBindingOptions = {
  existingBindings?: readonly DesignCodeBinding[]
  matches: readonly DomSourceBindingMatch[]
  capturedAt?: string
  scopeDesignObjectIds?: readonly string[]
}

function stableBindingId(designObjectId: string, node: DomSourceSnapshotNode): string {
  const raw = [
    designObjectId,
    node.onlookId,
    node.domId,
    node.sourceFile,
    node.componentName,
    node.routePath,
    node.astPath
  ]
    .filter(Boolean)
    .join(':')
  return `binding_${raw.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 96)}`
}

function inferBindingKind(node: DomSourceSnapshotNode): DesignCodeBindingKind {
  if (node.onlookId || node.domId) return 'dom-node'
  if (node.componentName) return 'component'
  if (node.routePath) return 'route'
  if (node.sourceFile) return 'file'
  return 'generated-code'
}

function targetForNode(node: DomSourceSnapshotNode): DesignCodeBindingTarget {
  return {
    ...(node.sourceFile ? { sourceFile: node.sourceFile } : {}),
    ...(node.componentName ? { componentName: node.componentName } : {}),
    ...(node.exportName ? { exportName: node.exportName } : {}),
    ...(node.domId ? { domId: node.domId } : {}),
    ...(node.onlookId ? { onlookId: node.onlookId } : {}),
    ...(node.astPath ? { astPath: node.astPath } : {}),
    ...(node.routePath ? { routePath: node.routePath } : {}),
    ...(typeof node.line === 'number' ? { line: node.line } : {}),
    ...(typeof node.column === 'number' ? { column: node.column } : {})
  }
}

function bindingForMatch(
  match: DomSourceBindingMatch,
  existing: DesignCodeBinding | undefined,
  capturedAt: string
): DesignCodeBinding {
  const node = match.node
  return {
    id: existing?.id ?? stableBindingId(match.designObjectId, node),
    designObjectId: match.designObjectId,
    kind: inferBindingKind(node),
    target: targetForNode(node),
    status: 'active',
    createdAt: existing?.createdAt ?? capturedAt,
    updatedAt: capturedAt,
    metadata: {
      tagName: node.tagName.toLowerCase(),
      ...(node.text ? { text: node.text.slice(0, 240) } : {}),
      ...(node.rect ? { rect: node.rect } : {})
    }
  }
}

function sameBindingTarget(binding: DesignCodeBinding, match: DomSourceBindingMatch): boolean {
  const target = targetForNode(match.node)
  return (
    binding.designObjectId === match.designObjectId &&
    (Boolean(target.onlookId && binding.target.onlookId === target.onlookId) ||
      Boolean(target.domId && binding.target.domId === target.domId) ||
      Boolean(target.astPath && binding.target.astPath === target.astPath) ||
      Boolean(target.sourceFile && binding.target.sourceFile === target.sourceFile && target.componentName && binding.target.componentName === target.componentName))
  )
}

export function bindingsFromDomSourceSnapshot({
  existingBindings = [],
  matches,
  capturedAt = new Date().toISOString(),
  scopeDesignObjectIds
}: DomSourceBindingOptions): DesignCodeBinding[] {
  const nextById = new Map(existingBindings.map((binding) => [binding.id, binding]))
  const activeIds = new Set<string>()
  const scopeIds = scopeDesignObjectIds ? new Set(scopeDesignObjectIds) : null
  for (const match of matches) {
    const existing = existingBindings.find((binding) => sameBindingTarget(binding, match))
    const next = bindingForMatch(match, existing, capturedAt)
    nextById.set(next.id, next)
    activeIds.add(next.id)
  }
  for (const binding of nextById.values()) {
    const scoped = !scopeIds || scopeIds.has(binding.designObjectId)
    if (scoped && !activeIds.has(binding.id) && binding.status === 'active') {
      nextById.set(binding.id, { ...binding, status: 'stale', updatedAt: capturedAt })
    }
  }
  return [...nextById.values()]
}

export function applyDomSourceBindingsToCanvasDocument(
  doc: CanvasDocument,
  options: DomSourceBindingOptions
): CanvasDocument {
  return {
    ...doc,
    codeBindings: bindingsFromDomSourceSnapshot({
      ...options,
      existingBindings: options.existingBindings ?? doc.codeBindings ?? []
    })
  }
}
