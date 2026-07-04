import { describe, expect, it } from 'vitest'
import type { DesignArtifact } from './design-types'
import {
  buildDesignDirectionComparison,
  buildDesignDirectionScreenMatrix,
  canImplementDesignArtifact,
  collectAgentDrawingArtifactIds,
  groupDesignArtifacts
} from './design-artifact-actions'
import { useDesignWorkspaceStore } from './design-workspace-store'

function artifact(id: string, kind: DesignArtifact['kind'], patch: Partial<DesignArtifact> = {}): DesignArtifact {
  const createdAt = '2026-06-20T00:00:00.000Z'
  const relativePath =
    kind === 'canvas' ? `.kun-design/${id}/canvas.json` : `.kun-design/${id}/v1.html`
  return {
    id,
    kind,
    title: id,
    relativePath,
    createdAt,
    updatedAt: createdAt,
    versions: [{ id: `${id}-v1`, relativePath, createdAt, summary: '' }],
    ...patch
  }
}

describe('design artifact actions', () => {
  it('groups HTML drafts separately from design canvases while preserving order', () => {
    const first = artifact('first-html', 'html')
    const canvas = artifact('canvas', 'canvas')
    const second = artifact('second-html', 'html')

    expect(groupDesignArtifacts([first, canvas, second])).toEqual({
      html: [first, second],
      canvas: [canvas],
      directions: [],
      archivedDirections: []
    })
  })

  it('builds direction groups from HTML artifacts while preserving draft grouping', () => {
    const first = {
      ...artifact('first-html', 'html'),
      direction: { id: 'dir_1', name: 'Checkout direction', status: 'active' as const }
    }
    const second = {
      ...artifact('second-html', 'html'),
      direction: { id: 'dir_1', name: 'Checkout direction', status: 'active' as const }
    }

    expect(groupDesignArtifacts([first, second], new Set(['second-html']))).toEqual({
      html: [first],
      canvas: [],
      directions: [
        {
          id: 'dir_1',
          name: 'Checkout direction',
          status: 'active',
          artifacts: [first, second]
        }
      ],
      archivedDirections: []
    })
  })

  it('moves archived direction groups out of the active direction list', () => {
    const accepted = {
      ...artifact('accepted-html', 'html'),
      direction: { id: 'dir_1', name: 'Accepted direction', status: 'accepted' as const }
    }
    const archived = {
      ...artifact('archived-html', 'html'),
      direction: { id: 'dir_2', name: 'Old direction', status: 'archived' as const }
    }

    expect(groupDesignArtifacts([accepted, archived])).toEqual({
      html: [accepted, archived],
      canvas: [],
      directions: [
        {
          id: 'dir_1',
          name: 'Accepted direction',
          status: 'accepted',
          artifacts: [accepted]
        }
      ],
      archivedDirections: [
        {
          id: 'dir_2',
          name: 'Old direction',
          status: 'archived',
          artifacts: [archived]
        }
      ]
    })
  })

  it('does not treat board-hidden HTML artifacts as agent drawings', () => {
    const visibleLinked = artifact('visible-linked', 'html')
    const hidden = artifact('hidden-screen', 'html', {
      node: { x: 40, y: 60, width: 390, height: 844, sizeMode: 'auto', boardHidden: true }
    })
    const looseDraft = artifact('loose-draft', 'html')
    const grouped = groupDesignArtifacts([visibleLinked, hidden, looseDraft], new Set(['visible-linked']))
    const agentIds = collectAgentDrawingArtifactIds(
      [visibleLinked, hidden, looseDraft],
      grouped,
      new Set(['visible-linked'])
    )

    expect([...agentIds].sort()).toEqual(['visible-linked'])
    expect(grouped.html.map((item) => item.id)).toEqual(['hidden-screen', 'loose-draft'])
  })

  it('builds direction comparison rows with shared and unique screens', () => {
    const checkoutA = artifact('checkout-a', 'html', {
      title: 'Checkout',
      updatedAt: '2026-06-20T01:00:00.000Z',
      implementedAt: '2026-06-20T02:00:00.000Z',
      prototypeLinks: [{ targetTitle: 'Thanks', targetArtifactId: 'thanks-a' }]
    })
    const thanksA = artifact('thanks-a', 'html', { title: 'Thanks' })
    const checkoutB = artifact('checkout-b', 'html', {
      title: 'checkout',
      updatedAt: '2026-06-20T03:00:00.000Z'
    })
    const upsellB = artifact('upsell-b', 'html', {
      title: 'Upsell',
      prototypeLinks: [
        { targetTitle: 'Checkout', targetArtifactId: 'checkout-b' },
        { targetTitle: 'Thanks' }
      ]
    })

    expect(
      buildDesignDirectionComparison([
        { id: 'dir_a', name: 'Fast checkout', status: 'active', artifacts: [checkoutA, thanksA] },
        { id: 'dir_b', name: 'Revenue checkout', status: 'accepted', artifacts: [checkoutB, upsellB] }
      ])
    ).toEqual({
      sharedScreenTitles: ['Checkout'],
      rows: [
        {
          id: 'dir_a',
          name: 'Fast checkout',
          status: 'active',
          screenCount: 2,
          prototypeLinkCount: 1,
          implementedCount: 1,
          latestUpdatedAt: '2026-06-20T01:00:00.000Z',
          uniqueScreenTitles: ['Thanks']
        },
        {
          id: 'dir_b',
          name: 'Revenue checkout',
          status: 'accepted',
          screenCount: 2,
          prototypeLinkCount: 2,
          implementedCount: 0,
          latestUpdatedAt: '2026-06-20T03:00:00.000Z',
          uniqueScreenTitles: ['Upsell']
        }
      ]
    })
  })

  it('builds a direction screen matrix for synchronized visual comparison', () => {
    const checkoutA = artifact('checkout-a', 'html', { title: ' Checkout ' })
    const duplicateCheckoutA = artifact('checkout-a-duplicate', 'html', { title: 'checkout' })
    const settingsA = artifact('settings-a', 'html', { title: 'Settings' })
    const checkoutB = artifact('checkout-b', 'html', { title: 'checkout' })
    const upsellB = artifact('upsell-b', 'html', { title: 'Upsell' })
    const checkoutC = artifact('checkout-c', 'html', { title: 'CHECKOUT' })
    const settingsC = artifact('settings-c', 'html', { title: 'Settings' })

    expect(
      buildDesignDirectionScreenMatrix([
        {
          id: 'dir_a',
          name: 'Fast checkout',
          status: 'active',
          artifacts: [checkoutA, duplicateCheckoutA, settingsA]
        },
        { id: 'dir_b', name: 'Revenue checkout', status: 'active', artifacts: [checkoutB, upsellB] },
        { id: 'dir_c', name: 'Support checkout', status: 'active', artifacts: [checkoutC, settingsC] }
      ])
    ).toEqual([
      {
        key: 'checkout',
        title: 'Checkout',
        artifactIdsByDirectionId: {
          dir_a: 'checkout-a',
          dir_b: 'checkout-b',
          dir_c: 'checkout-c'
        },
        coverageCount: 3,
        shared: true
      },
      {
        key: 'settings',
        title: 'Settings',
        artifactIdsByDirectionId: {
          dir_a: 'settings-a',
          dir_c: 'settings-c'
        },
        coverageCount: 2,
        shared: false
      },
      {
        key: 'upsell',
        title: 'Upsell',
        artifactIdsByDirectionId: {
          dir_b: 'upsell-b'
        },
        coverageCount: 1,
        shared: false
      }
    ])
  })

  it('only allows HTML design artifacts to be implemented directly', () => {
    expect(canImplementDesignArtifact(artifact('draft', 'html'))).toBe(true)
    expect(canImplementDesignArtifact(artifact('design', 'canvas'))).toBe(false)
    expect(canImplementDesignArtifact(null)).toBe(false)
  })

  it('does not expose retired design agent panel visibility state', () => {
    expect(useDesignWorkspaceStore.getState()).not.toHaveProperty('agentPanelOpen')
    expect(useDesignWorkspaceStore.getState()).not.toHaveProperty('setAgentPanelOpen')
  })
})
