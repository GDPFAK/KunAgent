import type { CanvasDocument } from '../canvas/canvas-types'
import type { DesignContext } from '../design-context'
import type { DesignSystem } from '../canvas/design-system-types'
import type { DesignDocument } from '../design-types'
import {
  summarizeDesignProjectContract,
  type DesignProjectContractSummary
} from './design-project-contract'
import {
  buildDesignContractToolAction,
  type DesignContractToolAction
} from './design-contract-tool-action'

export type DesignContractDisabledReason = 'no-workspace' | 'no-document'

export type DesignContractViewModel = DesignProjectContractSummary & {
  visible: boolean
  canExport: boolean
  toolAction: DesignContractToolAction
  disabledReason?: DesignContractDisabledReason
}

export type BuildDesignContractViewModelOptions = {
  workspaceRoot: string
  document: DesignDocument | null
  canvasDocument: CanvasDocument
  designSystem: DesignSystem
  designContext: DesignContext
}

export function buildDesignContractViewModel(
  options: BuildDesignContractViewModelOptions
): DesignContractViewModel {
  const summary = summarizeDesignProjectContract({
    document: options.document,
    canvasDocument: options.canvasDocument,
    designSystem: options.designSystem,
    designContext: options.designContext
  })
  const disabledReason: DesignContractDisabledReason | undefined = !options.workspaceRoot
    ? 'no-workspace'
    : !options.document
      ? 'no-document'
      : undefined
  return {
    ...summary,
    visible: Boolean(options.document),
    canExport: !disabledReason,
    toolAction: buildDesignContractToolAction(summary),
    ...(disabledReason ? { disabledReason } : {})
  }
}
