import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument, createHtmlFrameShape, ROOT_SHAPE_ID } from '../../design/canvas/canvas-types'
import type { DesignDirectionGroup } from '../../design/design-artifact-actions'
import type { DesignArtifact } from '../../design/design-types'
import { DesignDirectionManagerPanel } from './DesignDirectionManagerPanel'

const now = '2026-07-02T00:00:00.000Z'

function artifact(id: string, patch: Partial<DesignArtifact> = {}): DesignArtifact {
  const relativePath = `.kun-design/doc/${id}/v1.html`
  return {
    id,
    kind: 'html',
    title: id,
    relativePath,
    createdAt: now,
    updatedAt: now,
    versions: [{ id: `${id}-v1`, relativePath, createdAt: now, summary: '' }],
    ...patch
  }
}

describe('DesignDirectionManagerPanel', () => {
  it('renders direction scorecard action tools', () => {
    const direction: DesignDirectionGroup = {
      id: 'dir_fast',
      name: 'Fast checkout',
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

    const html = renderToStaticMarkup(
      createElement(DesignDirectionManagerPanel, {
        workspaceRoot: '/workspace',
        canvasDocument: doc,
        directions: [direction],
        archivedDirections: [],
        activeArtifactId: null,
        onSelectArtifact: vi.fn(),
        onSetDirectionStatus: vi.fn(),
        onSeedPrompt: vi.fn()
      })
    )

    expect(html).toContain('Directions')
    expect(html).toContain('Critique direction · design.critique')
    expect(html).toContain('aria-label="Critique direction"')
  })
})
