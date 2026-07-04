import { describe, expect, it, vi } from 'vitest'
import {
  canPrepareImplementDesignTurn,
  dispatchDesignFromCodeTurn,
  dispatchImplementDesignTurn,
  prepareDesignFromCodeTurn,
  prepareImplementDesignTurn
} from './design-code-roundtrip'
import type { DesignArtifact } from './design-types'

const now = '2026-07-02T00:00:00.000Z'

function artifact(kind: DesignArtifact['kind'] = 'html'): DesignArtifact {
  return {
    id: `${kind}_1`,
    kind,
    title: kind === 'html' ? 'Home' : 'Board',
    relativePath: `.kun-design/doc/${kind}_1/${kind === 'html' ? 'v1.html' : 'canvas.json'}`,
    designMdPath: kind === 'html' ? '.kun-design/doc/html_1/DESIGN.md' : undefined,
    createdAt: now,
    updatedAt: now,
    versions: []
  }
}

const designState = {
  publishDesignSystem: true,
  designContext: { designTarget: 'web' as const },
  implementStackHint: 'React + Tailwind',
  injectIntoCode: true
}

describe('design code roundtrip', () => {
  it('prepares a design-to-code implementation turn and publishes the design system', async () => {
    const writeWorkspaceFile = vi.fn(async () => ({
      ok: true as const,
      path: '.kun-design/DESIGN_SYSTEM.md',
      savedAt: now
    }))

    const result = await prepareImplementDesignTurn({
      artifact: artifact('html'),
      designState,
      workspaceRoot: '/workspace',
      api: { writeWorkspaceFile }
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(writeWorkspaceFile).toHaveBeenCalledWith(expect.objectContaining({
      path: '.kun-design/DESIGN_SYSTEM.md',
      workspaceRoot: '/workspace'
    }))
    expect(result.designSystemHash).toBeTruthy()
    expect(result.prompt).toContain('Design source (a standalone HTML mockup): .kun-design/doc/html_1/v1.html')
    expect(result.prompt).toContain('Project design system: .kun-design/DESIGN_SYSTEM.md')
    expect(result.prompt).toContain('Target stack: React + Tailwind')
    expect(result.prompt).toContain('Read the design notes `.kun-design/doc/html_1/DESIGN.md`')
  })

  it('keeps design-system publish failures non-fatal', async () => {
    const result = await prepareImplementDesignTurn({
      artifact: artifact('html'),
      designState,
      workspaceRoot: '/workspace',
      api: { writeWorkspaceFile: vi.fn(async () => ({ ok: false as const, message: 'nope' })) }
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.designSystemHash).toBeUndefined()
    expect(result.prompt).not.toContain('Project design system: .kun-design/DESIGN_SYSTEM.md')
  })

  it('rejects non-html artifacts for implementation', async () => {
    const board = artifact('canvas')

    expect(canPrepareImplementDesignTurn(board)).toBe(false)
    await expect(prepareImplementDesignTurn({
      artifact: board,
      designState,
      workspaceRoot: '/workspace'
    })).resolves.toEqual({ ok: false, reason: 'unsupported-artifact' })
  })

  it('dispatches design implementation into a fresh code thread and records provenance', async () => {
    const state = {
      ...designState,
      openImplementPanel: vi.fn(),
      markImplemented: vi.fn()
    }
    const createThread = vi.fn(async () => undefined)
    const sendMessage = vi.fn(async () => true)

    const result = await dispatchImplementDesignTurn({
      artifact: artifact('html'),
      designState: state,
      workspaceRoot: '/workspace',
      createThread,
      sendMessage,
      displayText: 'Implement Home',
      getActiveThreadId: () => 'thread_1',
      api: {
        writeWorkspaceFile: vi.fn(async () => ({
          ok: true as const,
          path: '.kun-design/DESIGN_SYSTEM.md',
          savedAt: now
        }))
      }
    })

    expect(result.status).toBe('sent')
    expect(createThread).toHaveBeenCalledWith({ workspaceRoot: '/workspace' })
    expect(state.openImplementPanel).toHaveBeenCalledWith('Home')
    expect(sendMessage).toHaveBeenCalledWith(expect.stringContaining('Design source'), 'agent', {
      displayText: 'Implement Home'
    })
    expect(state.markImplemented).toHaveBeenCalledWith('html_1', 'thread_1', expect.any(String))
  })

  it('does not mark implementation provenance when dispatch send fails', async () => {
    const state = {
      ...designState,
      openImplementPanel: vi.fn(),
      markImplemented: vi.fn()
    }

    const result = await dispatchImplementDesignTurn({
      artifact: artifact('html'),
      designState: state,
      workspaceRoot: '/workspace',
      createThread: vi.fn(async () => undefined),
      sendMessage: vi.fn(async () => false),
      displayText: 'Implement Home',
      getActiveThreadId: () => 'thread_1'
    })

    expect(result.status).toBe('send-failed')
    expect(state.openImplementPanel).toHaveBeenCalledWith('Home')
    expect(state.markImplemented).not.toHaveBeenCalled()
  })

  it('prepares a code-to-design artifact and reverse-design prompt', () => {
    const prepared = prepareDesignFromCodeTurn({
      sourceRelativePath: ' src/components/Home.tsx ',
      workspaceRoot: '/workspace',
      documentId: 'doc_1',
      title: 'From Home.tsx',
      designState,
      createArtifactId: () => 'artifact_1',
      now: () => now
    })

    expect(prepared.artifact).toMatchObject({
      id: 'artifact_1',
      kind: 'html',
      title: 'From Home.tsx',
      relativePath: '.kun-design/doc_1/artifact_1/v1.html'
    })
    expect(prepared.artifact.versions[0]).toMatchObject({
      id: 'artifact_1-v1',
      relativePath: '.kun-design/doc_1/artifact_1/v1.html',
      createdAt: now,
      summary: 'From Home.tsx'
    })
    expect(prepared.prompt).toContain('Source UI code: src/components/Home.tsx')
    expect(prepared.prompt).toContain('Reserved artifact file: .kun-design/doc_1/artifact_1/v1.html')
  })

  it('dispatches code-to-design by reserving an artifact and sending with assistant model overrides', async () => {
    const upsertArtifact = vi.fn()
    const sendMessage = vi.fn(async () => true)
    const state = {
      ...designState,
      assistantModel: 'design-model',
      assistantProviderId: '',
      setWorkspaceRoot: vi.fn(),
      ensureActiveDocument: vi.fn(() => 'doc_1'),
      upsertArtifact
    }

    const result = await dispatchDesignFromCodeTurn({
      sourceRelativePath: ' src/components/Home.tsx ',
      workspaceRoot: '/workspace',
      title: 'From Home.tsx',
      displayText: 'Redesign Home.tsx',
      designState: state,
      ensureDesignThreadForWorkspace: vi.fn(async () => 'design_thread_1'),
      sendMessage,
      resolveProviderId: vi.fn(() => 'design-provider'),
      createArtifactId: () => 'artifact_1',
      now: () => now
    })

    expect(result).toEqual({ status: 'sent', artifactId: 'artifact_1', threadId: 'design_thread_1' })
    expect(state.setWorkspaceRoot).toHaveBeenCalledWith('/workspace')
    expect(state.ensureActiveDocument).toHaveBeenCalled()
    expect(upsertArtifact).toHaveBeenCalledWith(expect.objectContaining({
      id: 'artifact_1',
      relativePath: '.kun-design/doc_1/artifact_1/v1.html'
    }))
    expect(sendMessage).toHaveBeenCalledWith(expect.stringContaining('Source UI code: src/components/Home.tsx'), 'agent', {
      displayText: 'Redesign Home.tsx',
      model: 'design-model',
      providerId: 'design-provider'
    })
  })

  it('skips code-to-design dispatch when no design thread is available', async () => {
    const state = {
      ...designState,
      assistantModel: '',
      assistantProviderId: '',
      setWorkspaceRoot: vi.fn(),
      ensureActiveDocument: vi.fn(() => 'doc_1'),
      upsertArtifact: vi.fn()
    }
    const sendMessage = vi.fn(async () => true)

    await expect(dispatchDesignFromCodeTurn({
      sourceRelativePath: 'src/components/Home.tsx',
      workspaceRoot: '/workspace',
      title: 'From Home.tsx',
      displayText: 'Redesign Home.tsx',
      designState: state,
      ensureDesignThreadForWorkspace: vi.fn(async () => null),
      sendMessage,
      resolveProviderId: vi.fn(() => '')
    })).resolves.toEqual({ status: 'missing-thread' })
    expect(state.upsertArtifact).not.toHaveBeenCalled()
    expect(sendMessage).not.toHaveBeenCalled()
  })
})
