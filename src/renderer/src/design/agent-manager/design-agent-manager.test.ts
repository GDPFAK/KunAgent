import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createHtmlFrameShape, ROOT_SHAPE_ID, type CanvasDocument } from '../canvas/canvas-types'
import type { DesignSystem } from '../canvas/design-system-types'
import type { DesignArtifact, DesignDocument } from '../design-types'
import { buildDesignAgentManagerModel } from './design-agent-manager'

const now = '2026-06-29T00:00:00.000Z'
const emptySystem: DesignSystem = { tokens: {}, components: {} }

function artifact(id: string, directionId?: string): DesignArtifact {
  const relativePath = `.kun-design/doc/${id}/v1.html`
  return {
    id,
    kind: 'html',
    title: id,
    relativePath,
    designMdPath: `.kun-design/doc/${id}/DESIGN.md`,
    createdAt: now,
    updatedAt: now,
    versions: [{ id: `${id}-v1`, relativePath, createdAt: now, summary: '' }],
    ...(directionId
      ? { direction: { id: directionId, name: `Direction ${directionId}`, status: 'active' as const } }
      : {})
  }
}

function designDocument(artifacts: DesignArtifact[]): DesignDocument {
  return {
    id: 'doc',
    title: 'Project',
    createdAt: now,
    updatedAt: now,
    order: 0,
    artifacts,
    activeArtifactId: artifacts[0]?.id ?? null
  }
}

function canvasWithScreen(): CanvasDocument {
  const doc = createEmptyDocument()
  const frame = {
    ...createHtmlFrameShape('Home', 0, 0, 'home', 'desktop'),
    id: 'frame_home',
    parentId: ROOT_SHAPE_ID
  }
  doc.objects[ROOT_SHAPE_ID] = { ...doc.objects[ROOT_SHAPE_ID], children: [frame.id] }
  doc.objects[frame.id] = frame
  return doc
}

describe('design agent manager', () => {
  it('marks critic and code binder blocked when there is no screen yet', () => {
    const model = buildDesignAgentManagerModel({
      document: designDocument([]),
      canvasDocument: createEmptyDocument(),
      designSystem: emptySystem,
      pagesRun: null,
      parallelPageStates: {}
    })

    expect(model.screenCount).toBe(0)
    expect(model.roles.map((role) => [role.id, role.status])).toEqual([
      ['planner', 'idle'],
      ['generator', 'idle'],
      ['systemizer', 'blocked'],
      ['critic', 'blocked'],
      ['code-binder', 'blocked'],
      ['exporter', 'idle']
    ])
    expect(model.roles.find((role) => role.id === 'planner')).toMatchObject({
      intentMode: 'generate',
      workflowStepId: 'plan-directions',
      workflowToolId: 'design.plan',
      actionPrompt: expect.stringContaining('Suggested tool call: design.plan')
    })
    expect(model.roles.find((role) => role.id === 'generator')).toMatchObject({
      intentMode: 'generate',
      actionPrompt: expect.stringContaining('Act as the screen generation agent')
    })
    expect(model.roles.find((role) => role.id === 'systemizer')).toMatchObject({
      workflowStepId: 'extract-design-system',
      workflowToolId: 'design.system'
    })
    expect(model.roles.find((role) => role.id === 'critic')?.actionPrompt).toBeUndefined()
    expect(model.roles.find((role) => role.id === 'code-binder')?.actionPrompt).toBeUndefined()
  })

  it('summarizes directions, generated screens, and export readiness', () => {
    const model = buildDesignAgentManagerModel({
      document: designDocument([artifact('home', 'a'), artifact('settings', 'b')]),
      canvasDocument: canvasWithScreen(),
      designSystem: {
        tokens: { 'brand/primary': { name: 'brand/primary', kind: 'color', value: '#2563eb' } },
        components: {}
      },
      pagesRun: null,
      parallelPageStates: {}
    })

    expect(model).toMatchObject({
      screenCount: 2,
      directionCount: 2,
      objectCount: 1,
      readyCount: 4
    })
    expect(model.roles.find((role) => role.id === 'planner')).toMatchObject({
      status: 'ready',
      detailOptions: { directions: 2, screens: 2 }
    })
    expect(model.roles.find((role) => role.id === 'exporter')).toMatchObject({
      status: 'ready',
      detailOptions: { screens: 2, objects: 1 },
      intentMode: 'preview',
      actionPrompt: expect.stringContaining('Act as the design handoff agent')
    })
    expect(model.roles.find((role) => role.id === 'systemizer')).toMatchObject({
      status: 'ready',
      detailOptions: { tokens: 1, components: 0 },
      intentMode: 'modify',
      workflowStepId: 'extract-design-system',
      workflowToolId: 'design.system',
      actionPrompt: expect.stringContaining('Suggested tool call: design.system')
    })
    expect(model.roles.find((role) => role.id === 'critic')).toMatchObject({
      intentMode: 'modify',
      actionPrompt: expect.stringContaining('Act as the design critic agent')
    })
    expect(model.roles.find((role) => role.id === 'code-binder')).toMatchObject({
      intentMode: 'modify',
      actionPrompt: expect.stringContaining('Act as the code binding agent')
    })
  })

  it('tracks running multi-screen generation progress', () => {
    const model = buildDesignAgentManagerModel({
      document: designDocument([artifact('home')]),
      canvasDocument: canvasWithScreen(),
      designSystem: emptySystem,
      pagesRun: { phase: 'generating', total: 3, done: 1, title: 'Settings' },
      parallelPageStates: {}
    })

    expect(model.runningCount).toBe(1)
    expect(model.recommendedRoleId).toBe('generator')
    expect(model.roles.find((role) => role.id === 'generator')).toMatchObject({
      status: 'running',
      progress: { done: 1, total: 3 },
      actionPrompt: expect.stringContaining('Act as the screen generation agent')
    })
  })

  it('shows code binder and critic readiness from bindings and journal entries', () => {
    const doc = canvasWithScreen()
    doc.codeBindings = [
      {
        id: 'binding_1',
        designObjectId: 'frame_home',
        kind: 'component',
        status: 'active',
        createdAt: now,
        target: { sourceFile: 'src/Home.tsx' }
      }
    ]
    doc.operationJournal = [
      {
        id: 'journal_1',
        label: 'Critique selected frame',
        createdAt: now,
        status: 'applied',
        operations: [],
        affectedIds: ['frame_home'],
        errors: []
      }
    ]

    const model = buildDesignAgentManagerModel({
      document: designDocument([artifact('home')]),
      canvasDocument: doc,
      designSystem: emptySystem,
      pagesRun: null,
      parallelPageStates: {}
    })

    expect(model.roles.find((role) => role.id === 'critic')).toMatchObject({
      status: 'ready',
      detailOptions: { count: 1 }
    })
    expect(model.roles.find((role) => role.id === 'code-binder')).toMatchObject({
      status: 'ready',
      detailOptions: { active: 1, stale: 0, missing: 0 }
    })
  })
})
