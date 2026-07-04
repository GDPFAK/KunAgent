import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasSelectionStore } from '../../design/canvas/canvas-selection-store'
import { useCanvasShapeStore } from '../../design/canvas/canvas-shape-store'
import { createEmptyDocument } from '../../design/canvas/canvas-types'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'
import { DesignGeneratorLanePanel } from './DesignGeneratorLanePanel'

describe('DesignGeneratorLanePanel', () => {
  beforeEach(() => {
    useCanvasShapeStore.setState({ document: createEmptyDocument(), documentKey: null })
    useCanvasSelectionStore.setState({
      selectedIds: new Set(),
      editingId: null,
      hoverTargetId: null,
      marqueeRect: null,
      activeSnapGuides: []
    })
    useDesignWorkspaceStore.setState({
      designContext: { designTarget: 'web' },
      canvasAssistantOpen: false,
      designIntentMode: 'generate'
    })
  })

  it('renders OpenUI actions with their design tool protocol ids', () => {
    const html = renderToStaticMarkup(createElement(DesignGeneratorLanePanel, { onSeedPrompt: () => {} }))

    expect(html).toContain('Generator lane')
    expect(html).toContain('design.generate_screen')
    expect(html).toContain('design.generate_directions')
    expect(html).toContain('design.critique')
    expect(html).toContain('design.system')
  })
})
