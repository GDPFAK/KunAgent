import { z } from 'zod'

const HTTP_URL_MAX_LENGTH = 4096
const API_KEY_MAX_LENGTH = 8192
const NAME_MAX_LENGTH = 200
const DESCRIPTION_MAX_LENGTH = 4000

const HttpUrlString = z.string().min(1).max(HTTP_URL_MAX_LENGTH).refine((value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}, 'must be an http(s) URL')

export const KnowledgeProviderKind = z.enum(['local-sqlite', 'external'])
export type KnowledgeProviderKind = z.infer<typeof KnowledgeProviderKind>

export const KnowledgeDocumentSourceType = z.enum(['text', 'file', 'generated', 'external'])
export type KnowledgeDocumentSourceType = z.infer<typeof KnowledgeDocumentSourceType>

export const KnowledgeDocumentStatus = z.enum(['ready', 'indexing', 'failed', 'deleted'])
export type KnowledgeDocumentStatus = z.infer<typeof KnowledgeDocumentStatus>

export const KnowledgeEmbeddingConfig = z.object({
  providerId: z.string().min(1).optional(),
  baseUrl: HttpUrlString.optional(),
  apiKey: z.string().max(API_KEY_MAX_LENGTH).optional(),
  model: z.string().min(1).max(NAME_MAX_LENGTH).optional(),
  dimensions: z.number().int().positive().optional()
}).strict()
export type KnowledgeEmbeddingConfig = z.infer<typeof KnowledgeEmbeddingConfig>

export const KnowledgeRerankerConfig = z.object({
  enabled: z.boolean().default(false),
  providerId: z.string().min(1).optional(),
  baseUrl: HttpUrlString.optional(),
  apiKey: z.string().max(API_KEY_MAX_LENGTH).optional(),
  model: z.string().min(1).max(NAME_MAX_LENGTH).optional()
}).strict()
export type KnowledgeRerankerConfig = z.infer<typeof KnowledgeRerankerConfig>

export const ExternalKnowledgeConfig = z.object({
  provider: z.string().min(1).max(NAME_MAX_LENGTH).optional(),
  endpoint: HttpUrlString.optional(),
  apiKey: z.string().max(API_KEY_MAX_LENGTH).optional(),
  metadata: z.record(z.string(), z.unknown()).default({})
}).strict()
export type ExternalKnowledgeConfig = z.infer<typeof ExternalKnowledgeConfig>

export const KnowledgeBaseRecord = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(NAME_MAX_LENGTH),
  description: z.string().max(DESCRIPTION_MAX_LENGTH).optional(),
  workspace: z.string().optional(),
  enabled: z.boolean(),
  providerKind: KnowledgeProviderKind,
  embedding: KnowledgeEmbeddingConfig.default({}),
  reranker: KnowledgeRerankerConfig.default({ enabled: false }),
  external: ExternalKnowledgeConfig.optional(),
  documentCount: z.number().int().nonnegative(),
  chunkCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string()
}).strict()
export type KnowledgeBaseRecord = z.infer<typeof KnowledgeBaseRecord>

export const KnowledgeDocumentRecord = z.object({
  id: z.string().min(1),
  knowledgeBaseId: z.string().min(1),
  name: z.string().min(1).max(NAME_MAX_LENGTH),
  sourceType: KnowledgeDocumentSourceType,
  sourcePath: z.string().optional(),
  mimeType: z.string().optional(),
  contentHash: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  chunkCount: z.number().int().nonnegative(),
  status: KnowledgeDocumentStatus,
  error: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
}).strict()
export type KnowledgeDocumentRecord = z.infer<typeof KnowledgeDocumentRecord>

export const KnowledgeChunkSearchResult = z.object({
  knowledgeBaseId: z.string().min(1),
  knowledgeBaseName: z.string().min(1),
  documentId: z.string().min(1),
  documentName: z.string().min(1),
  sourceType: KnowledgeDocumentSourceType,
  sourcePath: z.string().optional(),
  chunkId: z.string().min(1),
  ordinal: z.number().int().nonnegative(),
  text: z.string().min(1),
  score: z.number().nonnegative(),
  bm25Score: z.number().nonnegative().optional(),
  vectorScore: z.number().min(-1).max(1).optional(),
  rerankScore: z.number().optional()
}).strict()
export type KnowledgeChunkSearchResult = z.infer<typeof KnowledgeChunkSearchResult>

export const KnowledgeDiagnostics = z.object({
  enabled: z.boolean(),
  rootDir: z.string(),
  sqlitePath: z.string(),
  available: z.boolean(),
  reason: z.string().optional(),
  knowledgeBaseCount: z.number().int().nonnegative(),
  documentCount: z.number().int().nonnegative(),
  chunkCount: z.number().int().nonnegative(),
  externalProviderCount: z.number().int().nonnegative()
}).strict()
export type KnowledgeDiagnostics = z.infer<typeof KnowledgeDiagnostics>

export const KnowledgeCreateRequest = z.object({
  name: z.string().min(1).max(NAME_MAX_LENGTH),
  description: z.string().max(DESCRIPTION_MAX_LENGTH).optional(),
  workspace: z.string().optional(),
  providerKind: KnowledgeProviderKind.default('local-sqlite'),
  enabled: z.boolean().default(true),
  embedding: KnowledgeEmbeddingConfig.default({}),
  reranker: KnowledgeRerankerConfig.default({ enabled: false }),
  external: ExternalKnowledgeConfig.optional()
}).strict()
export type KnowledgeCreateRequest = z.input<typeof KnowledgeCreateRequest>

export const KnowledgeUpdateRequest = z.object({
  name: z.string().min(1).max(NAME_MAX_LENGTH).optional(),
  description: z.string().max(DESCRIPTION_MAX_LENGTH).optional(),
  enabled: z.boolean().optional(),
  providerKind: KnowledgeProviderKind.optional(),
  embedding: KnowledgeEmbeddingConfig.optional(),
  reranker: KnowledgeRerankerConfig.optional(),
  external: ExternalKnowledgeConfig.optional()
}).strict()
export type KnowledgeUpdateRequest = z.input<typeof KnowledgeUpdateRequest>

export const KnowledgeDocumentCreateRequest = z.object({
  name: z.string().min(1).max(NAME_MAX_LENGTH).optional(),
  sourceType: KnowledgeDocumentSourceType.default('text'),
  sourcePath: z.string().min(1).optional(),
  mimeType: z.string().optional(),
  text: z.string().min(1).optional()
}).strict().superRefine((input, ctx) => {
  if (!input.text && !input.sourcePath) {
    ctx.addIssue({
      code: 'custom',
      message: 'either text or sourcePath is required'
    })
  }
})
export type KnowledgeDocumentCreateRequest = z.input<typeof KnowledgeDocumentCreateRequest>

export const KnowledgeSearchRequest = z.object({
  query: z.string().min(1),
  workspace: z.string().optional(),
  knowledgeBaseIds: z.array(z.string().min(1)).default([]),
  topK: z.number().int().positive().max(50).default(8),
  minScore: z.number().nonnegative().default(0)
}).strict()
export type KnowledgeSearchRequest = z.input<typeof KnowledgeSearchRequest>
