import {
  buildDesignDirectionComparison,
  buildDesignDirectionScreenMatrix,
  type DesignDirectionComparison,
  type DesignDirectionGroup,
  type DesignDirectionScreenMatrixRow
} from '../design-artifact-actions'
import type { CanvasDocument } from '../canvas/canvas-types'
import { isHtmlFrame } from '../canvas/canvas-types'
import type { DesignArtifact, DesignDirectionStatus } from '../design-types'
import {
  buildDesignDirectionScorecards,
  type DesignDirectionScorecard
} from './direction-scorecard'
import {
  buildDirectionToolAction,
  type DirectionToolAction
} from './direction-tool-actions'

export type DesignDirectionManagerDirection = {
  id: string
  name: string
  status: DesignDirectionStatus
  artifacts: DesignArtifact[]
  screenCount: number
  prototypeLinkCount: number
  implementedCount: number
  latestUpdatedAt: string
  primaryArtifactId: string | null
  frameIds: string[]
  uniqueScreenTitles: string[]
  scorecard?: DesignDirectionScorecard
  toolAction: DirectionToolAction
}

export type DesignDirectionManagerModel = {
  directions: DesignDirectionManagerDirection[]
  archivedDirections: DesignDirectionManagerDirection[]
  comparison: DesignDirectionComparison
  screenMatrix: DesignDirectionScreenMatrixRow[]
  activeCount: number
  archivedCount: number
  canCompare: boolean
}

export type BuildDesignDirectionManagerModelOptions = {
  canvasDocument?: CanvasDocument
}

function toManagerDirection(
  direction: DesignDirectionGroup,
  comparison: DesignDirectionComparison,
  scorecard: DesignDirectionScorecard | undefined,
  frameIds: readonly string[]
): DesignDirectionManagerDirection {
  const row = comparison.rows.find((candidate) => candidate.id === direction.id)
  const latestUpdatedAt =
    row?.latestUpdatedAt ??
    direction.artifacts.reduce((latest, artifact) => (artifact.updatedAt > latest ? artifact.updatedAt : latest), '')
  return {
    id: direction.id,
    name: direction.name,
    status: direction.status,
    artifacts: direction.artifacts,
    screenCount: row?.screenCount ?? direction.artifacts.length,
    prototypeLinkCount:
      row?.prototypeLinkCount ??
      direction.artifacts.reduce((total, artifact) => total + (artifact.prototypeLinks?.length ?? 0), 0),
    implementedCount:
      row?.implementedCount ?? direction.artifacts.filter((artifact) => Boolean(artifact.implementedAt)).length,
    latestUpdatedAt,
    primaryArtifactId: direction.artifacts[0]?.id ?? null,
    frameIds: [...frameIds],
    uniqueScreenTitles: row?.uniqueScreenTitles ?? [],
    ...(scorecard ? { scorecard } : {}),
    toolAction: buildDirectionToolAction({
      directionId: direction.id,
      directionName: direction.name,
      artifactIds: direction.artifacts.map((artifact) => artifact.id),
      frameIds,
      scorecard
    })
  }
}

function htmlFrameIdsByArtifactId(document: CanvasDocument | undefined): Map<string, string> {
  const frames = new Map<string, string>()
  for (const shape of Object.values(document?.objects ?? {})) {
    if (shape && isHtmlFrame(shape) && shape.htmlArtifactId) frames.set(shape.htmlArtifactId, shape.id)
  }
  return frames
}

function frameIdsForDirection(
  direction: DesignDirectionGroup,
  frameIdsByArtifactId: ReadonlyMap<string, string>
): string[] {
  return direction.artifacts
    .map((artifact) => frameIdsByArtifactId.get(artifact.id))
    .filter((id): id is string => Boolean(id))
}

function sortDirections(directions: DesignDirectionManagerDirection[]): DesignDirectionManagerDirection[] {
  return [...directions].sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === 'accepted') return -1
      if (b.status === 'accepted') return 1
    }
    return b.latestUpdatedAt.localeCompare(a.latestUpdatedAt) || a.name.localeCompare(b.name)
  })
}

export function buildDesignDirectionManagerModel(
  directions: readonly DesignDirectionGroup[],
  archivedDirections: readonly DesignDirectionGroup[] = [],
  options: BuildDesignDirectionManagerModelOptions = {}
): DesignDirectionManagerModel {
  const visibleDirections = directions.filter((direction) => direction.artifacts.length > 0)
  const visibleArchived = archivedDirections.filter((direction) => direction.artifacts.length > 0)
  const comparison = buildDesignDirectionComparison(visibleDirections)
  const screenMatrix = buildDesignDirectionScreenMatrix(visibleDirections)
  const scorecards = buildDesignDirectionScorecards([...visibleDirections, ...visibleArchived], options.canvasDocument)
  const frameIdsByArtifactId = htmlFrameIdsByArtifactId(options.canvasDocument)
  return {
    directions: sortDirections(visibleDirections.map((direction) =>
      toManagerDirection(direction, comparison, scorecards[direction.id], frameIdsForDirection(direction, frameIdsByArtifactId))
    )),
    archivedDirections: sortDirections(
      visibleArchived.map((direction) =>
        toManagerDirection(
          direction,
          buildDesignDirectionComparison([direction]),
          scorecards[direction.id],
          frameIdsForDirection(direction, frameIdsByArtifactId)
        )
      )
    ),
    comparison,
    screenMatrix,
    activeCount: visibleDirections.length,
    archivedCount: visibleArchived.length,
    canCompare: visibleDirections.length >= 2
  }
}

export function summarizeDirectionForAgent(
  direction: DesignDirectionManagerDirection
): {
  id: string
  name: string
  status: DesignDirectionStatus
  screenCount: number
  prototypeLinkCount: number
  implementedCount: number
  frameIds: string[]
  uniqueScreens?: string[]
  scorecard?: Pick<
    DesignDirectionScorecard,
    'readiness' | 'score' | 'implementationCost' | 'flowCoverage' | 'risks'
  >
} {
  return {
    id: direction.id,
    name: direction.name,
    status: direction.status,
    screenCount: direction.screenCount,
    prototypeLinkCount: direction.prototypeLinkCount,
    implementedCount: direction.implementedCount,
    frameIds: direction.frameIds,
    ...(direction.uniqueScreenTitles.length > 0 ? { uniqueScreens: direction.uniqueScreenTitles.slice(0, 6) } : {}),
    ...(direction.scorecard ? {
      scorecard: {
        readiness: direction.scorecard.readiness,
        score: direction.scorecard.score,
        implementationCost: direction.scorecard.implementationCost,
        flowCoverage: direction.scorecard.flowCoverage,
        risks: direction.scorecard.risks
      }
    } : {})
  }
}
