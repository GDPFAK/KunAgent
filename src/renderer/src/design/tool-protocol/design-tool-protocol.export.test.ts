import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyDocument, createHtmlFrameShape } from '../canvas/canvas-types'
import { useCanvasShapeStore } from '../canvas/canvas-shape-store'
import { useCanvasUndoStore } from '../canvas/canvas-undo-store'
import { useDesignSystemStore } from '../canvas/design-system-store'
import type { DesignDocument } from '../design-types'
import { useDesignWorkspaceStore } from '../design-workspace-store'
import { clearDesignOperationJournal } from '../graph/design-operation-journal'
import { executeDesignToolInvocation } from './design-tool-protocol'

const createdAt = '2026-07-02T00:00:00.000Z'

beforeEach(() => {
  useCanvasShapeStore.getState().loadDocument(createEmptyDocument())
  useCanvasUndoStore.getState().clear()
  useDesignSystemStore.getState().resetSystem()
  useDesignWorkspaceStore.setState({
    workspaceRoot: '',
    documents: [],
    activeDocumentId: null,
    artifacts: [],
    activeArtifactId: null,
    designContext: { designTarget: 'web' },
    parallelPageStates: {},
    pagesRun: null
  })
  clearDesignOperationJournal()
})

describe('design.export package output', () => {
  it('exports a Stitch/Penpot/code handoff package with resources and bindings', () => {
    const doc = createEmptyDocument()
    const homeFrame = createHtmlFrameShape('Home', 0, 0, 'artifact_home', 'desktop')
    const settingsFrame = createHtmlFrameShape('Settings', 1400, 0, 'artifact_settings', 'desktop')
    doc.objects[homeFrame.id] = { ...homeFrame, parentId: doc.rootId }
    doc.objects[settingsFrame.id] = { ...settingsFrame, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [homeFrame.id, settingsFrame.id] }
    doc.codeBindings = [{
      id: 'binding_home',
      designObjectId: homeFrame.id,
      kind: 'route',
      target: { routePath: '/', sourceFile: 'src/app/page.tsx' },
      status: 'active',
      createdAt
    }]
    useCanvasShapeStore.getState().loadDocument(doc)

    const artifacts: DesignDocument['artifacts'] = [
      {
        id: 'artifact_home',
        kind: 'html',
        title: 'Home',
        relativePath: '.kun-design/doc/artifact_home/v1.html',
        designMdPath: '.kun-design/doc/artifact_home/DESIGN.md',
        createdAt,
        updatedAt: createdAt,
        versions: [{ id: 'artifact_home-v1', relativePath: '.kun-design/doc/artifact_home/v1.html', createdAt, summary: 'Home screen' }],
        direction: { id: 'dir_calm', name: 'Calm operator', status: 'active' },
        prototypeLinks: [{ targetTitle: 'Settings', targetArtifactId: 'artifact_settings', href: './settings.html', label: 'Configure routing' }]
      },
      {
        id: 'artifact_settings',
        kind: 'html',
        title: 'Settings',
        relativePath: '.kun-design/doc/artifact_settings/v1.html',
        designMdPath: '.kun-design/doc/artifact_settings/DESIGN.md',
        createdAt,
        updatedAt: createdAt,
        versions: [{ id: 'artifact_settings-v1', relativePath: '.kun-design/doc/artifact_settings/v1.html', createdAt, summary: 'Settings screen' }],
        direction: { id: 'dir_calm', name: 'Calm operator', status: 'active' }
      }
    ]
    const document: DesignDocument = {
      id: 'doc',
      title: 'Routing redesign',
      createdAt,
      updatedAt: createdAt,
      order: 0,
      artifacts,
      activeArtifactId: artifacts[0].id
    }
    useDesignWorkspaceStore.setState({
      documents: [document],
      activeDocumentId: document.id,
      artifacts,
      activeArtifactId: artifacts[0].id,
      designContext: { designTarget: 'web', tone: ['专业'] }
    })
    useDesignSystemStore.getState().loadSystem({
      tokens: { 'brand/primary': { name: 'brand/primary', kind: 'color', value: '#0f766e' } },
      components: {}
    })

    const result = executeDesignToolInvocation({
      toolId: 'design.export',
      input: { format: 'package', brief: 'Prepare routing handoff.' }
    })
    const output = result.output as {
      format: string
      markdown: string
      counts: { screens: number; codeBindings: number; tokens: number }
      resources: Array<{ kind: string; path: string; artifactId?: string; frameId?: string }>
      directions: Array<{ id: string; name: string; screenCount: number }>
      codeBindings: { count: number; entries: Array<{ id: string; sourceFile?: string }> }
    }

    expect(result).toMatchObject({ ok: true, status: 'ready' })
    expect(output.format).toBe('package')
    expect(output.counts).toMatchObject({ screens: 2, codeBindings: 1, tokens: 1 })
    expect(output.markdown).toContain('# DESIGN.md: Routing redesign')
    expect(output.markdown).toContain('Configure routing -> Settings')
    expect(output.resources).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'project-design-md', path: '.kun-design/DESIGN.md' }),
      expect.objectContaining({ kind: 'html', path: '.kun-design/doc/artifact_home/v1.html', artifactId: 'artifact_home', frameId: homeFrame.id }),
      expect.objectContaining({ kind: 'screen-design-md', path: '.kun-design/doc/artifact_home/DESIGN.md', artifactId: 'artifact_home' }),
      expect.objectContaining({ kind: 'graph-json', path: '.kun-design/design-graph.json' })
    ]))
    expect(output.directions).toEqual([
      expect.objectContaining({ id: 'dir_calm', name: 'Calm operator', screenCount: 2 })
    ])
    expect(output.codeBindings).toMatchObject({
      count: 1,
      entries: [{ id: 'binding_home', sourceFile: 'src/app/page.tsx' }]
    })
  })
})
