import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createHtmlFrameShape } from '../canvas/canvas-types'
import type { DesignDirectionGroup } from '../design-artifact-actions'
import type { DesignArtifact } from '../design-types'
import {
  buildDesignDirectionScorecard,
  formatDirectionScorecardForAgent
} from './direction-scorecard'

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

describe('direction scorecard', () => {
  it('marks a reviewed implemented direction as ready with low implementation cost', () => {
    const direction: DesignDirectionGroup = {
      id: 'dir_ready',
      name: 'Ready direction',
      status: 'accepted',
      artifacts: [
        artifact('home', {
          title: 'Home',
          versions: [{ id: 'home-v1', relativePath: '.kun-design/doc/home/v1.html', createdAt, summary: 'Clear hero.' }],
          implementedAt: '2026-07-02T01:00:00.000Z',
          prototypeLinks: [{ targetTitle: 'Checkout', targetArtifactId: 'checkout' }]
        }),
        artifact('checkout', {
          title: 'Checkout',
          designMdPath: '.kun-design/doc/checkout/DESIGN.md',
          implementedAt: '2026-07-02T01:10:00.000Z'
        })
      ]
    }
    const doc = createEmptyDocument()
    const home = createHtmlFrameShape('Home', 0, 0, 'home', 'desktop')
    const checkout = createHtmlFrameShape('Checkout', 500, 0, 'checkout', 'desktop')
    doc.objects[home.id] = { ...home, parentId: doc.rootId }
    doc.objects[checkout.id] = { ...checkout, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [home.id, checkout.id] }
    doc.codeBindings = [
      {
        id: 'binding_home',
        designObjectId: home.id,
        kind: 'route',
        status: 'active',
        createdAt,
        target: { routePath: '/home', sourceFile: 'src/app/home/page.tsx' }
      }
    ]
    doc.operationJournal = [{
      id: 'journal_review',
      label: 'critique ready direction',
      createdAt,
      status: 'applied',
      affectedIds: [home.id],
      errors: [],
      operations: [{
        id: 'op_review',
        type: 'lint_design',
        label: 'Validate Home',
        source: 'agent',
        createdAt,
        targetIds: [home.id],
        payload: {}
      }]
    }]

    const scorecard = buildDesignDirectionScorecard(direction, doc)

    expect(scorecard).toMatchObject({
      readiness: 'ready',
      implementationCost: 'low',
      screenCount: 2,
      prototypeLinkCount: 1,
      flowCoverage: 1,
      rationaleCount: 2,
      critiqueCount: 1,
      implementedCount: 2,
      activeBindingCount: 1,
      risks: []
    })
    expect(scorecard.score).toBeGreaterThanOrEqual(80)
    expect(formatDirectionScorecardForAgent(scorecard)).toContain('readiness=ready')
  })

  it('surfaces missing flow, review, implementation, and binding risks', () => {
    const direction: DesignDirectionGroup = {
      id: 'dir_draft',
      name: 'Draft direction',
      status: 'active',
      artifacts: [
        artifact('home', { title: 'Home' }),
        artifact('checkout', { title: 'Checkout', previewStatus: 'error' }),
        artifact('thanks', { title: 'Thanks' })
      ]
    }
    const doc = createEmptyDocument()
    const home = createHtmlFrameShape('Home', 0, 0, 'home', 'desktop')
    doc.objects[home.id] = { ...home, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [home.id] }
    doc.codeBindings = [{
      id: 'binding_old',
      designObjectId: home.id,
      kind: 'route',
      status: 'stale',
      createdAt,
      target: { routePath: '/old' }
    }]

    const scorecard = buildDesignDirectionScorecard(direction, doc)

    expect(scorecard.readiness).toBe('blocked')
    expect(scorecard.implementationCost).toBe('high')
    expect(scorecard.risks).toEqual([
      'preview-errors',
      'missing-flow',
      'no-rationale',
      'unreviewed',
      'not-implemented',
      'missing-code-bindings',
      'stale-code-bindings'
    ])
    expect(scorecard.score).toBeLessThan(50)
  })
})
