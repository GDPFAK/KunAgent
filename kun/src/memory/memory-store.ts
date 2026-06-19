import { mkdir, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { MemoryCapabilityConfig } from '../contracts/capabilities.js'
import { atomicWriteFile } from '../adapters/file/atomic-write.js'
import {
  MemoryDiagnostics,
  MemoryRecord,
  type MemoryCreateRequest,
  type MemoryUpdateRequest
} from '../contracts/memory.js'

export interface MemoryStore {
  create(input: MemoryCreateRequest): Promise<MemoryRecord>
  update(id: string, patch: MemoryUpdateRequest): Promise<MemoryRecord>
  delete(id: string): Promise<MemoryRecord>
  list(filter?: { workspace?: string; project?: string; includeDeleted?: boolean }): Promise<MemoryRecord[]>
  retrieve(input: { query: string; workspace?: string; project?: string; limit: number }): Promise<MemoryRecord[]>
  diagnostics(): Promise<MemoryDiagnostics>
  setLastInjected(ids: string[]): void
}

export class FileMemoryStore implements MemoryStore {
  private lastInjectedIds: string[] = []

  constructor(
    private readonly options: {
      rootDir: string
      config: MemoryCapabilityConfig
      nowIso?: () => string
      idGenerator?: () => string
    }
  ) {}

  async create(input: MemoryCreateRequest): Promise<MemoryRecord> {
    await mkdir(this.options.rootDir, { recursive: true })
    const now = this.now()
    const parsed = MemoryRecord.parse({
      id: this.options.idGenerator?.() ?? `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      content: input.content,
      scope: input.scope ?? 'workspace',
      workspace: input.workspace,
      project: input.project,
      sourceThreadId: input.sourceThreadId,
      sourceTurnId: input.sourceTurnId,
      tags: input.tags ?? [],
      confidence: input.confidence ?? 1,
      createdAt: now,
      updatedAt: now
    })
    await this.write(parsed)
    return parsed
  }

  async update(id: string, patch: MemoryUpdateRequest): Promise<MemoryRecord> {
    const current = await this.mustGet(id)
    const now = this.now()
    const next = MemoryRecord.parse({
      ...current,
      ...(patch.content !== undefined ? { content: patch.content } : {}),
      ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
      ...(patch.confidence !== undefined ? { confidence: patch.confidence } : {}),
      ...(patch.disabled === true ? { disabledAt: current.disabledAt ?? now } : {}),
      ...(patch.disabled === false ? { disabledAt: undefined } : {}),
      updatedAt: now
    })
    await this.write(next)
    return next
  }

  async delete(id: string): Promise<MemoryRecord> {
    const current = await this.mustGet(id)
    const now = this.now()
    const next = MemoryRecord.parse({
      ...current,
      deletedAt: current.deletedAt ?? now,
      updatedAt: now
    })
    await this.write(next)
    return next
  }

  async list(filter: { workspace?: string; project?: string; includeDeleted?: boolean } = {}): Promise<MemoryRecord[]> {
    const records = await this.readAll()
    return records
      .filter((record) => filter.includeDeleted || !record.deletedAt)
      .filter((record) => inScope(record, filter, { includeAllWhenUnfiltered: true }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async retrieve(input: { query: string; workspace?: string; project?: string; limit: number }): Promise<MemoryRecord[]> {
    if (!this.options.config.enabled) return []
    const active = (await this.readAll())
      .filter((record) => !record.deletedAt)
      .filter((record) => inScope(record, input, { includeAllWhenUnfiltered: false }))
      .filter((record) => !record.disabledAt)
    // User-scope memories are persistent identity facts (name, preferences,
    // account) — small in number, high in value, and frequently queried by
    // semantic prompts ("who am I?", "what do you know about me") that share
    // zero keyword overlap with the stored content. Keyword retrieval will
    // always miss them, so inject every active user memory unconditionally and
    // reserve scored retrieval for the larger workspace/project pool.
    const userMemories = active.filter((record) => record.scope === 'user')
    const scored = active
      .filter((record) => record.scope !== 'user')
      .map((record) => ({ record, score: scoreMemory(record, input.query) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || b.record.updatedAt.localeCompare(a.record.updatedAt))
      .map((entry) => entry.record)
    return [...userMemories, ...scored].slice(0, input.limit)
  }

  async diagnostics(): Promise<MemoryDiagnostics> {
    const records = await this.readAll()
    return {
      enabled: this.options.config.enabled,
      rootDir: this.options.rootDir,
      activeCount: records.filter((record) => !record.deletedAt && !record.disabledAt).length,
      tombstoneCount: records.filter((record) => Boolean(record.deletedAt)).length,
      lastInjectedIds: [...this.lastInjectedIds]
    }
  }

  setLastInjected(ids: string[]): void {
    this.lastInjectedIds = [...ids]
  }

  private async mustGet(id: string): Promise<MemoryRecord> {
    const record = (await this.readAll()).find((candidate) => candidate.id === id)
    if (!record) throw new Error(`memory not found: ${id}`)
    return record
  }

  private async readAll(): Promise<MemoryRecord[]> {
    await mkdir(this.options.rootDir, { recursive: true })
    const entries = await readdir(this.options.rootDir).catch(() => [])
    const records = await Promise.all(entries
      .filter((entry) => entry.endsWith('.json'))
      .map((entry) => readFile(join(this.options.rootDir, entry), 'utf8')
        .then((text) => MemoryRecord.parse(JSON.parse(text)))
        .catch(() => null)))
    return records.filter((record): record is MemoryRecord => Boolean(record))
  }

  private write(record: MemoryRecord): Promise<void> {
    return atomicWriteFile(
      join(this.options.rootDir, `${record.id}.json`),
      JSON.stringify(record, null, 2)
    )
  }

  private now(): string {
    return this.options.nowIso?.() ?? new Date().toISOString()
  }
}

function inScope(
  record: MemoryRecord,
  filter: { workspace?: string; project?: string },
  options: { includeAllWhenUnfiltered: boolean }
): boolean {
  if (record.scope === 'user') return true
  const workspace = normalizeScopeKey(filter.workspace)
  const project = normalizeScopeKey(filter.project) || workspace
  if (!workspace && !project) return options.includeAllWhenUnfiltered
  if (record.scope === 'workspace') {
    return Boolean(workspace && normalizeScopeKey(record.workspace) === workspace)
  }
  if (record.scope === 'project') {
    const recordProject = normalizeScopeKey(record.project) || normalizeScopeKey(record.workspace)
    return Boolean(project && recordProject === project)
  }
  return false
}

function normalizeScopeKey(value: string | undefined): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return ''
  if (trimmed === '/') return trimmed
  return trimmed.replace(/\/+$/, '')
}

function scoreMemory(record: MemoryRecord, query: string): number {
  // Build n-gram fingerprints so matching works for both Latin words and CJK
  // text. The previous implementation split on `[^a-z0-9_]+`, which treated
  // every Chinese/Japanese/Korean character as a separator and produced an
  // empty token set for CJK queries — memories were never retrieved.
  const queryGrams = ngrams(query)
  if (queryGrams.size === 0) return 0
  const textGrams = ngrams(`${record.content} ${record.tags.join(' ')}`)
  let overlap = 0
  for (const gram of queryGrams) {
    if (textGrams.has(gram)) overlap += 1
  }
  // Normalize by query coverage so long queries do not drown out short ones.
  const coverage = overlap / queryGrams.size
  return (overlap + coverage) * record.confidence
}

/**
 * Produce a fingerprint of overlapping n-grams for a string. ASCII/Latin
 * segments are tokenized on word boundaries and down to trigrams, while CJK
 * runs are split into bigrams. Lower-cased, de-spaced. This keeps matching
 * language-agnostic without pulling in a tokenizer dependency.
 */
function ngrams(input: string): Set<string> {
  const grams = new Set<string>()
  const normalized = input.toLowerCase()
  // Pull out ASCII words (letters/digits/underscore) and CJK runs separately.
  const asciiWords = normalized.match(/[a-z0-9_]{3,}/g) ?? []
  for (const word of asciiWords) {
    for (let i = 0; i + 3 <= word.length; i += 1) {
      grams.add(word.slice(i, i + 3))
    }
    if (word.length < 3) grams.add(word)
  }
  const cjkRuns = normalized.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g) ?? []
  for (const run of cjkRuns) {
    for (let i = 0; i + 2 <= run.length; i += 1) {
      grams.add(run.slice(i, i + 2))
    }
    if (run.length < 2) grams.add(run)
  }
  return grams
}
