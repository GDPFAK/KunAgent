import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasSelectionStore } from '../../design/canvas/canvas-selection-store'
import { useCanvasShapeStore } from '../../design/canvas/canvas-shape-store'
import { createEmptyDocument } from '../../design/canvas/canvas-types'
import { useDesignSystemStore } from '../../design/canvas/design-system-store'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'
import type { DesignDocument } from '../../design/design-types'
import { DesignModeSurfacePanel } from './DesignModeSurfacePanel'

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

describe('DesignModeSurfacePanel', () => {
  beforeEach(() => {
    useCanvasShapeStore.setState({ document: createEmptyDocument(), documentKey: null })
    useCanvasSelectionStore.setState({
      selectedIds: new Set(),
      editingId: null,
      hoverTargetId: null,
      marqueeRect: null,
      activeSnapGuides: []
    })
    useDesignSystemStore.setState({ system: { tokens: {}, components: {} } })
    useDesignWorkspaceStore.setState({
      artifacts: [],
      designContext: { designTarget: 'web' },
      canvasAssistantOpen: false,
      designIntentMode: 'generate'
    })
  })

  it('renders the executable recommended workflow step', () => {
    const html = renderToStaticMarkup(
      createElement(DesignModeSurfacePanel, {
        document: designDocument(),
        onSeedPrompt: () => {}
      })
    )

    expect(html).toContain('aria-label="Run recommended next step"')
    expect(html).toContain('Next: plan-directions · design.plan')
    expect(html).toContain('goal: Plan named design directions')
    expect(html).toContain('generate-first-screen')
    expect(html).toContain('0 direction(s) and 0 screen(s) in the active design.')
  })

  it('renders nothing without an active design document', () => {
    expect(renderToStaticMarkup(createElement(DesignModeSurfacePanel, { document: null }))).toBe('')
  })
})
