import { isHtmlFrame, type CanvasDocument } from '../canvas/canvas-types'
import { lintDesignSystem } from '../canvas/design-lint'
import type { DesignSystem } from '../canvas/design-system-types'
import type { DesignTarget } from '../design-context'
import { summarizeDesignSystemForGraph } from '../graph/design-system-graph'
import {
  buildDesignSystemPanelActions,
  type DesignSystemPanelAction
} from './design-system-tool-actions'

export type DesignSystemPanelModel = {
  actions: DesignSystemPanelAction[]
  tokenCount: number
  componentCount: number
  tokenUsageCount: number
  componentInstanceCount: number
  screenCount: number
  objectCount: number
  selectedCount: number
  lintFindingCount: number
}

export type BuildDesignSystemPanelModelInput = {
  doc: CanvasDocument
  designSystem: DesignSystem
  selectedIds: ReadonlySet<string>
  designTarget: DesignTarget
}

function objectCount(doc: CanvasDocument): number {
  return Object.keys(doc.objects).filter((id) => id !== doc.rootId).length
}

function screenCount(doc: CanvasDocument): number {
  return Object.values(doc.objects).filter((shape) => shape && isHtmlFrame(shape)).length
}

function selectedCount(doc: CanvasDocument, selectedIds: ReadonlySet<string>): number {
  return [...selectedIds].filter((id) => Boolean(doc.objects[id]) && id !== doc.rootId).length
}

export function buildDesignSystemPanelModel(
  input: BuildDesignSystemPanelModelInput
): DesignSystemPanelModel {
  const summary = summarizeDesignSystemForGraph(input.designSystem, input.doc)
  const selectedIds = [...input.selectedIds].filter((id) => Boolean(input.doc.objects[id]) && id !== input.doc.rootId)
  const lintFindings = lintDesignSystem(
    input.doc,
    input.designSystem,
    selectedIds.length > 0 ? { scopeIds: selectedIds } : undefined
  )
  return {
    actions: buildDesignSystemPanelActions(input),
    tokenCount: summary?.tokenCount ?? 0,
    componentCount: summary?.componentCount ?? 0,
    tokenUsageCount: summary?.tokenUsageCount ?? 0,
    componentInstanceCount: summary?.componentInstanceCount ?? 0,
    screenCount: screenCount(input.doc),
    objectCount: objectCount(input.doc),
    selectedCount: selectedCount(input.doc, input.selectedIds),
    lintFindingCount: lintFindings.length
  }
}
