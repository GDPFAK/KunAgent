import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createHtmlFrameShape, ROOT_SHAPE_ID } from '../canvas/canvas-types'
import type { DesignDirectionGroup } from '../design-artifact-actions'
import type { DesignArtifact } from '../design-types'
import {
  buildDesignDirectionManagerModel,
  summarizeDirectionForAgent
} from './direction-manager'

const createdAt = '2026-07-02T00:00:00.000Z'

function artifact(id: string, patch: Partial<DesignArtifact> = {}): DesignArtifact {
  const relativePath = `.kun-design/doc/${id}/v1.html`
  return {
    id,
    kind: 'html',
    title: id,
    relativePath,
    createdAt,
    updatedAt: createdAt,
    versions: [{ id: `${id}-v1`, relativePath, createdAt, summary: '' }],
    ...patch
  }
}

describe('design direction manager', () => {
  it('builds a sorted direction view model with compare metadata', () => {
    const fast: DesignDirectionGroup = {
      id: 'dir_fast',
      name: 'Fast checkout',
      status: 'active',
      artifacts: [
        artifact('checkout-fast', {
          title: 'Checkout',
          updatedAt: '2026-07-02T02:00:00.000Z',
          implementedAt: '2026-07-02T03:00:00.000Z',
          prototypeLinks: [{ targetTitle: 'Thanks' }]
        }),
        artifact('thanks-fast', { title: 'Thanks' })
      ]
    }
    const revenue: DesignDirectionGroup = {
      id: 'dir_revenue',
      name: 'Revenue checkout',
      status: 'accepted',
      artifacts: [
        artifact('checkout-revenue', {
          title: 'Checkout',
          updatedAt: '2026-07-02T01:00:00.000Z'
        }),
        artifact('upsell-revenue', { title: 'Upsell' })
      ]
    }

    const model = buildDesignDirectionManagerModel([fast, revenue])

    expect(model.canCompare).toBe(true)
    expect(model.directions.map((direction) => direction.id)).toEqual(['dir_revenue', 'dir_fast'])
    expect(model.directions.find((direction) => direction.id === 'dir_fast')).toMatchObject({
      screenCount: 2,
      prototypeLinkCount: 1,
      implementedCount: 1,
      uniqueScreenTitles: ['Thanks'],
      toolAction: {
        id: 'critique-direction',
        toolId: 'design.critique',
        toolCallLine: expect.stringContaining('Suggested tool call: design.critique')
      },
      scorecard: {
        directionId: 'dir_fast',
        readiness: 'needs-review',
        implementationCost: 'medium',
        flowCoverage: 1,
        risks: ['no-rationale', 'unreviewed']
      }
    })
    expect(model.screenMatrix[0]).toMatchObject({
      key: 'checkout',
      coverageCount: 2,
      shared: true
    })
  })

  it('keeps archived directions separate and summarizes directions for agent context', () => {
    const archived: DesignDirectionGroup = {
      id: 'dir_old',
      name: 'Old direction',
      status: 'archived',
      artifacts: [artifact('old-home', { title: 'Home' })]
    }

    const model = buildDesignDirectionManagerModel([], [archived])

    expect(model.activeCount).toBe(0)
    expect(model.archivedCount).toBe(1)
    expect(model.canCompare).toBe(false)
    expect(summarizeDirectionForAgent(model.archivedDirections[0])).toEqual({
      id: 'dir_old',
      name: 'Old direction',
      status: 'archived',
      screenCount: 1,
      prototypeLinkCount: 0,
      implementedCount: 0,
      frameIds: [],
      uniqueScreens: ['Home'],
      scorecard: {
        readiness: 'needs-review',
        score: 35,
        implementationCost: 'medium',
        flowCoverage: 1,
        risks: ['no-rationale', 'unreviewed', 'not-implemented']
      }
    })
  })

  it('scopes direction tool actions to canvas frame ids when available', () => {
    const direction: DesignDirectionGroup = {
      id: 'dir_scoped',
      name: 'Scoped direction',
      status: 'active',
      artifacts: [artifact('home', { title: 'Home' })]
    }
    const doc = createEmptyDocument()
    const frame = {
      ...createHtmlFrameShape('Home', 0, 0, 'home', 'desktop'),
      id: 'frame_home',
      parentId: ROOT_SHAPE_ID
    }
    doc.objects[ROOT_SHAPE_ID] = { ...doc.objects[ROOT_SHAPE_ID], children: [frame.id] }
    doc.objects[frame.id] = frame

    const model = buildDesignDirectionManagerModel([direction], [], { canvasDocument: doc })
    const scoped = model.directions[0]

    expect(scoped.frameIds).toEqual(['frame_home'])
    expect(scoped.toolAction).toMatchObject({
      toolId: 'design.critique',
      toolInputSeed: {
        directionId: 'dir_scoped',
        artifactIds: ['home'],
        scopeIds: ['frame_home'],
        attachNotes: true
      }
    })
  })
})
