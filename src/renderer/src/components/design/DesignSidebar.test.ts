import { describe, expect, it } from 'vitest'
import type { DesignArtifact, DesignDocument } from '../../design/design-types'
import {
  getDesignSidebarDocumentLabel,
  getDesignSidebarDocumentScreenCount,
  getDesignSidebarVisibleArtifacts
} from './DesignSidebar'

function artifact(id: string, kind: DesignArtifact['kind'], patch: Partial<DesignArtifact> = {}): DesignArtifact {
  const createdAt = '2026-06-20T00:00:00.000Z'
  const relativePath = kind === 'canvas' ? `.kun-design/${id}/canvas.json` : `.kun-design/${id}/v1.html`
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

describe('DesignSidebar helpers', () => {
  it('hides board-hidden screens from sidebar lists', () => {
    const visibleScreen = artifact('visible-screen', 'html')
    const hiddenScreen = artifact('hidden-screen', 'html', {
      node: { x: 40, y: 60, width: 390, height: 844, sizeMode: 'auto', boardHidden: true }
    })
    const canvas = artifact('board', 'canvas')

    expect(getDesignSidebarVisibleArtifacts([visibleScreen, hiddenScreen, canvas]).map((item) => item.id)).toEqual([
      'visible-screen',
      'board'
    ])
  })

  it('counts visible screens instead of implementation canvas artifacts', () => {
    const doc: Pick<DesignDocument, 'artifacts'> = {
      artifacts: [
        artifact('board', 'canvas'),
        artifact('hidden-screen', 'html', {
          node: { x: 40, y: 60, width: 390, height: 844, sizeMode: 'auto', boardHidden: true }
        }),
        artifact('visible-screen', 'html')
      ]
    }

    expect(getDesignSidebarDocumentScreenCount(doc)).toBe(1)
  })

  it('uses the document ID as the sidebar label', () => {
    expect(getDesignSidebarDocumentLabel({ id: 'a1b2c3d4' })).toBe('a1b2c3d4')
  })
})
