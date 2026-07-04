import { summarizeAgentNotes } from '../agent-notes/agent-note-shapes'
import type { CanvasDocument } from '../canvas/canvas-types'
import { lintDesignSystem } from '../canvas/design-lint'
import type { DesignSystem } from '../canvas/design-system-types'
import {
  executeDesignToolInvocation,
  type DesignToolInvocationResult
} from '../tool-protocol/design-tool-protocol'

export type DesignToolRunActionId =
  | 'plan-next'
  | 'critique-current'
  | 'repair-current'
  | 'validate-system'
  | 'export-package'

export type DesignToolRunAction = {
  id: DesignToolRunActionId
  labelKey: string
  detailKey: string
  toolId: string
  toolInputSeed: Record<string, unknown>
  disabledReasonKey?: string
}

export type DesignToolRunPanelModel = {
  actions: DesignToolRunAction[]
  objectCount: number
  selectedCount: number
  lintFindingCount: number
  unresolvedNoteCount: number
  journalEntryCount: number
}

export type BuildDesignToolRunPanelModelInput = {
  doc: CanvasDocument
  designSystem: DesignSystem
  selectedIds: ReadonlySet<string>
  title?: string
}

function objectCount(doc: CanvasDocument): number {
  return Object.keys(doc.objects).filter((id) => id !== doc.rootId).length
}

function selectedScope(doc: CanvasDocument, selectedIds: ReadonlySet<string>): string[] {
  return [...selectedIds].filter((id) => Boolean(doc.objects[id]) && id !== doc.rootId)
}

function disabledAction(
  action: Omit<DesignToolRunAction, 'disabledReasonKey'>,
  disabledReasonKey?: string
): DesignToolRunAction {
  return disabledReasonKey ? { ...action, disabledReasonKey } : action
}

function scopeInput(scopeIds: readonly string[]): Record<string, unknown> {
  return scopeIds.length > 0 ? { scopeIds, targetIds: scopeIds } : {}
}

export function buildDesignToolRunPanelModel({
  doc,
  designSystem,
  selectedIds,
  title
}: BuildDesignToolRunPanelModelInput): DesignToolRunPanelModel {
  const objects = objectCount(doc)
  const scopeIds = selectedScope(doc, selectedIds)
  const scope = scopeInput(scopeIds)
  const lintFindings = lintDesignSystem(doc, designSystem, scopeIds.length > 0 ? { scopeIds } : undefined)
  const unresolvedNoteCount = summarizeAgentNotes(doc, 1000).filter((note) => !note.resolved).length
  const needsContent = objects > 0 ? undefined : 'designToolsNeedsContent'
  return {
    objectCount: objects,
    selectedCount: scopeIds.length,
    lintFindingCount: lintFindings.length,
    unresolvedNoteCount,
    journalEntryCount: doc.operationJournal?.length ?? 0,
    actions: [
      {
        id: 'plan-next',
        labelKey: 'designToolsPlan',
        detailKey: 'designToolsPlanDetail',
        toolId: 'design.plan',
        toolInputSeed: {
          goal: 'Plan the next design-mode tool sequence from the current Design Graph.',
          focus: 'design-tools-panel'
        }
      },
      disabledAction({
        id: 'critique-current',
        labelKey: 'designToolsCritique',
        detailKey: 'designToolsCritiqueDetail',
        toolId: 'design.critique',
        toolInputSeed: {
          ...scope,
          attachNotes: true,
          maxFindings: 8
        }
      }, needsContent),
      disabledAction({
        id: 'repair-current',
        labelKey: 'designToolsRepair',
        detailKey: 'designToolsRepairDetail',
        toolId: 'design.repair',
        toolInputSeed: {
          ...scope,
          maxFindings: 8
        }
      }, lintFindings.length > 0 ? undefined : 'designToolsNeedsFindings'),
      disabledAction({
        id: 'validate-system',
        labelKey: 'designToolsValidateSystem',
        detailKey: 'designToolsValidateSystemDetail',
        toolId: 'design.system',
        toolInputSeed: {
          ...scope,
          action: 'validate'
        }
      }, needsContent),
      disabledAction({
        id: 'export-package',
        labelKey: 'designToolsExportPackage',
        detailKey: 'designToolsExportPackageDetail',
        toolId: 'design.export',
        toolInputSeed: {
          format: 'package',
          ...(title ? { title } : {})
        }
      }, needsContent)
    ]
  }
}

export function runDesignToolPanelAction(action: DesignToolRunAction): DesignToolInvocationResult {
  return executeDesignToolInvocation({
    toolId: action.toolId,
    label: action.id,
    input: action.toolInputSeed
  })
}
