import { createHash } from 'node:crypto'
import type {
  KnowledgeBaseRecord,
  KnowledgeChunkSearchResult,
  KnowledgeDocumentCreateRequest,
  KnowledgeDocumentRecord,
  KnowledgeCreateRequest,
  KnowledgeDiagnostics,
  KnowledgeSearchRequest,
  KnowledgeUpdateRequest
} from '../contracts/knowledge.js'

export type KnowledgeDocumentInput = KnowledgeDocumentCreateRequest & {
  knowledgeBaseId: string
}

export interface KnowledgeProvider {
  listKnowledgeBases(filter?: { workspace?: string; includeDisabled?: boolean }): Promise<KnowledgeBaseRecord[]>
  createKnowledgeBase(input: KnowledgeCreateRequest): Promise<KnowledgeBaseRecord>
  updateKnowledgeBase(id: string, patch: KnowledgeUpdateRequest): Promise<KnowledgeBaseRecord>
  deleteKnowledgeBase(id: string): Promise<KnowledgeBaseRecord>
  listDocuments(knowledgeBaseId: string): Promise<KnowledgeDocumentRecord[]>
  addDocument(input: KnowledgeDocumentInput): Promise<KnowledgeDocumentRecord>
  deleteDocument(knowledgeBaseId: string, documentId: string): Promise<KnowledgeDocumentRecord>
  search(input: KnowledgeSearchRequest): Promise<KnowledgeChunkSearchResult[]>
  diagnostics(): Promise<KnowledgeDiagnostics>
  close?(): void
}

export interface EmbeddingProvider {
  embed(input: {
    texts: string[]
    baseUrl?: string
    apiKey?: string
    model?: string
    dimensions?: number
    signal?: AbortSignal
  }): Promise<number[][]>
}

export interface RerankerProvider {
  rerank(input: {
    query: string
    documents: string[]
    baseUrl?: string
    apiKey?: string
    model?: string
    topK?: number
    signal?: AbortSignal
  }): Promise<Array<{ index: number; score: number }>>
}

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex')
}

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const length = Math.min(a.length, b.length)
  if (length === 0) return 0
  let dot = 0
  let aNorm = 0
  let bNorm = 0
  for (let index = 0; index < length; index += 1) {
    const av = a[index] ?? 0
    const bv = b[index] ?? 0
    dot += av * bv
    aNorm += av * av
    bNorm += bv * bv
  }
  if (aNorm <= 0 || bNorm <= 0) return 0
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm))
}

