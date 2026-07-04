import type { LintFinding } from '../canvas/design-lint'
import type { DesignToolState } from './tool-state'

export type CritiqueDimensionId =
  | 'design-system'
  | 'accessibility'
  | 'interaction'
  | 'direction-readiness'
  | 'code-readiness'

export type CritiqueDimensionStatus = 'pass' | 'needs-review' | 'blocked'

export type CritiqueDimension = {
  id: CritiqueDimensionId
  status: CritiqueDimensionStatus
  findingCount: number
  summary: string
  nextTool?: string
}

export type CritiqueRecommendation = {
  toolId: string
  reason: string
  inputHint: string
}

export type DesignCritiqueReport = {
  status: 'clean' | 'needs-repair' | 'blocked'
  score: number
  dimensions: CritiqueDimension[]
  recommendations: CritiqueRecommendation[]
}

function countFindings(findings: readonly LintFinding[], code: LintFinding['code']): number {
  return findings.filter((finding) => finding.code === code).length
}

function dimension(
  id: CritiqueDimensionId,
  status: CritiqueDimensionStatus,
  findingCount: number,
  summary: string,
  nextTool?: string
): CritiqueDimension {
  return { id, status, findingCount, summary, ...(nextTool ? { nextTool } : {}) }
}

function recommendation(toolId: string, reason: string, inputHint: string): CritiqueRecommendation {
  return { toolId, reason, inputHint }
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function buildDesignCritiqueReport(
  state: DesignToolState,
  findings: readonly LintFinding[]
): DesignCritiqueReport {
  const offTokenCount = countFindings(findings, 'off-token-color')
  const lowContrastCount = countFindings(findings, 'low-contrast')
  const smallTargetCount = countFindings(findings, 'small-hit-target')
  const htmlFrameCount = Object.values(state.graph.objects).filter((object) => object.kind === 'html-frame').length
  const tokenCount = state.graph.designSystem?.tokenCount ?? 0
  const componentCount = state.graph.designSystem?.componentCount ?? 0
  const bindings = state.canvasDocument.codeBindings ?? []
  const activeBindingCount = bindings.filter((binding) => binding.status === 'active').length
  const staleBindingCount = bindings.filter((binding) => binding.status === 'stale').length
  const missingBindingCount = bindings.filter((binding) => binding.status === 'missing').length
  const directionRiskCount = state.directionManager.directions.filter((direction) =>
    direction.scorecard?.readiness === 'blocked' || direction.scorecard?.readiness === 'needs-review'
  ).length

  const needsSystemBaseline = htmlFrameCount > 0 && (tokenCount === 0 || componentCount === 0)
  const codeBindingIssueCount =
    htmlFrameCount > 0 && (activeBindingCount === 0 || staleBindingCount + missingBindingCount > 0)
      ? Math.max(1, staleBindingCount + missingBindingCount)
      : 0

  const dimensions: CritiqueDimension[] = [
    dimension(
      'design-system',
      offTokenCount > 0 || needsSystemBaseline ? 'needs-review' : 'pass',
      offTokenCount + (needsSystemBaseline ? 1 : 0),
      offTokenCount > 0
        ? `${offTokenCount} object(s) use token colors without bindings.`
        : needsSystemBaseline
          ? 'Screens exist but the token/component baseline is incomplete.'
          : 'Token and component baseline looks coherent.',
      offTokenCount > 0 || needsSystemBaseline ? 'design.system' : undefined
    ),
    dimension(
      'accessibility',
      lowContrastCount > 0 ? 'blocked' : 'pass',
      lowContrastCount,
      lowContrastCount > 0
        ? `${lowContrastCount} text object(s) fail contrast checks.`
        : 'No contrast blockers found in canvas lint.',
      lowContrastCount > 0 ? 'design.repair' : undefined
    ),
    dimension(
      'interaction',
      smallTargetCount > 0 ? 'needs-review' : 'pass',
      smallTargetCount,
      smallTargetCount > 0
        ? `${smallTargetCount} touch target(s) are below the 44px minimum.`
        : 'No small touch-target issues found.',
      smallTargetCount > 0 ? 'design.repair' : undefined
    ),
    dimension(
      'direction-readiness',
      directionRiskCount > 0 ? 'needs-review' : 'pass',
      directionRiskCount,
      directionRiskCount > 0
        ? `${directionRiskCount} direction(s) need review before acceptance.`
        : 'Directions are not reporting readiness risks.',
      directionRiskCount > 0 ? 'design.critique' : undefined
    ),
    dimension(
      'code-readiness',
      codeBindingIssueCount > 0 ? 'needs-review' : 'pass',
      codeBindingIssueCount,
      codeBindingIssueCount > 0
        ? 'Code bindings are missing, stale, or incomplete for implementation handoff.'
        : 'Code binding status does not block handoff.',
      codeBindingIssueCount > 0 ? 'design.bind_code' : undefined
    )
  ]

  const recommendations: CritiqueRecommendation[] = []
  if (lowContrastCount + smallTargetCount > 0) {
    recommendations.push(recommendation(
      'design.repair',
      'Repair accessibility and interaction findings before export or implementation.',
      'scopeIds from report findings, attachNotes=true'
    ))
  }
  if (offTokenCount > 0 || needsSystemBaseline) {
    recommendations.push(recommendation(
      'design.system',
      'Normalize hardcoded styling into reusable tokens/components.',
      'selected screen ids, repeated shapes, brand/tone constraints'
    ))
  }
  if (codeBindingIssueCount > 0) {
    recommendations.push(recommendation(
      'design.bind_code',
      'Refresh code bindings so design changes can round-trip into source code.',
      'running app frames or DOM/source snapshot'
    ))
  }
  if (recommendations.length === 0) {
    recommendations.push(recommendation(
      'design.export',
      'No repair blockers were found; prepare a handoff package.',
      'format=package or design-md'
    ))
  }

  const score = clampScore(
    100 -
      offTokenCount * 8 -
      lowContrastCount * 18 -
      smallTargetCount * 10 -
      (needsSystemBaseline ? 12 : 0) -
      directionRiskCount * 10 -
      codeBindingIssueCount * 8
  )
  const status = lowContrastCount > 0
    ? 'blocked'
    : dimensions.some((item) => item.status === 'needs-review')
      ? 'needs-repair'
      : 'clean'

  return { status, score, dimensions, recommendations }
}
