import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from './canvas/canvas-types'
import { buildDesignModeSurfaceManifest } from './design-mode/design-mode-surface'
import { buildDesignTurnPrompt } from './design-turn-prompt'
import type { DesignDocument } from './design-types'

const now = '2026-07-02T00:00:00.000Z'

function document(): DesignDocument {
  return {
    id: 'doc',
    title: 'Ops app',
    createdAt: now,
    updatedAt: now,
    order: 0,
    artifacts: [],
    activeArtifactId: null
  }
}

describe('design turn prompt design mode context', () => {
  it('injects the Stitch-style workflow contract into the design canvas prompt', () => {
    const manifest = buildDesignModeSurfaceManifest({
      document: document(),
      canvasDocument: createEmptyDocument(),
      designSystem: { tokens: {}, components: {} },
      artifacts: []
    })
    const prompt = buildDesignTurnPrompt({
      target: 'canvas',
      mode: 'text',
      text: 'Start a dashboard direction',
      artifactRelativePath: '.kun-design/doc/board.canvas.json',
      workspaceRoot: '/workspace',
      designModeManifest: manifest
    })

    expect(prompt).toContain('Design mode workflow contract:')
    expect(prompt).toContain('Recommended step: plan-directions via design.plan on agent')
    expect(prompt).toContain('Recommendation reason: 0 direction(s) and 0 screen(s) in the active design.')
    expect(prompt).toContain('Suggested tool call: design.plan')
    expect(prompt).toContain('Tool input seed:')
    expect(prompt).toContain('Use the recommended step as the default tool lane')
    expect(prompt).toContain('Workflow:')
  })

  it('keeps the design-mode workflow contract out of the code whiteboard prompt', () => {
    const manifest = buildDesignModeSurfaceManifest({
      document: document(),
      canvasDocument: createEmptyDocument(),
      designSystem: { tokens: {}, components: {} },
      artifacts: []
    })
    const prompt = buildDesignTurnPrompt({
      target: 'canvas',
      mode: 'text',
      text: 'Sketch an API flow',
      artifactRelativePath: '.kun-design/doc/board.canvas.json',
      workspaceRoot: '/workspace',
      canvasSurface: 'code',
      designModeManifest: manifest
    })

    expect(prompt).not.toContain('Design mode workflow contract:')
    expect(prompt).toContain('Code sidebar whiteboard')
  })
})
