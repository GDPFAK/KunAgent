import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { InMemorySessionStore } from '../src/adapters/in-memory-session-store.js'
import { InMemoryThreadStore } from '../src/adapters/in-memory-thread-store.js'
import { createThreadRecord } from '../src/domain/thread.js'
import { UsageService } from '../src/services/usage-service.js'
import { createKunServeRuntime, seedUsageCarryover } from '../src/server/runtime-factory.js'
import type { UsageSnapshot } from '../src/contracts/usage.js'
import type { SessionStore } from '../src/ports/session-store.js'
import { KunCapabilitiesConfig } from '../src/contracts/capabilities.js'

function usage(overrides: Partial<UsageSnapshot>): UsageSnapshot {
  const promptTokens = overrides.promptTokens ?? 10
  const completionTokens = overrides.completionTokens ?? 5
  const cacheHitTokens = overrides.cacheHitTokens ?? 0
  const cacheMissTokens = overrides.cacheMissTokens ?? Math.max(promptTokens - cacheHitTokens, 0)
  const cacheTotal = cacheHitTokens + cacheMissTokens
  return {
    promptTokens,
    completionTokens,
    totalTokens: overrides.totalTokens ?? promptTokens + completionTokens,
    cachedTokens: overrides.cachedTokens ?? cacheHitTokens,
    cacheHitTokens,
    cacheMissTokens,
    cacheHitRate: cacheTotal === 0 ? null : cacheHitTokens / cacheTotal,
    turns: overrides.turns ?? 1,
    ...(overrides.costUsd !== undefined ? { costUsd: overrides.costUsd } : {})
  }
}

describe('runtime factory usage carryover', () => {
  const tempDirs: string[] = []
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('seeds runtime usage from the latest persisted cumulative usage event per thread', async () => {
    const threadStore = new InMemoryThreadStore()
    const sessionStore = new InMemorySessionStore()
    const usageService = new UsageService()
    await threadStore.upsert(createThreadRecord({
      id: 'thr_seed',
      title: 'Seeded thread',
      workspace: '/tmp/project',
      model: 'deepseek-chat'
    }))
    await sessionStore.appendEvent('thr_seed', {
      kind: 'usage',
      seq: 2,
      timestamp: '2026-06-02T09:00:00.000Z',
      threadId: 'thr_seed',
      usage: usage({ promptTokens: 20, completionTokens: 5, cacheHitTokens: 10, cacheMissTokens: 10, turns: 1 })
    })
    await sessionStore.appendEvent('thr_seed', {
      kind: 'usage',
      seq: 5,
      timestamp: '2026-06-02T09:05:00.000Z',
      threadId: 'thr_seed',
      usage: usage({ promptTokens: 80, completionTokens: 20, cacheHitTokens: 72, cacheMissTokens: 8, turns: 3 })
    })

    await seedUsageCarryover({ threadStore, sessionStore, usageService })

    expect(usageService.forThread('thr_seed')).toMatchObject({
      promptTokens: 80,
      completionTokens: 20,
      totalTokens: 100,
      cacheHitTokens: 72,
      cacheMissTokens: 8,
      turns: 3
    })
    expect(usageService.cacheSnapshot('thr_seed')).toMatchObject({
      hits: 72,
      misses: 8,
      hitRate: 0.9
    })
  })

  it('seeds runtime usage from indexed latest snapshots without replaying event logs', async () => {
    const threadStore = new InMemoryThreadStore()
    const sessionStore = new InMemorySessionStore() as InMemorySessionStore & {
      loadLatestUsageSnapshots: NonNullable<SessionStore['loadLatestUsageSnapshots']>
    }
    const usageService = new UsageService()
    sessionStore.loadLatestUsageSnapshots = vi.fn(async () => [
      {
        threadId: 'thr_indexed',
        seq: 9,
        usage: usage({ promptTokens: 120, completionTokens: 30, cacheHitTokens: 100, cacheMissTokens: 20, turns: 4 })
      }
    ])
    const loadEventsSince = vi.spyOn(sessionStore, 'loadEventsSince')

    await seedUsageCarryover({ threadStore, sessionStore, usageService })

    expect(loadEventsSince).not.toHaveBeenCalled()
    expect(usageService.forThread('thr_indexed')).toMatchObject({
      promptTokens: 120,
      completionTokens: 30,
      totalTokens: 150,
      cacheHitTokens: 100,
      cacheMissTokens: 20,
      turns: 4
    })
  })

  it('hot-applies model and tool capabilities into runtime info and diagnostics', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'kun-runtime-apply-'))
    tempDirs.push(dataDir)
    const runtime = await createKunServeRuntime({
      host: '127.0.0.1',
      port: 0,
      dataDir,
      runtimeToken: 'tok',
      apiKey: 'sk-default',
      baseUrl: 'https://api.example.test/v1',
      model: 'model-before',
      approvalPolicy: 'auto',
      sandboxMode: 'danger-full-access',
      tokenEconomyMode: false,
      insecure: false,
      storage: { backend: 'file' },
      capabilities: KunCapabilitiesConfig.parse({})
    })

    try {
      expect(runtime.info().capabilities.instructions.enabled).toBe(true)
      const applied = await runtime.applyConfig({
        serve: { model: 'model-after' },
        capabilities: KunCapabilitiesConfig.parse({
          web: { enabled: true, fetchEnabled: true },
          instructions: { enabled: false }
        })
      })

      expect(applied).toEqual({ ok: true })
      expect(runtime.info().model).toBe('model-after')
      expect(runtime.info().capabilities.web.fetch.available).toBe(true)
      expect(runtime.info().capabilities.instructions).toMatchObject({ enabled: false, status: 'disabled' })
      const diagnostics = await runtime.toolDiagnostics?.()
      expect(diagnostics?.providers.some((provider) => provider.id === 'web')).toBe(true)
      expect(diagnostics?.instructions?.enabled).toBe(false)
    } finally {
      await runtime.shutdown?.()
    }
  })

  it('clears per-thread runtime memory when a thread is deleted', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'kun-runtime-delete-'))
    tempDirs.push(dataDir)
    const runtime = await createKunServeRuntime({
      host: '127.0.0.1',
      port: 0,
      dataDir,
      runtimeToken: 'tok',
      apiKey: 'sk-default',
      baseUrl: 'https://api.example.test/v1',
      model: 'model-before',
      approvalPolicy: 'auto',
      sandboxMode: 'danger-full-access',
      tokenEconomyMode: false,
      insecure: false,
      storage: { backend: 'file' },
      capabilities: KunCapabilitiesConfig.parse({})
    })

    try {
      const threadId = 'thr_deleted'
      await runtime.threadService.create(
        { workspace: '/tmp/workspace', model: 'model-before', mode: 'agent' },
        { id: threadId }
      )
      runtime.usageService.record(threadId, usage({ promptTokens: 10, completionTokens: 5 }))

      expect(await runtime.threadService.delete(threadId)).toBe(true)
      expect(runtime.eventBus.snapshotSince(threadId, 0)).toEqual([])
      expect(runtime.usageService.forThread(threadId).totalTokens).toBe(0)

      await runtime.threadService.create(
        { workspace: '/tmp/workspace', model: 'model-before', mode: 'agent' },
        { id: threadId }
      )
      expect(runtime.eventBus.snapshotSince(threadId, 0).map((event) => event.seq)).toEqual([1])
    } finally {
      await runtime.shutdown?.()
    }
  })
})
