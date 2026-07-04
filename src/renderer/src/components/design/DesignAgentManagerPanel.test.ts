import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasShapeStore } from '../../design/canvas/canvas-shape-store'
import { createEmptyDocument } from '../../design/canvas/canvas-types'
import { useDesignSystemStore } from '../../design/canvas/design-system-store'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'
import type { DesignDocument } from '../../design/design-types'
import { DesignAgentManagerPanel } from './DesignAgentManagerPanel'

const now = '2026-07-02T00:00:00.000Z'

function designDocument(): DesignDocument {
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

describe('DesignAgentManagerPanel', () => {
  beforeEach(() => {
    useCanvasShapeStore.setState({ document: createEmptyDocument(), documentKey: null })
    useDesignSystemStore.setState({ system: { tokens: {}, components: {} } })
    useDesignWorkspaceStore.setState({ pagesRun: null, parallelPageStates: {} })
  })

  it('renders runnable design agent role controls', () => {
    const html = renderToStaticMarkup(
      createElement(DesignAgentManagerPanel, {
        document: designDocument(),
        onSeedPrompt: () => {}
      })
    )

    expect(html).toContain('Agent manager')
    expect(html).toContain('Systemizer')
    expect(html).toContain('extract-design-system · design.system')
    expect(html).toContain('aria-label="Run this design agent"')
    expect(html).toContain('aria-label="This design agent is unavailable"')
  })

  it('renders nothing without an active design document', () => {
    expect(renderToStaticMarkup(createElement(DesignAgentManagerPanel, { document: null }))).toBe('')
  })
})
