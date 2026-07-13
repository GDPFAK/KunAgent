import { mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { ChildRunRecord } from './delegation-runtime.js'
import type { DelegationStore } from './delegation-store.js'

/**
 * SQLite-backed delegation store using better-sqlite3 (synchronous API).
 * Replaces FileDelegationStore for ACID persistence, indexed queries,
 * and crash-recovery support.
 *
 * Design mirrors HybridThreadStore: WAL journal mode, busy timeout,
 * and a simple migration step.
 */
export class SqliteDelegationStore implements DelegationStore {
  private db: import('better-sqlite3').Database | null = null
  private readonly readyPromise: Promise<void>

  constructor(private readonly sqlitePath: string) {
    this.readyPromise = this.initialize()
  }

  private async initialize(): Promise<void> {
    await mkdir(dirname(resolve(this.sqlitePath)), { recursive: true })
    try {
      const sqlite = await import('better-sqlite3')
      const Database = sqlite.default
      this.db = new Database(this.sqlitePath)
      this.db.pragma('journal_mode = WAL')
      this.db.pragma('busy_timeout = 5000')
      this.migrate()
    } catch (error) {
      console.warn(`[kun] sqlite delegation store init failed: ${error instanceof Error ? error.message : String(error)}`)
      this.db = null
    }
  }

  private migrate(): void {
    if (!this.db) return
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS child_runs (
        id TEXT PRIMARY KEY,
        parent_thread_id TEXT NOT NULL,
        parent_turn_id TEXT NOT NULL,
        label TEXT,
        prompt TEXT NOT NULL,
        workspace TEXT,
        model TEXT,
        provider_id TEXT,
        profile TEXT,
        tool_policy TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        summary TEXT,
        error TEXT,
        usage_json TEXT NOT NULL DEFAULT '{}',
        prefix_reused INTEGER,
        inherited_history_items INTEGER,
        tool_invocations INTEGER,
        duration_ms INTEGER,
        queued_ms INTEGER,
        created_at TEXT NOT NULL,
        started_at TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_child_runs_parent
        ON child_runs(parent_thread_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_child_runs_status
        ON child_runs(status, updated_at DESC);
    `)
  }

  private ensureDb(): import('better-sqlite3').Database {
    if (!this.db) throw new Error('sqlite delegation store unavailable')
    return this.db
  }

  async ready(): Promise<void> {
    await this.readyPromise
  }

  async upsert(record: ChildRunRecord): Promise<void> {
    await this.ready()
    const db = this.ensureDb()
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO child_runs
        (id, parent_thread_id, parent_turn_id, label, prompt, workspace, model,
         provider_id, profile, tool_policy, status, summary, error, usage_json,
         prefix_reused, inherited_history_items, tool_invocations, duration_ms,
         queued_ms, created_at, started_at, updated_at)
      VALUES
        (@id, @parentThreadId, @parentTurnId, @label, @prompt, @workspace, @model,
         @providerId, @profile, @toolPolicy, @status, @summary, @error, @usageJson,
         @prefixReused, @inheritedHistoryItems, @toolInvocations, @durationMs,
         @queuedMs, @createdAt, @startedAt, @updatedAt)
    `)
    stmt.run({
      id: record.id,
      parentThreadId: record.parentThreadId,
      parentTurnId: record.parentTurnId,
      label: record.label ?? null,
      prompt: record.prompt,
      workspace: record.workspace ?? null,
      model: record.model ?? null,
      providerId: record.providerId ?? null,
      profile: record.profile ?? null,
      toolPolicy: record.toolPolicy ?? null,
      status: record.status,
      summary: record.summary ?? null,
      error: record.error ?? null,
      usageJson: JSON.stringify(record.usage ?? {}),
      prefixReused: record.prefixReused ? 1 : null,
      inheritedHistoryItems: record.inheritedHistoryItems ?? null,
      toolInvocations: record.toolInvocations ?? null,
      durationMs: record.durationMs ?? null,
      queuedMs: record.queuedMs ?? null,
      createdAt: record.createdAt,
      startedAt: record.startedAt ?? null,
      updatedAt: record.updatedAt
    })
  }

  async get(id: string): Promise<ChildRunRecord | null> {
    await this.ready()
    const db = this.ensureDb()
    const row = db.prepare('SELECT * FROM child_runs WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) return null
    return this.rowToRecord(row)
  }

  async list(parentThreadId?: string): Promise<ChildRunRecord[]> {
    await this.ready()
    const db = this.ensureDb()
    let rows: Record<string, unknown>[]
    if (parentThreadId) {
      rows = db.prepare('SELECT * FROM child_runs WHERE parent_thread_id = ? ORDER BY created_at ASC').all(parentThreadId) as Record<string, unknown>[]
    } else {
      rows = db.prepare('SELECT * FROM child_runs ORDER BY created_at ASC').all() as Record<string, unknown>[]
    }
    return rows.map((row) => this.rowToRecord(row))
  }

  async listByStatus(status: ChildRunRecord['status']): Promise<ChildRunRecord[]> {
    await this.ready()
    const db = this.ensureDb()
    const rows = db.prepare('SELECT * FROM child_runs WHERE status = ? ORDER BY updated_at DESC').all(status) as Record<string, unknown>[]
    return rows.map((row) => this.rowToRecord(row))
  }

  async listActive(): Promise<ChildRunRecord[]> {
    await this.ready()
    const db = this.ensureDb()
    const rows = db.prepare("SELECT * FROM child_runs WHERE status IN ('queued', 'running') ORDER BY created_at ASC").all() as Record<string, unknown>[]
    return rows.map((row) => this.rowToRecord(row))
  }

  async close(): Promise<void> {
    await this.ready()
    if (this.db) {
      try { this.db.close() } catch { /* ignore */ }
      this.db = null
    }
  }

  private rowToRecord(row: Record<string, unknown>): ChildRunRecord {
    const usage = typeof row.usage_json === 'string' ? JSON.parse(row.usage_json) : {}
    return ChildRunRecord.parse({
      id: row.id,
      parentThreadId: row.parent_thread_id,
      parentTurnId: row.parent_turn_id,
      label: row.label || undefined,
      prompt: row.prompt,
      workspace: row.workspace || undefined,
      model: row.model || undefined,
      providerId: row.provider_id || undefined,
      profile: row.profile || undefined,
      toolPolicy: row.tool_policy || undefined,
      status: row.status,
      summary: row.summary || undefined,
      error: row.error || undefined,
      usage,
      prefixReused: row.prefix_reused === 1 ? true : undefined,
      inheritedHistoryItems: row.inherited_history_items ?? undefined,
      toolInvocations: row.tool_invocations ?? undefined,
      durationMs: row.duration_ms ?? undefined,
      queuedMs: row.queued_ms ?? undefined,
      createdAt: row.created_at,
      startedAt: row.started_at || undefined,
      updatedAt: row.updated_at
    })
  }
}
