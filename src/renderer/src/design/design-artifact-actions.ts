import type { DesignArtifact, DesignDirectionStatus } from './design-types'

export type DesignDirectionGroup = {
  id: string
  name: string
  status: DesignDirectionStatus
  artifacts: DesignArtifact[]
}

export type GroupedDesignArtifacts = {
  html: DesignArtifact[]
  canvas: DesignArtifact[]
  directions: DesignDirectionGroup[]
  archivedDirections: DesignDirectionGroup[]
}

export type DesignDirectionComparisonRow = {
  id: string
  name: string
  status: DesignDirectionStatus
  screenCount: number
  prototypeLinkCount: number
  implementedCount: number
  latestUpdatedAt: string
  uniqueScreenTitles: string[]
}

export type DesignDirectionComparison = {
  rows: DesignDirectionComparisonRow[]
  sharedScreenTitles: string[]
}

export type DesignDirectionScreenMatrixRow = {
  key: string
  title: string
  artifactIdsByDirectionId: Record<string, string>
  coverageCount: number
  shared: boolean
}

export function groupDesignArtifacts(
  artifacts: readonly DesignArtifact[],
  screenLinkedIds?: ReadonlySet<string>
): GroupedDesignArtifacts {
  const grouped = artifacts.reduce<GroupedDesignArtifacts>(
    (groups, artifact) => {
      if (artifact.kind === 'canvas') groups.canvas.push(artifact)
      else {
        if (artifact.direction) {
          let direction = groups.directions.find((item) => item.id === artifact.direction?.id)
          if (!direction) {
            direction = {
              id: artifact.direction.id,
              name: artifact.direction.name,
              status: artifact.direction.status ?? 'active',
              artifacts: []
            }
            groups.directions.push(direction)
          }
          direction.artifacts.push(artifact)
        }
        if (!screenLinkedIds?.has(artifact.id)) groups.html.push(artifact)
      }
      return groups
    },
    { html: [], canvas: [], directions: [], archivedDirections: [] }
  )
  const directions = grouped.directions.filter((direction) => direction.artifacts.length > 0)
  grouped.directions = directions.filter((direction) => direction.status !== 'archived')
  grouped.archivedDirections = directions.filter((direction) => direction.status === 'archived')
  return grouped
}

export function collectAgentDrawingArtifactIds(
  artifacts: readonly DesignArtifact[],
  grouped: Pick<GroupedDesignArtifacts, 'directions' | 'archivedDirections'>,
  screenLinkedIds: ReadonlySet<string>
): Set<string> {
  const ids = new Set<string>()
  for (const direction of [...grouped.directions, ...grouped.archivedDirections]) {
    for (const artifact of direction.artifacts) ids.add(artifact.id)
  }
  for (const id of screenLinkedIds) ids.add(id)
  return ids
}

export function canImplementDesignArtifact(
  artifact: DesignArtifact | null | undefined
): artifact is DesignArtifact & { kind: 'html' } {
  return artifact?.kind === 'html'
}

function normalizeScreenTitle(title: string): string {
  return title.trim().toLocaleLowerCase()
}

export function buildDesignDirectionComparison(
  directions: readonly DesignDirectionGroup[]
): DesignDirectionComparison {
  const titleCounts = new Map<string, { title: string; directionIds: Set<string> }>()
  for (const direction of directions) {
    const seenInDirection = new Set<string>()
    for (const artifact of direction.artifacts) {
      const key = normalizeScreenTitle(artifact.title)
      if (!key || seenInDirection.has(key)) continue
      seenInDirection.add(key)
      const entry = titleCounts.get(key) ?? { title: artifact.title, directionIds: new Set<string>() }
      entry.directionIds.add(direction.id)
      titleCounts.set(key, entry)
    }
  }

  const rows = directions.map<DesignDirectionComparisonRow>((direction) => {
    const latestUpdatedAt = direction.artifacts.reduce(
      (latest, artifact) => (artifact.updatedAt > latest ? artifact.updatedAt : latest),
      ''
    )
    const uniqueScreenTitles = direction.artifacts
      .filter((artifact) => titleCounts.get(normalizeScreenTitle(artifact.title))?.directionIds.size === 1)
      .map((artifact) => artifact.title)
    return {
      id: direction.id,
      name: direction.name,
      status: direction.status,
      screenCount: direction.artifacts.length,
      prototypeLinkCount: direction.artifacts.reduce(
        (total, artifact) => total + (artifact.prototypeLinks?.length ?? 0),
        0
      ),
      implementedCount: direction.artifacts.filter((artifact) => Boolean(artifact.implementedAt)).length,
      latestUpdatedAt,
      uniqueScreenTitles
    }
  })

  return {
    rows,
    sharedScreenTitles: Array.from(titleCounts.values())
      .filter((entry) => entry.directionIds.size === directions.length && directions.length > 1)
      .map((entry) => entry.title)
  }
}

export function buildDesignDirectionScreenMatrix(
  directions: readonly DesignDirectionGroup[]
): DesignDirectionScreenMatrixRow[] {
  const rowsByTitle = new Map<string, Omit<DesignDirectionScreenMatrixRow, 'coverageCount' | 'shared'>>()

  for (const direction of directions) {
    const seenInDirection = new Set<string>()
    for (const artifact of direction.artifacts) {
      const key = normalizeScreenTitle(artifact.title)
      if (!key || seenInDirection.has(key)) continue
      seenInDirection.add(key)
      const existing = rowsByTitle.get(key)
      const row = existing ?? {
        key,
        title: artifact.title.trim() || artifact.title,
        artifactIdsByDirectionId: {}
      }
      if (!row.artifactIdsByDirectionId[direction.id]) {
        row.artifactIdsByDirectionId[direction.id] = artifact.id
      }
      rowsByTitle.set(key, row)
    }
  }

  return Array.from(rowsByTitle.values())
    .map((row) => {
      const coverageCount = Object.keys(row.artifactIdsByDirectionId).length
      return {
        ...row,
        coverageCount,
        shared: directions.length > 1 && coverageCount === directions.length
      }
    })
    .sort((a, b) => {
      if (a.shared !== b.shared) return a.shared ? -1 : 1
      if (a.coverageCount !== b.coverageCount) return b.coverageCount - a.coverageCount
      return a.title.localeCompare(b.title)
    })
}
