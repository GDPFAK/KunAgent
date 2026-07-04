import { describe, expect, it, vi } from 'vitest'
import type { DesignArtifact } from '../design-types'
import type { ResolvedDesignTurnTarget } from './target'
import { prepareDesignTurnFiles } from './setup'

const now = '2026-07-02T00:00:00.000Z'

function artifact(id: string): DesignArtifact {
  return {
    id,
    kind: 'html',
    title: 'Home',
    relativePath: `.kun-design/doc/${id}/v2.html`,
    designMdPath: `.kun-design/doc/${id}/DESIGN.md`,
    createdAt: now,
    updatedAt: now,
    versions: [
      { id: `${id}-v1`, relativePath: `.kun-design/doc/${id}/v1.html`, createdAt: now, summary: 'Base screen' },
      { id: `${id}-v2`, relativePath: `.kun-design/doc/${id}/v2.html`, createdAt: now, summary: '' }
    ]
  }
}

function resolvedTarget(patch: Partial<ResolvedDesignTurnTarget> = {}): ResolvedDesignTurnTarget {
  return {
    target: 'html',
    artifactRelativePath: '.kun-design/doc/home/v2.html',
    basePath: '.kun-design/doc/home/v1.html',
    htmlArtifactId: 'home',
    designNotesPath: '.kun-design/doc/home/DESIGN.md',
    visibleTargets: [],
    targetAutoRepairKey: 'artifact:home',
    ...patch
  }
}

describe('prepareDesignTurnFiles', () => {
  it('skips file setup for canvas turns', async () => {
    const api = { writeWorkspaceFile: vi.fn() }
    const result = await prepareDesignTurnFiles({
      workspaceRoot: '/workspace',
      promptText: 'Draw on canvas',
      resolvedTarget: resolvedTarget({ target: 'canvas' }),
      artifacts: [artifact('home')],
      api
    })

    expect(result).toEqual({ ok: true, notesWritten: false })
    expect(api.writeWorkspaceFile).not.toHaveBeenCalled()
  })

  it('prepares preview HTML from the base file and writes design notes', async () => {
    const api = {
      readWorkspaceFile: vi.fn(async ({ path }: { path: string }) => ({
        ok: true as const,
        path,
        content: '<!doctype html><html><body>Base</body></html>',
        size: 46,
        truncated: false
      })),
      writeWorkspaceFile: vi.fn(async ({ path }: { path: string }) => ({ ok: true as const, path, savedAt: now }))
    }

    const result = await prepareDesignTurnFiles({
      workspaceRoot: '/workspace',
      promptText: 'Tighten hierarchy',
      resolvedTarget: resolvedTarget({
        visibleTargets: [{
          kind: 'html-artifact',
          chip: { id: 'html-artifact:home', kind: 'html-artifact', label: 'Home', detail: 'v2' },
          artifact: artifact('home')
        }]
      }),
      artifacts: [artifact('home')],
      designContext: { designTarget: 'web', brandColor: '#2563eb' },
      api
    })

    expect(result).toEqual({ ok: true, previewSource: 'base', notesWritten: true })
    expect(api.writeWorkspaceFile).toHaveBeenCalledWith(expect.objectContaining({
      path: '.kun-design/doc/home/v2.html',
      content: '<!doctype html><html><body>Base</body></html>'
    }))
    expect(api.writeWorkspaceFile).toHaveBeenCalledWith(expect.objectContaining({
      path: '.kun-design/doc/home/DESIGN.md',
      content: expect.stringContaining('Tighten hierarchy')
    }))
    expect(api.writeWorkspaceFile).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('[html-artifact] Home - v2')
    }))
  })

  it('reports preview setup failures with a Workbench-ready message', async () => {
    const result = await prepareDesignTurnFiles({
      workspaceRoot: '/workspace',
      promptText: 'Tighten hierarchy',
      resolvedTarget: resolvedTarget(),
      artifacts: [artifact('home')],
      api: { writeWorkspaceFile: vi.fn(async () => ({ ok: false as const, message: 'disk full' })) }
    })

    expect(result).toEqual({
      ok: false,
      phase: 'preview',
      message: 'Design preview setup failed: disk full'
    })
  })

  it('reports notes setup failures after a successful preview write', async () => {
    const api = {
      writeWorkspaceFile: vi.fn(async ({ path }: { path: string }) => (
        path.endsWith('DESIGN.md')
          ? { ok: false as const, message: 'notes denied' }
          : { ok: true as const, path, savedAt: now }
      ))
    }

    const result = await prepareDesignTurnFiles({
      workspaceRoot: '/workspace',
      promptText: 'Tighten hierarchy',
      resolvedTarget: resolvedTarget({ basePath: undefined }),
      artifacts: [artifact('home')],
      api
    })

    expect(result).toEqual({
      ok: false,
      phase: 'notes',
      message: 'Design notes setup failed: notes denied'
    })
  })

  it('does not fail when notes cannot be written because the API is unavailable', async () => {
    const api = {
      readWorkspaceFile: vi.fn(),
      writeWorkspaceFile: vi.fn(async ({ path }: { path: string }) => ({ ok: true as const, path, savedAt: now }))
    }
    const result = await prepareDesignTurnFiles({
      workspaceRoot: '/workspace',
      promptText: 'Tighten hierarchy',
      resolvedTarget: resolvedTarget({ basePath: undefined, designNotesPath: undefined }),
      artifacts: [artifact('home')],
      api
    })

    expect(result).toMatchObject({ ok: true, notesWritten: false })
  })
})
