import type { CanvasDocument, CanvasShape } from '../canvas/canvas-types'
import { isHtmlFrame } from '../canvas/canvas-types'
import type { DesignDirectionGroup } from '../design-artifact-actions'
import type { DesignArtifact } from '../design-types'

export type DirectionReadiness = 'ready' | 'needs-review' | 'blocked'

export type DirectionImplementationCost = 'low' | 'medium' | 'high'

export type DirectionScorecardRisk =
  | 'no-screens'
  | 'preview-errors'
  | 'missing-flow'
  | 'no-rationale'
  | 'unreviewed'
  | 'not-implemented'
  | 'missing-code-bindings'
  | 'stale-code-bindings'

export type DesignDirectionScorecard = {
  directionId: string
  name: string
  readiness: DirectionReadiness
  score: number
  implementationCost: DirectionImplementationCost
  screenCount: number
  prototypeLinkCount: number
  flowCoverage: number
  rationaleCount: number
  critiqueCount: number
  implementedCount: number
  activeBindingCount: number
  staleBindingCount: number
  missingBindingCount: number
  risks: DirectionScorecardRisk[]
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function artifactHasRationale(artifact: DesignArtifact): boolean {
  return artifact.versions.some((version) => version.summary.trim().length > 0) || Boolean(artifact.designMdPath)
}

function htmlFrameByArtifactId(document: CanvasDocument | undefined): Map<string, CanvasShape> {
  const frames = new Map<string, CanvasShape>()
  for (const shape of Object.values(document?.objects ?? {})) {
    if (shape && isHtmlFrame(shape) && shape.htmlArtifactId) frames.set(shape.htmlArtifactId, shape)
  }
  return frames
}

function directionFrameIds(direction: DesignDirectionGroup, document: CanvasDocument | undefined): string[] {
  const byArtifactId = htmlFrameByArtifactId(document)
  return direction.artifacts
    .map((artifact) => byArtifactId.get(artifact.id)?.id)
    .filter((id): id is string => Boolean(id))
}

function countCritiques(document: CanvasDocument | undefined, frameIds: readonly string[]): number {
  if (!document || frameIds.length === 0) return 0
  const ids = new Set(frameIds)
  return (document.operationJournal ?? []).filter((entry) => {
    const reviewish = /critique|lint|validate|repair/i.test(entry.label) ||
      entry.operations.some((operation) => operation.type === 'lint_design')
    if (!reviewish) return false
    return entry.affectedIds.some((id) => ids.has(id)) ||
      entry.operations.some((operation) => operation.targetIds.some((id) => ids.has(id)))
  }).length
}

function countBindings(document: CanvasDocument | undefined, frameIds: readonly string[]) {
  const ids = new Set(frameIds)
  const scoped = (document?.codeBindings ?? []).filter((binding) => ids.has(binding.designObjectId))
  return {
    active: scoped.filter((binding) => binding.status === 'active').length,
    stale: scoped.filter((binding) => binding.status === 'stale').length,
    missing: scoped.filter((binding) => binding.status === 'missing').length
  }
}

function riskList(input: {
  screenCount: number
  previewErrorCount: number
  prototypeLinkCount: number
  rationaleCount: number
  critiqueCount: number
  implementedCount: number
  frameCount: number
  activeBindingCount: number
  staleBindingCount: number
  missingBindingCount: number
  hasCanvasEvidence: boolean
}): DirectionScorecardRisk[] {
  const risks: DirectionScorecardRisk[] = []
  if (input.screenCount === 0) risks.push('no-screens')
  if (input.previewErrorCount > 0) risks.push('preview-errors')
  if (input.screenCount > 1 && input.prototypeLinkCount < input.screenCount - 1) risks.push('missing-flow')
  if (input.rationaleCount === 0) risks.push('no-rationale')
  if (input.critiqueCount === 0) risks.push('unreviewed')
  if (input.screenCount > 0 && input.implementedCount === 0) risks.push('not-implemented')
  if (input.hasCanvasEvidence && input.frameCount > 0 && input.activeBindingCount === 0) risks.push('missing-code-bindings')
  if (input.staleBindingCount > 0 || input.missingBindingCount > 0) risks.push('stale-code-bindings')
  return risks
}

function readinessFromRisks(risks: readonly DirectionScorecardRisk[]): DirectionReadiness {
  if (risks.includes('no-screens') || risks.includes('preview-errors')) return 'blocked'
  if (risks.length > 0) return 'needs-review'
  return 'ready'
}

function implementationCost(input: {
  screenCount: number
  implementedCount: number
  activeBindingCount: number
  staleBindingCount: number
  missingBindingCount: number
  flowCoverage: number
}): DirectionImplementationCost {
  const unimplemented = Math.max(0, input.screenCount - input.implementedCount)
  if (
    input.screenCount >= 5 ||
    unimplemented >= 3 ||
    input.staleBindingCount + input.missingBindingCount > 0 ||
    (input.screenCount > 1 && input.flowCoverage < 0.5)
  ) return 'high'
  if (unimplemented > 0 || input.activeBindingCount === 0 || input.flowCoverage < 1) return 'medium'
  return 'low'
}

function scoreFor(input: {
  screenCount: number
  prototypeLinkCount: number
  flowCoverage: number
  rationaleCount: number
  critiqueCount: number
  implementedCount: number
  activeBindingCount: number
  staleBindingCount: number
  missingBindingCount: number
  previewErrorCount: number
}): number {
  const screenScore = input.screenCount > 0 ? 20 : 0
  const flowScore = input.screenCount <= 1 ? 15 : input.flowCoverage * 20
  const rationaleScore = Math.min(15, input.rationaleCount * 8)
  const reviewScore = Math.min(15, input.critiqueCount * 8)
  const implementationScore = input.screenCount > 0 ? (input.implementedCount / input.screenCount) * 15 : 0
  const bindingScore = Math.min(15, input.activeBindingCount * 8)
  const penalty = input.previewErrorCount * 20 + (input.staleBindingCount + input.missingBindingCount) * 8
  return clampScore(screenScore + flowScore + rationaleScore + reviewScore + implementationScore + bindingScore - penalty)
}

export function buildDesignDirectionScorecard(
  direction: DesignDirectionGroup,
  document?: CanvasDocument
): DesignDirectionScorecard {
  const screenCount = direction.artifacts.length
  const prototypeLinkCount = direction.artifacts.reduce((sum, artifact) => sum + (artifact.prototypeLinks?.length ?? 0), 0)
  const requiredLinks = Math.max(1, screenCount - 1)
  const flowCoverage = screenCount <= 1 ? (screenCount === 1 ? 1 : 0) : Math.min(1, prototypeLinkCount / requiredLinks)
  const rationaleCount = direction.artifacts.filter(artifactHasRationale).length
  const previewErrorCount = direction.artifacts.filter((artifact) => artifact.previewStatus === 'error').length
  const implementedCount = direction.artifacts.filter((artifact) => Boolean(artifact.implementedAt)).length
  const frameIds = directionFrameIds(direction, document)
  const critiqueCount = countCritiques(document, frameIds)
  const bindings = countBindings(document, frameIds)
  const risks = riskList({
    screenCount,
    previewErrorCount,
    prototypeLinkCount,
    rationaleCount,
    critiqueCount,
    implementedCount,
    frameCount: frameIds.length,
    activeBindingCount: bindings.active,
    staleBindingCount: bindings.stale,
    missingBindingCount: bindings.missing,
    hasCanvasEvidence: Boolean(document)
  })
  const cost = implementationCost({
    screenCount,
    implementedCount,
    activeBindingCount: bindings.active,
    staleBindingCount: bindings.stale,
    missingBindingCount: bindings.missing,
    flowCoverage
  })
  return {
    directionId: direction.id,
    name: direction.name,
    readiness: readinessFromRisks(risks),
    score: scoreFor({
      screenCount,
      prototypeLinkCount,
      flowCoverage,
      rationaleCount,
      critiqueCount,
      implementedCount,
      activeBindingCount: bindings.active,
      staleBindingCount: bindings.stale,
      missingBindingCount: bindings.missing,
      previewErrorCount
    }),
    implementationCost: cost,
    screenCount,
    prototypeLinkCount,
    flowCoverage,
    rationaleCount,
    critiqueCount,
    implementedCount,
    activeBindingCount: bindings.active,
    staleBindingCount: bindings.stale,
    missingBindingCount: bindings.missing,
    risks
  }
}

export function buildDesignDirectionScorecards(
  directions: readonly DesignDirectionGroup[],
  document?: CanvasDocument
): Record<string, DesignDirectionScorecard> {
  return Object.fromEntries(directions.map((direction) => [
    direction.id,
    buildDesignDirectionScorecard(direction, document)
  ]))
}

export function formatDirectionScorecardForAgent(scorecard: DesignDirectionScorecard): string {
  const riskText = scorecard.risks.length > 0 ? scorecard.risks.join(', ') : 'none'
  return [
    `${scorecard.name} (${scorecard.directionId})`,
    `readiness=${scorecard.readiness}`,
    `score=${scorecard.score}`,
    `implementationCost=${scorecard.implementationCost}`,
    `screens=${scorecard.screenCount}`,
    `flowCoverage=${Math.round(scorecard.flowCoverage * 100)}%`,
    `implemented=${scorecard.implementedCount}`,
    `activeBindings=${scorecard.activeBindingCount}`,
    `risks=${riskText}`
  ].join(' · ')
}
