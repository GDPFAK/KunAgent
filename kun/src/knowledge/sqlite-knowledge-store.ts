import { randomUUID } from 'node:crypto'
import { mkdir, readFile, stat } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import type { Database as BetterSqliteDatabase, Statement } from 'better-sqlite3'
import type { KnowledgeCapabilityConfig } from '../contracts/capabilities.js'
import {
  KnowledgeBaseRecord,
  KnowledgeChunkSearchResult,
  KnowledgeDiagnostics,
  KnowledgeDocumentRecord,
  type KnowledgeCreateRequest,
  type KnowledgeDocumentCreateRequest,
  type KnowledgeDocumentSourceType,
  type KnowledgeSearchRequest,
  type KnowledgeUpdateRequest
} from '../contracts/knowledge.js'
import {
  cosineSimilarity,
  sha256Hex,
  type EmbeddingProvider,
  type KnowledgeDocumentInput,
  type KnowledgeProvider,
  type RerankerProvider
} from './knowledge-provider.js'

type KnowledgeBaseRow = {
  id: string
  name: string
  description: string | null
  workspace: string | null
  enabled: number
  provider_kind: string
  embedding_provider_id: string | null
  embedding_base_url: string | null
  embedding_api_key: string | null
  embedding_model: string | null
  embedding_dimensions: number | null
  reranker_enabled: number
  reranker_provider_id: string | null
  reranker_base_url: string | null
  reranker_api_key: string | null
  reranker_model: string | null
  external_provider: string | null
  external_endpoint: string | null
  external_api_key: string | null
  external_metadata_json: string | null
  document_count?: number
  chunk_count?: number
  created_at: string
  updated_at: string
}

type KnowledgeDocumentRow = {
  id: string
  knowledge_base_id: string
  name: string
  source_type: string
  source_path: string | null
  mime_type: string | null
  content_hash: string
  byte_size: number
  chunk_count: number
  status: string
  error: string | null
  created_at: string
  updated_at: string
}

type KnowledgeChunkRow = {
  id: string
  knowledge_base_id: string
  knowledge_base_name?: string
  document_id: string
  document_name?: string
  source_type?: string
  source_path?: string | null
  ordinal: number
  text: string
  embedding_json: string | null
  bm25_rank?: number
}

type ExternalSearchResponse = {
  results?: unknown[]
}

export class SqliteKnowledgeStore implements KnowledgeProvider {
  private db: BetterSqliteDatabase | null = null
  private unavailableReason: string | undefined
  private readonly readyPromise: Promise<void>
  private readonly statementCache = new Map<string, Statement>()

  constructor(
    private readonly options: {
      rootDir: string
      sqlitePath?: string
      config: KnowledgeCapabilityConfig
      embeddingProvider?: EmbeddingProvider
      rerankerProvider?: RerankerProvider
      fetchImpl?: typeof fetch
      nowIso?: () => string
      idGenerator?: () => string
    }
  ) {
    this.readyPromise = this.initialize()
  }

  async listKnowledgeBases(
    filter: { workspace?: string; includeDisabled?: boolean } = {}
  ): Promise<KnowledgeBaseRecord[]> {
    await this.ready()
    const workspace = normalizeWorkspace(filter.workspace)
    const rows = this.db!.prepare(`
      SELECT
        kb.*,
        COUNT(DISTINCT CASE WHEN d.status != 'deleted' THEN d.id END) AS document_count,
        COUNT(c.id) AS chunk_count
      FROM knowledge_bases kb
      LEFT JOIN knowledge_documents d ON d.knowledge_base_id = kb.id
      LEFT JOIN knowledge_chunks c ON c.knowledge_base_id = kb.id
      WHERE (@include_disabled = 1 OR kb.enabled = 1)
        AND (@workspace IS NULL OR kb.workspace IS NULL OR kb.workspace = @workspace)
      GROUP BY kb.id
      ORDER BY kb.updated_at DESC
    `).all({
      include_disabled: filter.includeDisabled ? 1 : 0,
      workspace: workspace ?? null
    }) as KnowledgeBaseRow[]
    return rows.map(rowToKnowledgeBase)
  }

  async createKnowledgeBase(input: KnowledgeCreateRequest): Promise<KnowledgeBaseRecord> {
    await this.ready()
    const parsed = KnowledgeBaseRecord.parse({
      id: this.nextId('kb'),
      name: input.name.trim(),
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      ...(normalizeWorkspace(input.workspace) ? { workspace: normalizeWorkspace(input.workspace) } : {}),
      enabled: input.enabled ?? true,
      providerKind: input.providerKind ?? 'local-sqlite',
      embedding: input.embedding ?? {},
      reranker: input.reranker ?? { enabled: false },
      ...(input.external ? { external: input.external } : {}),
      documentCount: 0,
      chunkCount: 0,
      createdAt: this.now(),
      updatedAt: this.now()
    })
    this.cachedStatement(`
      INSERT INTO knowledge_bases (
        id, name, description, workspace, enabled, provider_kind,
        embedding_provider_id, embedding_base_url, embedding_api_key, embedding_model, embedding_dimensions,
        reranker_enabled, reranker_provider_id, reranker_base_url, reranker_api_key, reranker_model,
        external_provider, external_endpoint, external_api_key, external_metadata_json,
        created_at, updated_at
      ) VALUES (
        @id, @name, @description, @workspace, @enabled, @provider_kind,
        @embedding_provider_id, @embedding_base_url, @embedding_api_key, @embedding_model, @embedding_dimensions,
        @reranker_enabled, @reranker_provider_id, @reranker_base_url, @reranker_api_key, @reranker_model,
        @external_provider, @external_endpoint, @external_api_key, @external_metadata_json,
        @created_at, @updated_at
      )
    `).run(knowledgeBaseToRow(parsed))
    return parsed
  }

  async updateKnowledgeBase(id: string, patch: KnowledgeUpdateRequest): Promise<KnowledgeBaseRecord> {
    await this.ready()
    const current = await this.mustGetKnowledgeBase(id)
    const now = this.now()
    const next = KnowledgeBaseRecord.parse({
      ...current,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.description !== undefined ? { description: patch.description?.trim() || undefined } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.providerKind !== undefined ? { providerKind: patch.providerKind } : {}),
      ...(patch.embedding !== undefined ? { embedding: { ...current.embedding, ...patch.embedding } } : {}),
      ...(patch.reranker !== undefined ? { reranker: { ...current.reranker, ...patch.reranker } } : {}),
      ...(patch.external !== undefined ? { external: patch.external } : {}),
      updatedAt: now
    })
    this.cachedStatement(`
      UPDATE knowledge_bases SET
        name = @name,
        description = @description,
        enabled = @enabled,
        provider_kind = @provider_kind,
        embedding_provider_id = @embedding_provider_id,
        embedding_base_url = @embedding_base_url,
        embedding_api_key = @embedding_api_key,
        embedding_model = @embedding_model,
        embedding_dimensions = @embedding_dimensions,
        reranker_enabled = @reranker_enabled,
        reranker_provider_id = @reranker_provider_id,
        reranker_base_url = @reranker_base_url,
        reranker_api_key = @reranker_api_key,
        reranker_model = @reranker_model,
        external_provider = @external_provider,
        external_endpoint = @external_endpoint,
        external_api_key = @external_api_key,
        external_metadata_json = @external_metadata_json,
        updated_at = @updated_at
      WHERE id = @id
    `).run(knowledgeBaseToRow(next))
    return this.mustGetKnowledgeBase(id)
  }

  async deleteKnowledgeBase(id: string): Promise<KnowledgeBaseRecord> {
    await this.ready()
    const current = await this.mustGetKnowledgeBase(id)
    const tx = this.db!.transaction(() => {
      this.cachedStatement('DELETE FROM knowledge_chunks_fts WHERE knowledge_base_id = ?').run(id)
      this.cachedStatement('DELETE FROM knowledge_chunks WHERE knowledge_base_id = ?').run(id)
      this.cachedStatement('DELETE FROM knowledge_documents WHERE knowledge_base_id = ?').run(id)
      this.cachedStatement('DELETE FROM knowledge_bases WHERE id = ?').run(id)
    })
    tx()
    return current
  }

  async listDocuments(knowledgeBaseId: string): Promise<KnowledgeDocumentRecord[]> {
    await this.ready()
    await this.mustGetKnowledgeBase(knowledgeBaseId)
    const rows = this.cachedStatement(`
      SELECT * FROM knowledge_documents
      WHERE knowledge_base_id = ? AND status != 'deleted'
      ORDER BY updated_at DESC
    `).all(knowledgeBaseId) as KnowledgeDocumentRow[]
    return rows.map(rowToDocument)
  }

  async addDocument(input: KnowledgeDocumentInput): Promise<KnowledgeDocumentRecord> {
    await this.ready()
    const kb = await this.mustGetKnowledgeBase(input.knowledgeBaseId)
    if (kb.providerKind !== 'local-sqlite') {
      throw new Error('documents can only be added to local SQLite knowledge bases')
    }
    const material = await this.materializeDocument(input)
    const chunks = splitText(material.text, {
      chunkSize: this.options.config.defaultChunkSizeChars,
      overlap: this.options.config.defaultChunkOverlapChars
    })
    if (chunks.length === 0) throw new Error('document produced no indexable chunks')
    let embeddings: number[][] = []
    let embeddingError: string | undefined
    if (isEmbeddingConfigured(kb)) {
      try {
        embeddings = await this.embedChunks(kb, chunks)
      } catch (error) {
        embeddingError = errorMessage(error)
      }
    }
    const now = this.now()
    const document = KnowledgeDocumentRecord.parse({
      id: this.nextId('kdoc'),
      knowledgeBaseId: kb.id,
      name: material.name,
      sourceType: material.sourceType,
      ...(material.sourcePath ? { sourcePath: material.sourcePath } : {}),
      ...(material.mimeType ? { mimeType: material.mimeType } : {}),
      contentHash: material.hash,
      byteSize: material.byteSize,
      chunkCount: chunks.length,
      status: 'ready',
      ...(embeddingError ? { error: `Embedding failed; indexed with lexical search only: ${embeddingError}` } : {}),
      createdAt: now,
      updatedAt: now
    })
    const tx = this.db!.transaction(() => {
      this.insertDocument(document)
      for (let index = 0; index < chunks.length; index += 1) {
        const chunkId = this.nextId('kchunk')
        const text = chunks[index] ?? ''
        const embedding = embeddings[index]
        this.cachedStatement(`
          INSERT INTO knowledge_chunks (
            id, knowledge_base_id, document_id, ordinal, text, content_hash,
            token_estimate, embedding_json, created_at, updated_at
          ) VALUES (
            @id, @knowledge_base_id, @document_id, @ordinal, @text, @content_hash,
            @token_estimate, @embedding_json, @created_at, @updated_at
          )
        `).run({
          id: chunkId,
          knowledge_base_id: kb.id,
          document_id: document.id,
          ordinal: index,
          text,
          content_hash: sha256Hex(text),
          token_estimate: estimateTokens(text),
          embedding_json: embedding ? JSON.stringify(embedding) : null,
          created_at: now,
          updated_at: now
        })
        this.cachedStatement(`
          INSERT INTO knowledge_chunks_fts (chunk_id, knowledge_base_id, document_id, text, source_text)
          VALUES (?, ?, ?, ?, ?)
        `).run(chunkId, kb.id, document.id, text, `${document.name} ${document.sourcePath ?? ''}`)
      }
      this.touchKnowledgeBase(kb.id, now)
    })
    tx()
    return document
  }

  async deleteDocument(knowledgeBaseId: string, documentId: string): Promise<KnowledgeDocumentRecord> {
    await this.ready()
    const current = await this.mustGetDocument(knowledgeBaseId, documentId)
    const now = this.now()
    const next = KnowledgeDocumentRecord.parse({
      ...current,
      status: 'deleted',
      updatedAt: now
    })
    const tx = this.db!.transaction(() => {
      this.cachedStatement(`
        UPDATE knowledge_documents SET status = 'deleted', updated_at = @updated_at
        WHERE knowledge_base_id = @knowledge_base_id AND id = @id
      `).run({ knowledge_base_id: knowledgeBaseId, id: documentId, updated_at: now })
      this.cachedStatement('DELETE FROM knowledge_chunks_fts WHERE document_id = ?').run(documentId)
      this.cachedStatement('DELETE FROM knowledge_chunks WHERE document_id = ?').run(documentId)
      this.touchKnowledgeBase(knowledgeBaseId, now)
    })
    tx()
    return next
  }

  async search(input: KnowledgeSearchRequest): Promise<KnowledgeChunkSearchResult[]> {
    await this.ready()
    const parsed = {
      query: input.query,
      workspace: input.workspace,
      knowledgeBaseIds: input.knowledgeBaseIds ?? [],
      topK: input.topK ?? this.options.config.maxToolResults,
      minScore: input.minScore ?? 0
    }
    const bases = await this.activeBases(parsed)
    const external = await this.searchExternalBases(bases, parsed)
    const localBases = bases.filter((base) => base.providerKind === 'local-sqlite')
    const local = localBases.length ? await this.searchLocalBases(localBases, parsed) : []
    return [...local, ...external]
      .filter((result) => result.score >= parsed.minScore)
      .sort((a, b) => b.score - a.score || a.documentName.localeCompare(b.documentName))
      .slice(0, parsed.topK)
  }

  async diagnostics(): Promise<KnowledgeDiagnostics> {
    await this.readyPromise
    if (!this.db) {
      return {
        enabled: this.options.config.enabled,
        rootDir: this.options.rootDir,
        sqlitePath: this.sqlitePath(),
        available: false,
        reason: this.unavailableReason ?? 'sqlite unavailable',
        knowledgeBaseCount: 0,
        documentCount: 0,
        chunkCount: 0,
        externalProviderCount: 0
      }
    }
    const row = this.db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM knowledge_bases) AS knowledge_base_count,
        (SELECT COUNT(*) FROM knowledge_documents WHERE status != 'deleted') AS document_count,
        (SELECT COUNT(*) FROM knowledge_chunks) AS chunk_count,
        (SELECT COUNT(*) FROM knowledge_bases WHERE provider_kind = 'external') AS external_provider_count
    `).get() as {
      knowledge_base_count: number
      document_count: number
      chunk_count: number
      external_provider_count: number
    }
    return {
      enabled: this.options.config.enabled,
      rootDir: this.options.rootDir,
      sqlitePath: this.sqlitePath(),
      available: true,
      knowledgeBaseCount: row.knowledge_base_count,
      documentCount: row.document_count,
      chunkCount: row.chunk_count,
      externalProviderCount: row.external_provider_count
    }
  }

  close(): void {
    try {
      this.db?.close()
    } finally {
      this.db = null
      this.statementCache.clear()
    }
  }

  private async ready(): Promise<void> {
    await this.readyPromise
    if (!this.db) {
      throw new Error(this.unavailableReason ?? 'knowledge sqlite unavailable')
    }
  }

  private async initialize(): Promise<void> {
    await mkdir(this.options.rootDir, { recursive: true })
    await mkdir(dirname(this.sqlitePath()), { recursive: true })
    try {
      const sqlite = await import('better-sqlite3')
      const Database = sqlite.default
      this.db = new Database(this.sqlitePath())
      this.db.pragma('journal_mode = WAL')
      this.db.pragma('busy_timeout = 5000')
      this.db.pragma('foreign_keys = ON')
      this.migrate()
    } catch (error) {
      this.unavailableReason = errorMessage(error)
      try {
        this.db?.close()
      } catch {
        // Ignore close errors while surfacing diagnostics.
      }
      this.db = null
    }
  }

  private migrate(): void {
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_bases (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        workspace TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        provider_kind TEXT NOT NULL DEFAULT 'local-sqlite',
        embedding_provider_id TEXT,
        embedding_base_url TEXT,
        embedding_api_key TEXT,
        embedding_model TEXT,
        embedding_dimensions INTEGER,
        reranker_enabled INTEGER NOT NULL DEFAULT 0,
        reranker_provider_id TEXT,
        reranker_base_url TEXT,
        reranker_api_key TEXT,
        reranker_model TEXT,
        external_provider TEXT,
        external_endpoint TEXT,
        external_api_key TEXT,
        external_metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id TEXT PRIMARY KEY,
        knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_path TEXT,
        mime_type TEXT,
        content_hash TEXT NOT NULL,
        byte_size INTEGER NOT NULL,
        chunk_count INTEGER NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id TEXT PRIMARY KEY,
        knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
        document_id TEXT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL,
        text TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        token_estimate INTEGER NOT NULL,
        embedding_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_knowledge_bases_workspace ON knowledge_bases(workspace);
      CREATE INDEX IF NOT EXISTS idx_knowledge_documents_base ON knowledge_documents(knowledge_base_id);
      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_base ON knowledge_chunks(knowledge_base_id);
      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document ON knowledge_chunks(document_id);

      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks_fts USING fts5(
        chunk_id UNINDEXED,
        knowledge_base_id UNINDEXED,
        document_id UNINDEXED,
        text,
        source_text
      );
    `)
  }

  private async materializeDocument(input: KnowledgeDocumentCreateRequest & { knowledgeBaseId: string }): Promise<{
    name: string
    sourceType: KnowledgeDocumentSourceType
    sourcePath?: string
    mimeType?: string
    text: string
    hash: string
    byteSize: number
  }> {
    if (input.text) {
      const text = input.text
      const bytes = Buffer.byteLength(text, 'utf8')
      if (bytes > this.options.config.maxDocumentBytes) {
        throw new Error(`document is too large: ${bytes} > ${this.options.config.maxDocumentBytes}`)
      }
      const name = input.name?.trim() || 'Text note'
      return {
        name,
        sourceType: input.sourceType ?? 'text',
        ...(input.mimeType ? { mimeType: input.mimeType } : {}),
        text,
        hash: sha256Hex(text),
        byteSize: bytes
      }
    }
    const rawPath = input.sourcePath?.trim()
    if (!rawPath) throw new Error('sourcePath is required')
    const sourcePath = resolve(rawPath)
    const info = await stat(sourcePath)
    if (!info.isFile()) throw new Error(`sourcePath is not a file: ${sourcePath}`)
    if (info.size > this.options.config.maxDocumentBytes) {
      throw new Error(`document is too large: ${info.size} > ${this.options.config.maxDocumentBytes}`)
    }
    const bytes = await readFile(sourcePath)
    const text = bytes.toString('utf8')
    return {
      name: input.name?.trim() || basename(sourcePath),
      sourceType: input.sourceType ?? 'file',
      sourcePath,
      ...(input.mimeType ? { mimeType: input.mimeType } : {}),
      text,
      hash: sha256Hex(bytes),
      byteSize: bytes.byteLength
    }
  }

  private async embedChunks(kb: KnowledgeBaseRecord, chunks: string[]): Promise<number[][]> {
    if (!this.options.embeddingProvider) return []
    const embeddings: number[][] = []
    const batchSize = 16
    for (let index = 0; index < chunks.length; index += batchSize) {
      const batch = chunks.slice(index, index + batchSize)
      const embedded = await this.options.embeddingProvider.embed({
        texts: batch,
        baseUrl: kb.embedding.baseUrl,
        apiKey: kb.embedding.apiKey,
        model: kb.embedding.model,
        dimensions: kb.embedding.dimensions
      })
      embeddings.push(...embedded)
    }
    return embeddings
  }

  private async activeBases(input: {
    workspace?: string
    knowledgeBaseIds?: string[]
  }): Promise<KnowledgeBaseRecord[]> {
    const workspace = normalizeWorkspace(input.workspace)
    const ids = new Set((input.knowledgeBaseIds ?? []).map((id) => id.trim()).filter(Boolean))
    return (await this.listKnowledgeBases({ workspace }))
      .filter((base) => ids.size === 0 || ids.has(base.id))
  }

  private async searchLocalBases(
    bases: KnowledgeBaseRecord[],
    input: { query: string; topK: number }
  ): Promise<KnowledgeChunkSearchResult[]> {
    const baseIds = bases.map((base) => base.id)
    const candidates = new Map<string, KnowledgeChunkSearchResult>()
    for (const candidate of this.searchFts(baseIds, input.query, Math.max(input.topK * 8, 80))) {
      candidates.set(candidate.chunkId, candidate)
    }
    for (const candidate of this.searchLexicalFallback(baseIds, input.query, Math.max(input.topK * 8, 80))) {
      const existing = candidates.get(candidate.chunkId)
      if (!existing || existing.score < candidate.score) candidates.set(candidate.chunkId, candidate)
    }
    for (const base of bases.filter(isEmbeddingConfigured)) {
      for (const candidate of await this.searchVectors(base, input.query, Math.max(input.topK * 8, 80))) {
        const existing = candidates.get(candidate.chunkId)
        if (existing) {
          const vectorScore = candidate.vectorScore ?? 0
          existing.vectorScore = vectorScore
          existing.score = Math.max(existing.score, (existing.score * 0.45) + (((vectorScore + 1) / 2) * 0.55))
        } else {
          candidates.set(candidate.chunkId, candidate)
        }
      }
    }
    let results = [...candidates.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(input.topK * 3, input.topK))
    results = await this.rerankIfConfigured(bases, input.query, results)
    return results.slice(0, input.topK)
  }

  private searchFts(baseIds: string[], query: string, limit: number): KnowledgeChunkSearchResult[] {
    const ftsQuery = buildFtsQuery(query)
    if (!ftsQuery) return []
    const baseClause = placeholders(baseIds, 'base')
    const rows = this.db!.prepare(`
      SELECT
        c.id,
        c.knowledge_base_id,
        kb.name AS knowledge_base_name,
        c.document_id,
        d.name AS document_name,
        d.source_type,
        d.source_path,
        c.ordinal,
        c.text,
        c.embedding_json,
        bm25(knowledge_chunks_fts) AS bm25_rank
      FROM knowledge_chunks_fts
      JOIN knowledge_chunks c ON c.id = knowledge_chunks_fts.chunk_id
      JOIN knowledge_bases kb ON kb.id = c.knowledge_base_id
      JOIN knowledge_documents d ON d.id = c.document_id
      WHERE knowledge_chunks_fts.text MATCH @query
        AND c.knowledge_base_id IN (${baseClause.sql})
        AND d.status = 'ready'
      ORDER BY bm25_rank ASC
      LIMIT @limit
    `).all({
      query: ftsQuery,
      limit,
      ...baseClause.params
    }) as KnowledgeChunkRow[]
    return rows.map((row) => {
      const bm25Score = 1 / (1 + Math.abs(row.bm25_rank ?? 0))
      return rowToSearchResult(row, { score: bm25Score, bm25Score })
    })
  }

  private searchLexicalFallback(baseIds: string[], query: string, limit: number): KnowledgeChunkSearchResult[] {
    const baseClause = placeholders(baseIds, 'base')
    const rows = this.db!.prepare(`
      SELECT
        c.id,
        c.knowledge_base_id,
        kb.name AS knowledge_base_name,
        c.document_id,
        d.name AS document_name,
        d.source_type,
        d.source_path,
        c.ordinal,
        c.text,
        c.embedding_json
      FROM knowledge_chunks c
      JOIN knowledge_bases kb ON kb.id = c.knowledge_base_id
      JOIN knowledge_documents d ON d.id = c.document_id
      WHERE c.knowledge_base_id IN (${baseClause.sql})
        AND d.status = 'ready'
      ORDER BY c.updated_at DESC
      LIMIT 500
    `).all(baseClause.params) as KnowledgeChunkRow[]
    return rows
      .map((row) => rowToSearchResult(row, { score: lexicalScore(`${row.document_name ?? ''}\n${row.text}`, query) }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  private async searchVectors(base: KnowledgeBaseRecord, query: string, limit: number): Promise<KnowledgeChunkSearchResult[]> {
    if (!this.options.embeddingProvider) return []
    let queryEmbedding: number[]
    try {
      const embedded = await this.options.embeddingProvider.embed({
        texts: [query],
        baseUrl: base.embedding.baseUrl,
        apiKey: base.embedding.apiKey,
        model: base.embedding.model,
        dimensions: base.embedding.dimensions
      })
      queryEmbedding = embedded[0] ?? []
    } catch {
      return []
    }
    if (queryEmbedding.length === 0) return []
    const rows = this.cachedStatement(`
      SELECT
        c.id,
        c.knowledge_base_id,
        kb.name AS knowledge_base_name,
        c.document_id,
        d.name AS document_name,
        d.source_type,
        d.source_path,
        c.ordinal,
        c.text,
        c.embedding_json
      FROM knowledge_chunks c
      JOIN knowledge_bases kb ON kb.id = c.knowledge_base_id
      JOIN knowledge_documents d ON d.id = c.document_id
      WHERE c.knowledge_base_id = ?
        AND c.embedding_json IS NOT NULL
        AND d.status = 'ready'
      ORDER BY c.updated_at DESC
      LIMIT 2000
    `).all(base.id) as KnowledgeChunkRow[]
    return rows
      .map((row) => {
        const vector = parseEmbedding(row.embedding_json)
        const vectorScore = vector ? cosineSimilarity(queryEmbedding, vector) : 0
        return rowToSearchResult(row, {
          score: (vectorScore + 1) / 2,
          vectorScore
        })
      })
      .filter((result) => (result.vectorScore ?? 0) > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  private async rerankIfConfigured(
    bases: KnowledgeBaseRecord[],
    query: string,
    results: KnowledgeChunkSearchResult[]
  ): Promise<KnowledgeChunkSearchResult[]> {
    if (!this.options.rerankerProvider || results.length === 0) return results
    const baseById = new Map(bases.map((base) => [base.id, base]))
    const rerankBase = results
      .map((result) => baseById.get(result.knowledgeBaseId))
      .find((base) => base?.reranker.enabled && base.reranker.baseUrl && base.reranker.model)
    if (!rerankBase) return results
    try {
      const reranked = await this.options.rerankerProvider.rerank({
        query,
        documents: results.map((result) => result.text),
        baseUrl: rerankBase.reranker.baseUrl,
        apiKey: rerankBase.reranker.apiKey,
        model: rerankBase.reranker.model,
        topK: results.length
      })
      const scoreByIndex = new Map(reranked.map((entry) => [entry.index, entry.score]))
      return results
        .map((result, index) => {
          const rerankScore = scoreByIndex.get(index)
          if (rerankScore === undefined) return result
          return {
            ...result,
            rerankScore,
            score: Math.max(0, (result.score * 0.3) + (rerankScore * 0.7))
          }
        })
        .sort((a, b) => b.score - a.score)
    } catch {
      return results
    }
  }

  private async searchExternalBases(
    bases: KnowledgeBaseRecord[],
    input: { query: string; topK: number; workspace?: string }
  ): Promise<KnowledgeChunkSearchResult[]> {
    const out: KnowledgeChunkSearchResult[] = []
    for (const base of bases.filter((candidate) => candidate.providerKind === 'external')) {
      const endpoint = base.external?.endpoint?.trim()
      if (!endpoint) continue
      try {
        const response = await (this.options.fetchImpl ?? fetch)(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(base.external?.apiKey ? { authorization: `Bearer ${base.external.apiKey}` } : {})
          },
          body: JSON.stringify({
            query: input.query,
            topK: input.topK,
            workspace: input.workspace,
            knowledgeBaseId: base.id,
            provider: base.external?.provider
          })
        })
        if (!response.ok) continue
        const json = await response.json() as ExternalSearchResponse
        const results = Array.isArray(json.results) ? json.results : []
        for (const [index, raw] of results.entries()) {
          const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
          const text = typeof record.text === 'string' ? record.text : typeof record.content === 'string' ? record.content : ''
          if (!text.trim()) continue
          out.push(KnowledgeChunkSearchResult.parse({
            knowledgeBaseId: base.id,
            knowledgeBaseName: base.name,
            documentId: typeof record.documentId === 'string' ? record.documentId : `external_${index}`,
            documentName: typeof record.documentName === 'string' ? record.documentName : base.name,
            sourceType: 'external',
            ...(typeof record.sourcePath === 'string' ? { sourcePath: record.sourcePath } : {}),
            chunkId: typeof record.chunkId === 'string' ? record.chunkId : `external_${index}`,
            ordinal: typeof record.ordinal === 'number' ? record.ordinal : index,
            text,
            score: typeof record.score === 'number' ? record.score : 0.5
          }))
        }
      } catch {
        // External providers are optional; one failed connector should not break local search.
      }
    }
    return out
  }

  private async mustGetKnowledgeBase(id: string): Promise<KnowledgeBaseRecord> {
    const row = this.db!.prepare(`
      SELECT
        kb.*,
        COUNT(DISTINCT CASE WHEN d.status != 'deleted' THEN d.id END) AS document_count,
        COUNT(c.id) AS chunk_count
      FROM knowledge_bases kb
      LEFT JOIN knowledge_documents d ON d.knowledge_base_id = kb.id
      LEFT JOIN knowledge_chunks c ON c.knowledge_base_id = kb.id
      WHERE kb.id = ?
      GROUP BY kb.id
    `).get(id) as KnowledgeBaseRow | undefined
    if (!row) throw new Error(`knowledge base not found: ${id}`)
    return rowToKnowledgeBase(row)
  }

  private async mustGetDocument(knowledgeBaseId: string, documentId: string): Promise<KnowledgeDocumentRecord> {
    const row = this.cachedStatement(`
      SELECT * FROM knowledge_documents
      WHERE knowledge_base_id = ? AND id = ?
    `).get(knowledgeBaseId, documentId) as KnowledgeDocumentRow | undefined
    if (!row) throw new Error(`knowledge document not found: ${documentId}`)
    return rowToDocument(row)
  }

  private insertDocument(document: KnowledgeDocumentRecord): void {
    this.cachedStatement(`
      INSERT INTO knowledge_documents (
        id, knowledge_base_id, name, source_type, source_path, mime_type,
        content_hash, byte_size, chunk_count, status, error, created_at, updated_at
      ) VALUES (
        @id, @knowledge_base_id, @name, @source_type, @source_path, @mime_type,
        @content_hash, @byte_size, @chunk_count, @status, @error, @created_at, @updated_at
      )
    `).run(documentToRow(document))
  }

  private touchKnowledgeBase(id: string, updatedAt: string): void {
    this.cachedStatement('UPDATE knowledge_bases SET updated_at = ? WHERE id = ?').run(updatedAt, id)
  }

  private cachedStatement(sql: string): Statement {
    const key = sql.trim()
    const existing = this.statementCache.get(key)
    if (existing) return existing
    const statement = this.db!.prepare(sql)
    this.statementCache.set(key, statement)
    return statement
  }

  private sqlitePath(): string {
    return resolve(this.options.sqlitePath ?? join(this.options.rootDir, 'knowledge.sqlite3'))
  }

  private nextId(prefix: string): string {
    return this.options.idGenerator?.() ?? `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 18)}`
  }

  private now(): string {
    return this.options.nowIso?.() ?? new Date().toISOString()
  }
}

function rowToKnowledgeBase(row: KnowledgeBaseRow): KnowledgeBaseRecord {
  return KnowledgeBaseRecord.parse({
    id: row.id,
    name: row.name,
    ...(row.description ? { description: row.description } : {}),
    ...(row.workspace ? { workspace: row.workspace } : {}),
    enabled: row.enabled === 1,
    providerKind: row.provider_kind,
    embedding: {
      ...(row.embedding_provider_id ? { providerId: row.embedding_provider_id } : {}),
      ...(row.embedding_base_url ? { baseUrl: row.embedding_base_url } : {}),
      ...(row.embedding_api_key !== null ? { apiKey: row.embedding_api_key } : {}),
      ...(row.embedding_model ? { model: row.embedding_model } : {}),
      ...(row.embedding_dimensions ? { dimensions: row.embedding_dimensions } : {})
    },
    reranker: {
      enabled: row.reranker_enabled === 1,
      ...(row.reranker_provider_id ? { providerId: row.reranker_provider_id } : {}),
      ...(row.reranker_base_url ? { baseUrl: row.reranker_base_url } : {}),
      ...(row.reranker_api_key !== null ? { apiKey: row.reranker_api_key } : {}),
      ...(row.reranker_model ? { model: row.reranker_model } : {})
    },
    ...(row.provider_kind === 'external' ? {
      external: {
        ...(row.external_provider ? { provider: row.external_provider } : {}),
        ...(row.external_endpoint ? { endpoint: row.external_endpoint } : {}),
        ...(row.external_api_key !== null ? { apiKey: row.external_api_key } : {}),
        metadata: parseJsonObject(row.external_metadata_json)
      }
    } : {}),
    documentCount: row.document_count ?? 0,
    chunkCount: row.chunk_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })
}

function knowledgeBaseToRow(record: KnowledgeBaseRecord): Record<string, unknown> {
  return {
    id: record.id,
    name: record.name,
    description: record.description ?? null,
    workspace: record.workspace ?? null,
    enabled: record.enabled ? 1 : 0,
    provider_kind: record.providerKind,
    embedding_provider_id: record.embedding.providerId ?? null,
    embedding_base_url: record.embedding.baseUrl ?? null,
    embedding_api_key: record.embedding.apiKey ?? null,
    embedding_model: record.embedding.model ?? null,
    embedding_dimensions: record.embedding.dimensions ?? null,
    reranker_enabled: record.reranker.enabled ? 1 : 0,
    reranker_provider_id: record.reranker.providerId ?? null,
    reranker_base_url: record.reranker.baseUrl ?? null,
    reranker_api_key: record.reranker.apiKey ?? null,
    reranker_model: record.reranker.model ?? null,
    external_provider: record.external?.provider ?? null,
    external_endpoint: record.external?.endpoint ?? null,
    external_api_key: record.external?.apiKey ?? null,
    external_metadata_json: record.external?.metadata ? JSON.stringify(record.external.metadata) : null,
    created_at: record.createdAt,
    updated_at: record.updatedAt
  }
}

function rowToDocument(row: KnowledgeDocumentRow): KnowledgeDocumentRecord {
  return KnowledgeDocumentRecord.parse({
    id: row.id,
    knowledgeBaseId: row.knowledge_base_id,
    name: row.name,
    sourceType: row.source_type,
    ...(row.source_path ? { sourcePath: row.source_path } : {}),
    ...(row.mime_type ? { mimeType: row.mime_type } : {}),
    contentHash: row.content_hash,
    byteSize: row.byte_size,
    chunkCount: row.chunk_count,
    status: row.status,
    ...(row.error ? { error: row.error } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })
}

function documentToRow(record: KnowledgeDocumentRecord): Record<string, unknown> {
  return {
    id: record.id,
    knowledge_base_id: record.knowledgeBaseId,
    name: record.name,
    source_type: record.sourceType,
    source_path: record.sourcePath ?? null,
    mime_type: record.mimeType ?? null,
    content_hash: record.contentHash,
    byte_size: record.byteSize,
    chunk_count: record.chunkCount,
    status: record.status,
    error: record.error ?? null,
    created_at: record.createdAt,
    updated_at: record.updatedAt
  }
}

function rowToSearchResult(
  row: KnowledgeChunkRow,
  scores: { score: number; bm25Score?: number; vectorScore?: number }
): KnowledgeChunkSearchResult {
  return KnowledgeChunkSearchResult.parse({
    knowledgeBaseId: row.knowledge_base_id,
    knowledgeBaseName: row.knowledge_base_name ?? '',
    documentId: row.document_id,
    documentName: row.document_name ?? '',
    sourceType: row.source_type ?? 'text',
    ...(row.source_path ? { sourcePath: row.source_path } : {}),
    chunkId: row.id,
    ordinal: row.ordinal,
    text: row.text,
    score: Math.max(0, scores.score),
    ...(scores.bm25Score !== undefined ? { bm25Score: Math.max(0, scores.bm25Score) } : {}),
    ...(scores.vectorScore !== undefined ? { vectorScore: scores.vectorScore } : {})
  })
}

function splitText(text: string, options: { chunkSize: number; overlap: number }): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!normalized) return []
  const chunks: string[] = []
  let offset = 0
  while (offset < normalized.length) {
    let end = Math.min(normalized.length, offset + options.chunkSize)
    if (end < normalized.length) {
      const boundary = Math.max(
        normalized.lastIndexOf('\n\n', end),
        normalized.lastIndexOf('\n', end),
        normalized.lastIndexOf('\u3002', end),
        normalized.lastIndexOf('.', end)
      )
      if (boundary > offset + Math.floor(options.chunkSize * 0.5)) end = boundary + 1
    }
    const chunk = normalized.slice(offset, end).trim()
    if (chunk) chunks.push(chunk)
    if (end >= normalized.length) break
    offset = Math.max(end - options.overlap, offset + 1)
  }
  return chunks
}

function buildFtsQuery(query: string): string {
  const tokens = query
    .toLowerCase()
    .match(/[\p{L}\p{N}_]{2,}/gu)
    ?.slice(0, 12) ?? []
  return [...new Set(tokens)]
    .map((token) => `"${token.replace(/"/g, '""')}"`)
    .join(' OR ')
}

function lexicalScore(text: string, query: string): number {
  const queryGrams = ngrams(query)
  if (queryGrams.size === 0) return 0
  const textGrams = ngrams(text)
  let overlap = 0
  for (const gram of queryGrams) {
    if (textGrams.has(gram)) overlap += 1
  }
  return overlap / queryGrams.size
}

function ngrams(input: string): Set<string> {
  const grams = new Set<string>()
  const normalized = input.toLowerCase()
  const asciiWords = normalized.match(/[a-z0-9_]{2,}/g) ?? []
  for (const word of asciiWords) {
    if (word.length <= 3) {
      grams.add(word)
      continue
    }
    for (let index = 0; index + 3 <= word.length; index += 1) {
      grams.add(word.slice(index, index + 3))
    }
  }
  const cjkRuns = normalized.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g) ?? []
  for (const run of cjkRuns) {
    for (let index = 0; index + 2 <= run.length; index += 1) {
      grams.add(run.slice(index, index + 2))
    }
    if (run.length < 2) grams.add(run)
  }
  return grams
}

function placeholders(values: string[], prefix: string): { sql: string; params: Record<string, string> } {
  const params: Record<string, string> = {}
  const names = values.map((value, index) => {
    const name = `${prefix}_${index}`
    params[name] = value
    return `@${name}`
  })
  return { sql: names.length ? names.join(', ') : "''", params }
}

function parseEmbedding(value: string | null): number[] | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'number') ? parsed : null
  } catch {
    return null
  }
}

function parseJsonObject(value: string | null): Record<string, unknown> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

function normalizeWorkspace(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  const normalized = resolve(trimmed)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function isEmbeddingConfigured(base: KnowledgeBaseRecord): boolean {
  return Boolean(base.embedding.baseUrl?.trim() && base.embedding.model?.trim())
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
