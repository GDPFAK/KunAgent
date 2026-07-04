import type { CanvasDocument, CanvasShape, ViewBox } from '../canvas/canvas-types'
import { isHtmlFrame } from '../canvas/canvas-types'
import { snapshotCanvas, type CanvasSnapshot } from '../canvas/canvas-snapshot'
import { defaultFrameSizeForDesignTarget } from '../design-context'
import type { DesignWorkspaceState } from '../design-workspace-store-types'
import type { DesignArtifact, DesignIntentMode } from '../design-types'
import {
  designHtmlElementContextTarget,
  resolveDesignComposerContextTargets,
  resolveDesignComposerScreenFrameTarget,
  type DesignComposerContextTarget,
  type DesignHtmlElementContext
} from '../design-composer-context'
import type { DesignFrameContext, DesignTurnTarget } from './shared'

type TargetWorkspaceState = Pick<
  DesignWorkspaceState,
  'activeArtifactId' | 'artifacts' | 'designContext' | 'prepareHtmlTurn'
>

export type ResolveDesignTurnTargetOptions = {
  promptText: string
  workspaceState: TargetWorkspaceState
  boardArtifact: DesignArtifact
  canvasDocument: CanvasDocument
  selectedShapeIds: ReadonlySet<string>
  suppressedIds?: ReadonlySet<string>
  htmlElementContext?: DesignHtmlElementContext | null
  explicitScreenShapeId?: string | null
  viewBox?: ViewBox
}

export type ResolvedDesignTurnTarget = {
  target: DesignTurnTarget
  artifactRelativePath: string
  visibleTargets: DesignComposerContextTarget[]
  targetAutoRepairKey: string
  nextIntentMode?: DesignIntentMode
  basePath?: string
  htmlArtifactId?: string
  designNotesPath?: string
  htmlElementContext?: DesignHtmlElementContext
  selectedFrame?: CanvasShape
  htmlFrameContext?: DesignFrameContext
  canvasSnapshot?: CanvasSnapshot
}

export function designAutoRepairArtifactKey(artifactId: string | undefined): string {
  const normalized = artifactId?.trim()
  return normalized ? `artifact:${normalized}` : ''
}

export function frameContextForHtmlArtifact(
  artifactId: string,
  canvasDocument: CanvasDocument,
  artifacts: readonly DesignArtifact[]
): DesignFrameContext | undefined {
  const artifact = artifacts.find((item) => item.id === artifactId)
  const frame = Object.values(canvasDocument.objects).find(
    (shape): shape is CanvasShape => Boolean(shape) && isHtmlFrame(shape) && shape.htmlArtifactId === artifactId
  )
  const sizeMode = artifact?.node?.sizeMode
  if (frame) {
    return {
      name: frame.name || artifact?.title,
      width: frame.width,
      height: frame.height,
      ...(sizeMode ? { sizeMode } : {})
    }
  }
  if (artifact?.node) {
    return {
      name: artifact.title,
      width: artifact.node.width,
      height: artifact.node.height,
      ...(sizeMode ? { sizeMode } : {})
    }
  }
  return undefined
}

function resolveVisibleTargets(options: ResolveDesignTurnTargetOptions): DesignComposerContextTarget[] {
  const elementTarget = options.htmlElementContext
    ? designHtmlElementContextTarget({
        artifacts: options.workspaceState.artifacts,
        element: options.htmlElementContext,
        suppressedIds: options.suppressedIds
      })
    : null
  const baseVisibleTargets = resolveDesignComposerContextTargets({
    artifacts: options.workspaceState.artifacts,
    activeArtifactId: options.workspaceState.activeArtifactId,
    canvasDocument: options.canvasDocument,
    selectedIds: options.selectedShapeIds,
    suppressedIds: options.suppressedIds
  })
  const explicitScreenTarget = resolveDesignComposerScreenFrameTarget({
    artifacts: options.workspaceState.artifacts,
    canvasDocument: options.canvasDocument,
    shapeId: options.explicitScreenShapeId,
    suppressedIds: options.suppressedIds
  })
  if (explicitScreenTarget) {
    return [
      explicitScreenTarget,
      ...baseVisibleTargets.filter((target) =>
        target.kind !== 'html-screen-frame' || target.shape.id !== explicitScreenTarget.shape.id
      )
    ]
  }
  return elementTarget ? [elementTarget, ...baseVisibleTargets] : baseVisibleTargets
}

function snapshotForCanvasTurn(
  options: ResolveDesignTurnTargetOptions,
  selectedIds: ReadonlySet<string>
): CanvasSnapshot {
  return snapshotCanvas(options.canvasDocument, selectedIds, {
    maxShapes: 180,
    viewBox: options.viewBox,
    defaultScreenSize: defaultFrameSizeForDesignTarget(options.workspaceState.designContext.designTarget),
    projectId: options.boardArtifact.id,
    artifacts: options.workspaceState.artifacts
  })
}

function resolveHtmlScreenTarget(
  options: ResolveDesignTurnTargetOptions,
  target: Extract<DesignComposerContextTarget, { kind: 'html-screen-frame' }>
): ResolvedDesignTurnTarget {
  const prep = options.workspaceState.prepareHtmlTurn(options.promptText, {
    artifactId: target.artifact.id,
    forceNew: false,
    activate: false,
    reusePendingInitial: true
  })
  return {
    target: 'screen',
    artifactRelativePath: prep.relativePath,
    basePath: prep.basePath,
    htmlArtifactId: prep.artifactId,
    designNotesPath: prep.designMdPath,
    selectedFrame: target.shape,
    htmlFrameContext: frameContextForHtmlArtifact(target.artifact.id, options.canvasDocument, options.workspaceState.artifacts),
    visibleTargets: resolveVisibleTargets(options),
    targetAutoRepairKey: designAutoRepairArtifactKey(target.artifact.id)
  }
}

function resolveHtmlArtifactTarget(
  options: ResolveDesignTurnTargetOptions,
  target: Extract<DesignComposerContextTarget, { kind: 'html-artifact' | 'html-element' }>
): ResolvedDesignTurnTarget {
  const prep = options.workspaceState.prepareHtmlTurn(options.promptText, {
    artifactId: target.artifact.id,
    forceNew: false,
    activate: false
  })
  return {
    target: 'html',
    artifactRelativePath: prep.relativePath,
    basePath: prep.basePath,
    htmlArtifactId: prep.artifactId,
    designNotesPath: prep.designMdPath,
    htmlFrameContext: frameContextForHtmlArtifact(prep.artifactId, options.canvasDocument, options.workspaceState.artifacts),
    htmlElementContext: target.kind === 'html-element'
      ? { ...target.element, artifactRelativePath: prep.basePath ?? target.artifact.relativePath }
      : undefined,
    visibleTargets: resolveVisibleTargets(options),
    targetAutoRepairKey: designAutoRepairArtifactKey(target.artifact.id),
    nextIntentMode: 'modify'
  }
}

export function resolveDesignTurnTarget(options: ResolveDesignTurnTargetOptions): ResolvedDesignTurnTarget {
  const visibleTargets = resolveVisibleTargets(options)
  const primaryTarget = visibleTargets[0] ?? null
  if (primaryTarget?.kind === 'html-screen-frame') {
    return resolveHtmlScreenTarget(options, primaryTarget)
  }
  if (primaryTarget?.kind === 'html-element' || primaryTarget?.kind === 'html-artifact') {
    return resolveHtmlArtifactTarget(options, primaryTarget)
  }
  const selectedIds = primaryTarget?.kind === 'canvas-selection'
    ? new Set(primaryTarget.selectedIds)
    : new Set<string>()
  return {
    target: 'canvas',
    artifactRelativePath: options.boardArtifact.relativePath,
    visibleTargets,
    targetAutoRepairKey: '',
    canvasSnapshot: snapshotForCanvasTurn(options, selectedIds),
    ...(primaryTarget?.kind === 'canvas-selection' ? {} : { nextIntentMode: 'generate' })
  }
}
