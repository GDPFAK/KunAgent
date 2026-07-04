import { describe, expect, it } from 'vitest'
import {
  createDefaultShape,
  createEmptyDocument,
  createHtmlFrameShape,
  ROOT_SHAPE_ID,
  type CanvasDocument
} from '../canvas/canvas-types'
import type { DesignSystem } from '../canvas/design-system-types'
import { createAgentNoteShape } from '../agent-notes/agent-note-shapes'
import type { DesignArtifact, DesignDocument } from '../design-types'
import {
  buildDesignModeSurfaceManifest,
  designModeSurfaceSummaryLines
} from './design-mode-surface'

const now = '2026-07-02T00:00:00.000Z'

function artifact(): DesignArtifact {
  return {
    id: 'home',
    kind: 'html',
    title: 'Home',
    relativePath: '.kun-design/doc/home/v1.html',
    designMdPath: '.kun-design/doc/home/DESIGN.md',
    createdAt: now,
    updatedAt: now,
    versions: [{ id: 'home-v1', relativePath: '.kun-design/doc/home/v1.html', createdAt: now, summary: '' }],
    direction: { id: 'dir_home', name: 'Home direction', status: 'active' }
  }
}

function documentWithArtifacts(artifacts: DesignArtifact[]): DesignDocument {
  return {
    id: 'doc',
    title: 'Ops app',
    createdAt: now,
    updatedAt: now,
    order: 0,
    artifacts,
    activeArtifactId: artifacts[0]?.id ?? null
  }
}

function canvasDocument(): CanvasDocument {
  const doc = createEmptyDocument()
  const frame = {
    ...createHtmlFrameShape('Home', 10, 20, 'home', 'desktop'),
    id: 'frame_home',
    parentId: ROOT_SHAPE_ID
  }
  const image = {
    ...createDefaultShape('image', 1320, 20),
    id: 'asset_logo',
    name: 'Logo',
    parentId: ROOT_SHAPE_ID,
    imageUrl: '.kun-design/assets/logo.png'
  }
  const note = {
    ...createAgentNoteShape(
      {
        kind: 'critique',
        body: 'Primary CTA needs stronger contrast.',
        source: 'critic',
        severity: 'warning',
        targetIds: ['frame_home'],
        directionId: 'dir_home'
      },
      { x: 20, y: 920, createdAt: now }
    ),
    id: 'note_1',
    parentId: ROOT_SHAPE_ID
  }
  doc.objects[ROOT_SHAPE_ID] = { ...doc.objects[ROOT_SHAPE_ID], children: [frame.id, image.id, note.id] }
  doc.objects[frame.id] = frame
  doc.objects[image.id] = image
  doc.objects[note.id] = note
  doc.operationJournal = [
    {
      id: 'journal_1',
      label: 'Critique home',
      createdAt: now,
      status: 'applied',
      affectedIds: ['frame_home'],
      errors: [],
      operations: [
        {
          id: 'op_1',
          type: 'lint_design',
          label: 'Critique home',
          source: 'agent',
          createdAt: now,
          targetIds: ['frame_home'],
          payload: {}
        }
      ]
    }
  ]
  doc.codeBindings = [
    {
      id: 'binding_1',
      designObjectId: 'frame_home',
      kind: 'component',
      status: 'active',
      createdAt: now,
      target: { sourceFile: 'src/Home.tsx', componentName: 'HomeView' }
    }
  ]
  return doc
}

const designSystem: DesignSystem = {
  tokens: {
    'brand/primary': { name: 'brand/primary', kind: 'color', value: '#2563eb' }
  },
  components: {}
}

describe('design mode surface manifest', () => {
  it('maps agent, canvas, tools, whiteboard, code, and handoff into a mode contract', () => {
    const artifacts = [artifact()]
    const manifest = buildDesignModeSurfaceManifest({
      document: documentWithArtifacts(artifacts),
      canvasDocument: canvasDocument(),
      designSystem,
      artifacts
    })

    expect(manifest).toMatchObject({
      version: 1,
      kind: 'kun.design.mode-surface',
      document: { id: 'doc', title: 'Ops app' },
      counts: {
        screenCount: 1,
        directionCount: 1,
        objectCount: 3,
        tokenCount: 1,
        assetCount: 1,
        activeBindingCount: 1,
        operationCount: 1,
        critiqueEntryCount: 1,
        agentNoteCount: 1
      },
      recommendedSurfaceId: 'handoff',
      workflow: {
        kind: 'kun.design.mode-workflow',
        recommendedStepId: 'repair-review-notes'
      }
    })
    expect(manifest.workflow.steps.map((step) => step.id)).toEqual([
      'plan-directions',
      'generate-first-screen',
      'generate-directions',
      'extract-design-system',
      'critique-current-direction',
      'repair-review-notes',
      'bind-code',
      'implement-bound-changes',
      'export-handoff'
    ])
    expect(manifest.surfaces).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'agent', status: 'active', toolIds: expect.arrayContaining(['design.plan']) }),
      expect.objectContaining({ id: 'canvas', status: 'active', resourceKinds: expect.arrayContaining(['board']) }),
      expect.objectContaining({ id: 'design-tools', status: 'active' }),
      expect.objectContaining({ id: 'whiteboard', status: 'active' }),
      expect.objectContaining({ id: 'code-bridge', status: 'active' }),
      expect.objectContaining({ id: 'handoff', status: 'ready' })
    ]))
    expect(designModeSurfaceSummaryLines(manifest)).toContain(
      '- code-bridge (active): 78/100; tools design.bind_code, design.implement; 1 active binding(s); 0 running app frame(s)'
    )
  })

  it('recommends code binding after the first generated screen has no bridge yet', () => {
    const artifacts = [artifact()]
    const doc = canvasDocument()
    doc.codeBindings = []
    doc.operationJournal = []

    const manifest = buildDesignModeSurfaceManifest({
      document: documentWithArtifacts(artifacts),
      canvasDocument: doc,
      designSystem: { tokens: {}, components: {} },
      artifacts
    })

    expect(manifest.recommendedSurfaceId).toBe('code-bridge')
    expect(manifest.workflow.recommendedStepId).toBe('extract-design-system')
    expect(manifest.surfaces.find((surface) => surface.id === 'code-bridge')).toMatchObject({
      status: 'needs-setup',
      healthScore: 20
    })
  })
})
