import {
  KnowledgeCreateRequest,
  KnowledgeDocumentCreateRequest,
  KnowledgeSearchRequest,
  KnowledgeUpdateRequest
} from '../../contracts/knowledge.js'
import type { KnowledgeProvider } from '../../knowledge/knowledge-provider.js'
import { jsonResponse, type JsonResponse } from '../response.js'
import { readJsonBody } from '../read-json-body.js'
import { ERRORS } from './runtime-error.js'

export async function listKnowledgeBases(
  store: KnowledgeProvider | undefined,
  request: Request
): Promise<JsonResponse> {
  if (!store) return ERRORS.unavailable('knowledge store is unavailable')
  const url = new URL(request.url)
  return jsonResponse({
    knowledgeBases: await store.listKnowledgeBases({
      workspace: url.searchParams.get('workspace') ?? undefined,
      includeDisabled: url.searchParams.get('include_disabled') === 'true'
    })
  })
}

export async function createKnowledgeBase(
  store: KnowledgeProvider | undefined,
  request: Request
): Promise<JsonResponse | Response> {
  if (!store) return ERRORS.unavailable('knowledge store is unavailable')
  const body = await readJsonBody(request)
  if (!body.ok) return body.response
  const parsed = KnowledgeCreateRequest.safeParse(body.value)
  if (!parsed.success) return ERRORS.validation('invalid knowledge base create body', parsed.error.issues)
  return jsonResponse({ knowledgeBase: await store.createKnowledgeBase(parsed.data) }, 201)
}

export async function updateKnowledgeBase(
  store: KnowledgeProvider | undefined,
  id: string,
  request: Request
): Promise<JsonResponse | Response> {
  if (!store) return ERRORS.unavailable('knowledge store is unavailable')
  const body = await readJsonBody(request)
  if (!body.ok) return body.response
  const parsed = KnowledgeUpdateRequest.safeParse(body.value)
  if (!parsed.success) return ERRORS.validation('invalid knowledge base update body', parsed.error.issues)
  try {
    return jsonResponse({ knowledgeBase: await store.updateKnowledgeBase(id, parsed.data) })
  } catch (error) {
    return ERRORS.notFound(errorMessage(error))
  }
}

export async function deleteKnowledgeBase(
  store: KnowledgeProvider | undefined,
  id: string
): Promise<JsonResponse> {
  if (!store) return ERRORS.unavailable('knowledge store is unavailable')
  try {
    return jsonResponse({ knowledgeBase: await store.deleteKnowledgeBase(id) })
  } catch (error) {
    return ERRORS.notFound(errorMessage(error))
  }
}

export async function listKnowledgeDocuments(
  store: KnowledgeProvider | undefined,
  knowledgeBaseId: string
): Promise<JsonResponse> {
  if (!store) return ERRORS.unavailable('knowledge store is unavailable')
  try {
    return jsonResponse({ documents: await store.listDocuments(knowledgeBaseId) })
  } catch (error) {
    return ERRORS.notFound(errorMessage(error))
  }
}

export async function addKnowledgeDocument(
  store: KnowledgeProvider | undefined,
  knowledgeBaseId: string,
  request: Request
): Promise<JsonResponse | Response> {
  if (!store) return ERRORS.unavailable('knowledge store is unavailable')
  const body = await readJsonBody(request)
  if (!body.ok) return body.response
  const parsed = KnowledgeDocumentCreateRequest.safeParse(body.value)
  if (!parsed.success) return ERRORS.validation('invalid knowledge document body', parsed.error.issues)
  try {
    return jsonResponse({
      document: await store.addDocument({
        ...parsed.data,
        knowledgeBaseId
      })
    }, 201)
  } catch (error) {
    return ERRORS.validation(errorMessage(error))
  }
}

export async function deleteKnowledgeDocument(
  store: KnowledgeProvider | undefined,
  knowledgeBaseId: string,
  documentId: string
): Promise<JsonResponse> {
  if (!store) return ERRORS.unavailable('knowledge store is unavailable')
  try {
    return jsonResponse({ document: await store.deleteDocument(knowledgeBaseId, documentId) })
  } catch (error) {
    return ERRORS.notFound(errorMessage(error))
  }
}

export async function searchKnowledgeBases(
  store: KnowledgeProvider | undefined,
  request: Request
): Promise<JsonResponse | Response> {
  if (!store) return ERRORS.unavailable('knowledge store is unavailable')
  const body = await readJsonBody(request)
  if (!body.ok) return body.response
  const parsed = KnowledgeSearchRequest.safeParse(body.value)
  if (!parsed.success) return ERRORS.validation('invalid knowledge search body', parsed.error.issues)
  return jsonResponse({ results: await store.search(parsed.data) })
}

export async function knowledgeDiagnostics(
  store: KnowledgeProvider | undefined
): Promise<JsonResponse> {
  if (!store) {
    return jsonResponse({
      enabled: false,
      rootDir: '',
      sqlitePath: '',
      available: false,
      reason: 'knowledge store is disabled',
      knowledgeBaseCount: 0,
      documentCount: 0,
      chunkCount: 0,
      externalProviderCount: 0
    })
  }
  return jsonResponse(await store.diagnostics())
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
