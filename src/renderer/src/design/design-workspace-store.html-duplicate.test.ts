import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDesignWorkspaceStore } from './design-workspace-store'
import type { DesignArtifact, DesignDocument } from './design-types'

const createdAt = '2026-06-20T00:00:00.000Z'

type WriteWorkspaceFileRequest = {
  path: string
  workspaceRoot?: string
  content: string
}

type ReadWorkspaceFileRequest = {
  path: string
  workspaceRoot?: string
}

function artifact(id: string, kind: DesignArtifact['kind']): DesignArtifact {
  const relativePath =
    kind === 'canvas' ? `.kun-design/doc/${id}/canvas.json` : `.kun-design/doc/${id}/v1.html`
  return {
    id,
    kind,
    title: id,
    relativePath,
    createdAt,
    updatedAt: createdAt,
    versions: [{ id: `${id}-v1`, relativePath, createdAt, summary: '' }]
  }
}

describe('design workspace HTML artifact duplication', () => {
  const writeWorkspaceFile = vi.fn(async (_request: WriteWorkspaceFileRequest) => ({ ok: true as const }))

  beforeEach(() => {
    writeWorkspaceFile.mockClear()
    vi.stubGlobal('window', { kunGui: { writeWorkspaceFile } })
    const canvas = artifact('canvas', 'canvas')
    const screen = artifact('screen', 'html')
    const doc: DesignDocument = {
      id: 'doc',
      title: 'Doc',
      createdAt,
      updatedAt: createdAt,
      order: 0,
      artifacts: [canvas, screen],
      activeArtifactId: canvas.id
    }
    useDesignWorkspaceStore.setState({
      workspaceRoot: '/workspace',
      documents: [doc],
      activeDocumentId: 'doc',
      artifacts: [canvas, screen],
      activeArtifactId: canvas.id,
      designIntentMode: 'modify',
      designContext: { designTarget: 'web' },
      fileError: null
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('duplicates a board-hidden HTML artifact as a visible board screen', async () => {
    const sourceNode = {
      x: 120,
      y: 240,
      width: 390,
      height: 844,
      sizeMode: 'auto' as const,
      boardHidden: true
    }
    const source = {
      ...artifact('hidden-screen', 'html'),
      title: 'Hidden screen',
      node: sourceNode
    }
    const canvas = artifact('canvas', 'canvas')
    const doc: DesignDocument = {
      id: 'doc',
      title: 'Doc',
      createdAt,
      updatedAt: createdAt,
      order: 0,
      artifacts: [canvas, source],
      activeArtifactId: canvas.id
    }
    const readWorkspaceFile = vi.fn(async (request: ReadWorkspaceFileRequest) =>
      request.path.endsWith('/DESIGN.md')
        ? { ok: true as const, content: '# Hidden screen notes' }
        : { ok: true as const, content: '<html><body>Hidden</body></html>' }
    )
    vi.stubGlobal('window', { kunGui: { writeWorkspaceFile, readWorkspaceFile } })
    useDesignWorkspaceStore.setState({
      documents: [doc],
      activeDocumentId: 'doc',
      artifacts: doc.artifacts,
      activeArtifactId: canvas.id
    })

    await useDesignWorkspaceStore.getState().duplicateArtifact(source.id)

    const copy = useDesignWorkspaceStore
      .getState()
      .artifacts.find((item) => item.id !== source.id && item.title === 'Hidden screen copy')
    expect(copy?.node).toMatchObject({
      x: 164,
      y: 284,
      width: 390,
      height: 844,
      sizeMode: 'auto',
      boardHidden: false
    })
    expect(readWorkspaceFile).toHaveBeenCalledWith(expect.objectContaining({
      path: source.relativePath,
      workspaceRoot: '/workspace'
    }))
    expect(writeWorkspaceFile).toHaveBeenCalledWith(expect.objectContaining({
      path: expect.stringMatching(/^\.kun-design\/doc\/.+\/v1\.html$/),
      workspaceRoot: '/workspace',
      content: '<html><body>Hidden</body></html>'
    }))
    expect(writeWorkspaceFile).toHaveBeenCalledWith(expect.objectContaining({
      path: expect.stringMatching(/^\.kun-design\/doc\/.+\/DESIGN\.md$/),
      workspaceRoot: '/workspace',
      content: '# Hidden screen notes'
    }))
    expect(writeWorkspaceFile).toHaveBeenCalledWith(expect.objectContaining({
      path: expect.stringMatching(/^\.kun-design\/doc\/.+\/meta\.json$/),
      content: expect.stringContaining('"boardHidden": false')
    }))
  })

  it('still duplicates HTML artifacts when the source design notes are missing', async () => {
    const source = {
      ...artifact('screen-without-notes', 'html'),
      title: 'No notes'
    }
    const canvas = artifact('canvas', 'canvas')
    const doc: DesignDocument = {
      id: 'doc',
      title: 'Doc',
      createdAt,
      updatedAt: createdAt,
      order: 0,
      artifacts: [canvas, source],
      activeArtifactId: canvas.id
    }
    const readWorkspaceFile = vi.fn(async (request: ReadWorkspaceFileRequest) =>
      request.path.endsWith('/DESIGN.md')
        ? { ok: false as const, error: 'missing' }
        : { ok: true as const, content: '<html><body>No notes</body></html>' }
    )
    vi.stubGlobal('window', { kunGui: { writeWorkspaceFile, readWorkspaceFile } })
    useDesignWorkspaceStore.setState({
      documents: [doc],
      activeDocumentId: 'doc',
      artifacts: doc.artifacts,
      activeArtifactId: canvas.id
    })

    await useDesignWorkspaceStore.getState().duplicateArtifact(source.id)

    const copy = useDesignWorkspaceStore
      .getState()
      .artifacts.find((item) => item.id !== source.id && item.title === 'No notes copy')
    expect(copy).toBeDefined()
    expect(writeWorkspaceFile).toHaveBeenCalledWith(expect.objectContaining({
      path: expect.stringMatching(/^\.kun-design\/doc\/.+\/v1\.html$/),
      content: '<html><body>No notes</body></html>'
    }))
    expect(
      writeWorkspaceFile.mock.calls.some(([request]) =>
        (request as WriteWorkspaceFileRequest).path.endsWith('/DESIGN.md')
      )
    ).toBe(false)
  })
})
