import type { ShapeOp } from '../canvas/shape-ops/schema'
import type {
  DesignOperation,
  DesignOperationJournalEntry,
  DesignOperationType
} from './design-graph-types'

const MAX_JOURNAL_ENTRIES = 500

let journalEntries: DesignOperationJournalEntry[] = []
let operationCounter = 0

function nextOperationId(prefix: string): string {
  operationCounter += 1
  return `${prefix}_${Date.now().toString(36)}_${operationCounter.toString(36)}`
}

function targetIdsForShapeOp(op: ShapeOp): string[] {
  switch (op.op) {
    case 'add':
      return []
    case 'update':
    case 'delete':
    case 'resize':
    case 'reparent':
    case 'reorder':
    case 'ungroup':
    case 'detach':
    case 'grid':
      return [op.id]
    case 'move':
    case 'align':
    case 'distribute':
    case 'set-style':
    case 'apply-token':
    case 'stack':
    case 'apply-theme':
    case 'recolor':
      return op.ids
    case 'group':
      return op.ids
    case 'define-component':
    case 'update-component':
      return [op.fromId]
    case 'instantiate':
    case 'instantiate-many':
    case 'add-screen':
    case 'add-screens':
    case 'variant-matrix':
    case 'design-system-template':
    case 'lint-design-system':
      return []
    case 'bulk-edit':
      return []
    case 'auto-layout':
      return [op.id]
    case 'responsive-reflow':
      return [op.frameId]
    default:
      return []
  }
}

function operationTypeForShapeOp(op: ShapeOp): DesignOperationType {
  switch (op.op) {
    case 'add':
      return op.shape.type === 'frame' ? 'create_frame' : 'create_shape'
    case 'add-screen':
    case 'add-screens':
      return 'generate_screen'
    case 'update':
    case 'set-style':
    case 'auto-layout':
    case 'bulk-edit':
    case 'apply-theme':
    case 'recolor':
    case 'responsive-reflow':
      return 'update_shape'
    case 'delete':
      return 'delete_shape'
    case 'move':
      return 'move_shape'
    case 'resize':
      return 'resize_shape'
    case 'align':
    case 'distribute':
    case 'reorder':
    case 'grid':
    case 'stack':
      return 'arrange_shapes'
    case 'group':
    case 'ungroup':
      return 'group_shapes'
    case 'define-token':
      return 'define_token'
    case 'apply-token':
      return 'apply_token'
    case 'define-component':
    case 'update-component':
      return 'define_component'
    case 'instantiate':
    case 'instantiate-many':
    case 'variant-matrix':
      return 'instantiate_component'
    case 'lint-design-system':
      return 'lint_design'
    default:
      return 'legacy_shape_op'
  }
}

export function shapeOpToDesignOperation(op: ShapeOp, label: string): DesignOperation {
  return {
    id: nextOperationId('dop'),
    type: operationTypeForShapeOp(op),
    label,
    source: 'agent',
    createdAt: new Date().toISOString(),
    targetIds: targetIdsForShapeOp(op),
    payload: op
  }
}

export function appendDesignOperationJournalEntry(
  entry: Omit<DesignOperationJournalEntry, 'id' | 'createdAt'>
): DesignOperationJournalEntry {
  const nextEntry: DesignOperationJournalEntry = {
    ...entry,
    id: nextOperationId('journal'),
    createdAt: new Date().toISOString()
  }
  journalEntries = [...journalEntries, nextEntry].slice(-MAX_JOURNAL_ENTRIES)
  return nextEntry
}

export function readDesignOperationJournal(): DesignOperationJournalEntry[] {
  return journalEntries
}

export function clearDesignOperationJournal(): void {
  journalEntries = []
}
