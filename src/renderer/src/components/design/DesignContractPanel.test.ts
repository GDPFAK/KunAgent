import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasShapeStore } from '../../design/canvas/canvas-shape-store'
import { createEmptyDocument } from '../../design/canvas/canvas-types'
import { useDesignSystemStore } from '../../design/canvas/design-system-store'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'
import type { DesignDocument } from '../../design/design-types'
import { DesignContractPanel } from './DesignContractPanel'

const now = '2026-07-02T00:00:00.000Z'

function document(): DesignDocument {
  return {
    id: 'doc',
    title: 'Checkout redesign',
    createdAt: now,
    updatedAt: now,
    order: 0,
    artifacts: [],
    activeArtifactId: null
  }
}

describe('DesignContractPanel', () => {
  beforeEach(() => {
    useCanvasShapeStore.setState({ document: createEmptyDocument(), documentKey: null })
    useDesignSystemStore.setState({ system: { tokens: {}, components: {} } })
    useDesignWorkspaceStore.setState({ designContext: { designTarget: 'web' } })
  })

  it('renders DESIGN.md export and agent handoff actions', () => {
    const html = renderToStaticMarkup(
      createElement(DesignContractPanel, {
        workspaceRoot: '/workspace',
        document: document(),
        onSeedPrompt: () => {}
      })
    )

    expect(html).toContain('Design contract')
    expect(html).toContain('Project DESIGN.md')
    expect(html).toContain('Prepare handoff package')
    expect(html).toContain('design.export')
  })

  it('renders nothing without an active design document', () => {
    expect(renderToStaticMarkup(
      createElement(DesignContractPanel, {
        workspaceRoot: '/workspace',
        document: null
      })
    )).toBe('')
  })
})
