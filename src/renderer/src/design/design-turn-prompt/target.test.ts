import { describe, expect, it, vi } from 'vitest'
import {
  createDefaultShape,
  createEmptyDocument,
  createHtmlFrameShape,
  ROOT_SHAPE_ID
} from '../canvas/canvas-types'
import type { DesignWorkspaceState } from '../design-workspace-store-types'
import type { DesignArtifact } from '../design-types'
import {
  designAutoRepairArtifactKey,
  frameContextForHtmlArtifact,
  resolveDesignTurnTarget
} from './target'

const now = '2026-07-02T00:00:00.000Z'

function htmlArtifact(id: string, title: string): DesignArtifact {
  return {
    id,
    kind: 'html',
    title,
    relativePath: `.kun-design/doc/${id}/v1.html`,
    designMdPath: `.kun-design/doc/${id}/DESIGN.md`,
    createdAt: now,
    updatedAt: now,
    versions: [{ id: `${id}-v1`, relativePath: `.kun-design/doc/${id}/v1.html`, createdAt: now, summary: '' }]
  }
}

function boardArtifact(): DesignArtifact {
  return {
    id: 'board',
    kind: 'canvas',
    title: 'Board',
    relativePath: '.kun-design/doc/board/canvas.json',
    createdAt: now,
    updatedAt: now,
    versions: [{ id: 'board-v1', relativePath: '.kun-design/doc/board/canvas.json', createdAt: now, summary: '' }]
  }
}

function workspaceState(artifacts: DesignArtifact[]): Pick<
  DesignWorkspaceState,
  'activeArtifactId' | 'artifacts' | 'designContext' | 'prepareHtmlTurn'
> {
  return {
    activeArtifactId: artifacts[0]?.id ?? null,
    artifacts,
    designContext: { designTarget: 'web' },
    prepareHtmlTurn: vi.fn((_: string, options?: { artifactId?: string }) => {
      const artifactId = options?.artifactId ?? 'fresh'
      return {
        artifactId,
        relativePath: `.kun-design/doc/${artifactId}/v2.html`,
        basePath: `.kun-design/doc/${artifactId}/v1.html`,
        designMdPath: `.kun-design/doc/${artifactId}/DESIGN.md`
      }
    })
  }
}

describe('design turn target resolver', () => {
  it('resolves an explicit HTML screen frame as a screen turn', () => {
    const artifact = htmlArtifact('home', 'Home')
    const doc = createEmptyDocument()
    const frame = { ...createHtmlFrameShape('Home frame', 10, 20, 'home', 'desktop'), id: 'frame_home', parentId: ROOT_SHAPE_ID }
    doc.objects[ROOT_SHAPE_ID] = { ...doc.objects[ROOT_SHAPE_ID], children: [frame.id] }
    doc.objects[frame.id] = frame
    const state = workspaceState([artifact, boardArtifact()])

    const resolved = resolveDesignTurnTarget({
      promptText: 'Improve this screen',
      workspaceState: state,
      boardArtifact: boardArtifact(),
      canvasDocument: doc,
      selectedShapeIds: new Set(),
      explicitScreenShapeId: frame.id
    })

    expect(resolved).toMatchObject({
      target: 'screen',
      artifactRelativePath: '.kun-design/doc/home/v2.html',
      basePath: '.kun-design/doc/home/v1.html',
      htmlArtifactId: 'home',
      designNotesPath: '.kun-design/doc/home/DESIGN.md',
      targetAutoRepairKey: 'artifact:home',
      selectedFrame: { id: 'frame_home' },
      htmlFrameContext: { name: 'Home frame', width: 1280, height: 800 }
    })
    expect(state.prepareHtmlTurn).toHaveBeenCalledWith('Improve this screen', expect.objectContaining({
      artifactId: 'home',
      reusePendingInitial: true
    }))
  })

  it('resolves selected HTML element edits as focused HTML turns', () => {
    const artifact = htmlArtifact('home', 'Home')
    const state = workspaceState([artifact, boardArtifact()])
    const resolved = resolveDesignTurnTarget({
      promptText: 'Change this button',
      workspaceState: state,
      boardArtifact: boardArtifact(),
      canvasDocument: createEmptyDocument(),
      selectedShapeIds: new Set(),
      htmlElementContext: {
        artifactId: 'home',
        artifactTitle: 'Home',
        artifactRelativePath: artifact.relativePath,
        selector: '#cta',
        tagName: 'button',
        text: 'Start',
        html: '<button id="cta">Start</button>'
      }
    })

    expect(resolved).toMatchObject({
      target: 'html',
      htmlArtifactId: 'home',
      nextIntentMode: 'modify',
      htmlElementContext: {
        selector: '#cta',
        artifactRelativePath: '.kun-design/doc/home/v1.html'
      }
    })
  })

  it('resolves canvas selections into selected canvas snapshots', () => {
    const doc = createEmptyDocument()
    const rect = { ...createDefaultShape('rect', 40, 80), id: 'rect_1', parentId: ROOT_SHAPE_ID }
    doc.objects[ROOT_SHAPE_ID] = { ...doc.objects[ROOT_SHAPE_ID], children: [rect.id] }
    doc.objects[rect.id] = rect
    const resolved = resolveDesignTurnTarget({
      promptText: 'Annotate this card',
      workspaceState: { ...workspaceState([boardArtifact()]), activeArtifactId: 'board' },
      boardArtifact: boardArtifact(),
      canvasDocument: doc,
      selectedShapeIds: new Set([rect.id]),
      viewBox: { x: 0, y: 0, width: 800, height: 600 }
    })

    expect(resolved.target).toBe('canvas')
    expect(resolved.nextIntentMode).toBeUndefined()
    expect(resolved.canvasSnapshot?.shapes.find((shape) => shape.id === rect.id)).toMatchObject({
      selected: true,
      inView: true
    })
  })

  it('resolves empty design canvas turns as generate intent', () => {
    const resolved = resolveDesignTurnTarget({
      promptText: 'Create a dashboard',
      workspaceState: { ...workspaceState([boardArtifact()]), activeArtifactId: 'board' },
      boardArtifact: boardArtifact(),
      canvasDocument: createEmptyDocument(),
      selectedShapeIds: new Set()
    })

    expect(resolved).toMatchObject({
      target: 'canvas',
      artifactRelativePath: '.kun-design/doc/board/canvas.json',
      nextIntentMode: 'generate',
      targetAutoRepairKey: ''
    })
    expect(resolved.canvasSnapshot?.graph?.projectId).toBe('board')
  })

  it('derives frame context from artifact node fallback', () => {
    const artifact = {
      ...htmlArtifact('home', 'Home'),
      node: { x: 0, y: 0, width: 390, height: 844, sizeMode: 'manual' as const }
    }

    expect(frameContextForHtmlArtifact('home', createEmptyDocument(), [artifact])).toEqual({
      name: 'Home',
      width: 390,
      height: 844,
      sizeMode: 'manual'
    })
    expect(designAutoRepairArtifactKey(' home ')).toBe('artifact:home')
  })
})
