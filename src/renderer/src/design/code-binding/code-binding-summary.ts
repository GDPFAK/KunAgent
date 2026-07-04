import type { CanvasDocument } from '../canvas/canvas-types'
import type { DesignCodeBinding, DesignCodeBindingStatus } from './code-binding-types'

export type CanvasCodeBindingSnapshotEntry = {
  id: string
  designObjectId: string
  kind: DesignCodeBinding['kind']
  status: DesignCodeBindingStatus
  sourceFile?: string
  componentName?: string
  domId?: string
  onlookId?: string
  routePath?: string
  selected?: boolean
}

export type CanvasCodeBindingSnapshot = {
  count: number
  boundObjectCount: number
  staleCount: number
  missingCount: number
  entries: CanvasCodeBindingSnapshotEntry[]
  omitted?: number
}

function compactBinding(
  binding: DesignCodeBinding,
  selectedIds: ReadonlySet<string> | undefined
): CanvasCodeBindingSnapshotEntry {
  return {
    id: binding.id,
    designObjectId: binding.designObjectId,
    kind: binding.kind,
    status: binding.status,
    ...(binding.target.sourceFile ? { sourceFile: binding.target.sourceFile } : {}),
    ...(binding.target.componentName ? { componentName: binding.target.componentName } : {}),
    ...(binding.target.domId ? { domId: binding.target.domId } : {}),
    ...(binding.target.onlookId ? { onlookId: binding.target.onlookId } : {}),
    ...(binding.target.routePath ? { routePath: binding.target.routePath } : {}),
    ...(selectedIds?.has(binding.designObjectId) ? { selected: true } : {})
  }
}

function bindingPriority(
  binding: DesignCodeBinding,
  selectedIds: ReadonlySet<string> | undefined
): number {
  if (selectedIds?.has(binding.designObjectId)) return 0
  if (binding.status !== 'active') return 1
  return 2
}

export function summarizeCodeBindingsForSnapshot(
  doc: CanvasDocument,
  selectedIds?: ReadonlySet<string>,
  limit = 10
): CanvasCodeBindingSnapshot | undefined {
  const bindings = doc.codeBindings ?? []
  if (bindings.length === 0) return undefined
  const sorted = [...bindings].sort(
    (a, b) => bindingPriority(a, selectedIds) - bindingPriority(b, selectedIds) || a.id.localeCompare(b.id)
  )
  const entries = sorted.slice(0, Math.max(0, limit)).map((binding) => compactBinding(binding, selectedIds))
  return {
    count: bindings.length,
    boundObjectCount: new Set(bindings.map((binding) => binding.designObjectId)).size,
    staleCount: bindings.filter((binding) => binding.status === 'stale').length,
    missingCount: bindings.filter((binding) => binding.status === 'missing').length,
    entries,
    ...(bindings.length > entries.length ? { omitted: bindings.length - entries.length } : {})
  }
}

export function codeBindingsForObject(
  doc: CanvasDocument,
  designObjectId: string
): DesignCodeBinding[] {
  return (doc.codeBindings ?? []).filter((binding) => binding.designObjectId === designObjectId)
}
