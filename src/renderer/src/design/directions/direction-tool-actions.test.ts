import { describe, expect, it } from 'vitest'
import type { DesignDirectionScorecard } from './direction-scorecard'
import { buildDirectionToolAction } from './direction-tool-actions'

function scorecard(patch: Partial<DesignDirectionScorecard>): DesignDirectionScorecard {
  return {
    directionId: 'dir',
    name: 'Direction',
    readiness: 'needs-review',
    score: 42,
    implementationCost: 'medium',
    screenCount: 1,
    prototypeLinkCount: 0,
    flowCoverage: 1,
    rationaleCount: 0,
    critiqueCount: 0,
    implementedCount: 0,
    activeBindingCount: 0,
    staleBindingCount: 0,
    missingBindingCount: 0,
    risks: [],
    ...patch
  }
}

describe('direction tool actions', () => {
  it('prioritizes repair when a direction has preview errors', () => {
    const action = buildDirectionToolAction({
      directionId: 'dir_preview',
      directionName: 'Preview risk',
      artifactIds: ['home'],
      frameIds: ['frame_home'],
      scorecard: scorecard({ risks: ['preview-errors', 'unreviewed'] })
    })

    expect(action).toMatchObject({
      id: 'repair-preview',
      intentMode: 'modify',
      toolId: 'design.repair',
      toolInputSeed: {
        directionId: 'dir_preview',
        artifactIds: ['home'],
        scopeIds: ['frame_home'],
        maxFindings: 8
      }
    })
    expect(action.prompt).toContain('Suggested tool call: design.repair')
  })

  it('exports a handoff package when the scorecard has no risks', () => {
    const action = buildDirectionToolAction({
      directionId: 'dir_ready',
      directionName: 'Ready direction',
      artifactIds: ['home'],
      frameIds: ['frame_home'],
      scorecard: scorecard({ readiness: 'ready', score: 96, implementationCost: 'low', risks: [] })
    })

    expect(action).toMatchObject({
      id: 'export-direction',
      intentMode: 'preview',
      toolId: 'design.export',
      toolInputSeed: {
        format: 'package',
        directionId: 'dir_ready',
        artifactIds: ['home']
      }
    })
    expect(action.toolCallLine).toContain('Suggested tool call: design.export')
  })
})
