import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { buildRepoMapEntry, extractRepoSymbols, rankRepoMapEntries, searchRepoMap } from './repo-map.js'

const execFileAsync = promisify(execFile)

describe('repo map hybrid retrieval', () => {
  const tempRoots: string[] = []

  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('extracts common symbols without control-flow false positives', () => {
    expect(extractRepoSymbols(`
      export class CacheTelemetry {}
      export function diagnoseCacheMiss() {}
      const cacheHitRate = 1
      if (cacheHitRate) {}
    `)).toEqual(expect.arrayContaining(['CacheTelemetry', 'diagnoseCacheMiss', 'cacheHitRate']))
    expect(extractRepoSymbols('if (ready) { return true }')).not.toContain('if')
  })

  it('combines BM25, symbol matches, and recent-file weighting', () => {
    const cache = buildRepoMapEntry('src/cache-diagnostics.ts', 'export function diagnoseCacheMiss() {}', {
      size: 42,
      mtimeMs: 1,
      recent: true
    })
    const unrelated = buildRepoMapEntry('src/theme.ts', 'export const backgroundColor = "blue"', {
      size: 42,
      mtimeMs: 1,
      recent: false
    })

    const [result] = rankRepoMapEntries([unrelated, cache], 'diagnose cache miss')

    expect(result?.path).toBe('src/cache-diagnostics.ts')
    expect(result?.symbols).toContain('diagnoseCacheMiss')
    expect(result?.recent).toBe(true)
  })

  it('clamps invalid result limits to a safe range', () => {
    const entries = [
      buildRepoMapEntry('src/a.ts', 'export function alphaCache() {}', { size: 1, mtimeMs: 1, recent: false }),
      buildRepoMapEntry('src/b.ts', 'export function betaCache() {}', { size: 1, mtimeMs: 1, recent: false })
    ]

    expect(rankRepoMapEntries(entries, 'cache', -1)).toHaveLength(1)
    expect(rankRepoMapEntries(entries, 'cache', 100)).toHaveLength(2)
  })

  it('indexes git-tracked and untracked source files from a workspace', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'kun-repo-map-'))
    tempRoots.push(workspace)
    await execFileAsync('git', ['init'], { cwd: workspace, windowsHide: true })
    await mkdir(join(workspace, 'src'))
    await writeFile(
      join(workspace, 'src', 'repo-cache.ts'),
      'export function buildRepoCacheIndex() { return true }',
      'utf8'
    )

    const result = await searchRepoMap({
      workspace,
      query: 'build repo cache index',
      refresh: true
    })

    expect(result.indexedFiles).toBe(1)
    expect(result.results[0]?.path).toBe('src/repo-cache.ts')
    expect(result.results[0]?.symbols).toContain('buildRepoCacheIndex')
  })
})
