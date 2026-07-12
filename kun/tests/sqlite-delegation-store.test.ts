import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SqliteDelegationStore } from '../src/delegation/sqlite-delegation-store.js'
import type { ChildRunRecord } from '../src/delegation/delegation-runtime.js'

function makeRecord(overrides: Partial<ChildRunRecord> & { id: string }): ChildRunRecord {
  return {
    parentThreadId: 'thr_parent',
    parentTurnId: 'turn_1',
    prompt: 'test prompt',
    status: 'completed',
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

describe('SqliteDelegationStore', () => {
  let dir: string
  let store: SqliteDelegationStore

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'kun-delsql-'))
    store = new SqliteDelegationStore(join(dir, 'test.sqlite3'))
    await store.ready()
  })

  afterEach(async () => {
    await store.close()
    await rm(dir, { recursive: true, force: true })
  })

  it('creates and reads back a record', async () => {
    const record = makeRecord({ id: 'child_1', summary: 'done' })
    await store.upsert(record)
    const got = await store.get('child_1')
    expect(got).not.toBeNull()
    expect(got!.id).toBe('child_1')
    expect(got!.summary).toBe('done')
    expect(got!.status).toBe('completed')
  })

  it('returns null for missing record', async () => {
    const got = await store.get('nonexistent')
    expect(got).toBeNull()
  })

  it('updates an existing record', async () => {
    const record = makeRecord({ id: 'child_upd', status: 'running' })
    await store.upsert(record)
    record.status = 'completed'
    record.summary = 'finished'
    await store.upsert(record)
    const got = await store.get('child_upd')
    expect(got!.status).toBe('completed')
    expect(got!.summary).toBe('finished')
  })

  it('lists all records', async () => {
    await store.upsert(makeRecord({ id: 'a', parentThreadId: 'thr_1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }))
    await store.upsert(makeRecord({ id: 'b', parentThreadId: 'thr_2', createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' }))
    const all = await store.list()
    expect(all).toHaveLength(2)
  })

  it('filters by parent thread', async () => {
    await store.upsert(makeRecord({ id: 'c1', parentThreadId: 'thr_x', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }))
    await store.upsert(makeRecord({ id: 'c2', parentThreadId: 'thr_y', createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' }))
    const filtered = await store.list('thr_x')
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.id).toBe('c1')
  })

  it('lists by status', async () => {
    await store.upsert(makeRecord({ id: 's1', status: 'running', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }))
    await store.upsert(makeRecord({ id: 's2', status: 'completed', createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' }))
    const running = await store.listByStatus('running')
    expect(running).toHaveLength(1)
    expect(running[0]!.id).toBe('s1')
  })

  it('lists active (queued + running) records', async () => {
    await store.upsert(makeRecord({ id: 'a1', status: 'queued', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }))
    await store.upsert(makeRecord({ id: 'a2', status: 'running', createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' }))
    await store.upsert(makeRecord({ id: 'a3', status: 'completed', createdAt: '2026-01-03T00:00:00Z', updatedAt: '2026-01-03T00:00:00Z' }))
    const active = await store.listActive()
    expect(active).toHaveLength(2)
    expect(active.map((r) => r.id).sort()).toEqual(['a1', 'a2'])
  })

  it('handles usage data round-trip', async () => {
    const usage = { promptTokens: 100, completionTokens: 50, totalTokens: 150, cacheHitTokens: 20, cacheMissTokens: 80, cacheHitRate: 0.2, turns: 1, costUsd: 0.005 }
    const record = makeRecord({ id: 'child_usage', usage })
    await store.upsert(record)
    const got = await store.get('child_usage')
    expect(got!.usage).toMatchObject(usage)
  })

  it('closes gracefully', async () => {
    await store.upsert(makeRecord({ id: 'close_test' }))
    await store.close()
    // Second close should be a no-op
    await store.close()
  })

  it('stores and retrieves all scalar fields', async () => {
    const now = new Date().toISOString()
    const record = makeRecord({
      id: 'full_fields',
      label: 'research task',
      workspace: '/tmp/project',
      model: 'gpt-4',
      providerId: 'openai',
      profile: 'explore',
      toolPolicy: 'readOnly',
      prefixReused: true,
      inheritedHistoryItems: 3,
      toolInvocations: 5,
      durationMs: 1200,
      queuedMs: 300,
      startedAt: now
    })
    await store.upsert(record)
    const got = await store.get('full_fields')
    expect(got!.label).toBe('research task')
    expect(got!.workspace).toBe('/tmp/project')
    expect(got!.model).toBe('gpt-4')
    expect(got!.providerId).toBe('openai')
    expect(got!.profile).toBe('explore')
    expect(got!.toolPolicy).toBe('readOnly')
    expect(got!.prefixReused).toBe(true)
    expect(got!.inheritedHistoryItems).toBe(3)
    expect(got!.toolInvocations).toBe(5)
    expect(got!.durationMs).toBe(1200)
    expect(got!.queuedMs).toBe(300)
    expect(got!.startedAt).toBe(now)
  })
})
