import { createProxyFetch } from '../adapters/model/proxy-fetch.js'
import type { EmbeddingProvider, RerankerProvider } from './knowledge-provider.js'

type EmbeddingResponse = {
  data?: Array<{
    embedding?: number[]
  }>
}

type RerankResponse = {
  results?: Array<{
    index?: number
    relevance_score?: number
    score?: number
  }>
  data?: Array<{
    index?: number
    relevance_score?: number
    score?: number
  }>
}

export class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  private readonly fetchImpl: typeof fetch

  constructor(options: { fetchImpl?: typeof fetch; modelProxyUrl?: string } = {}) {
    this.fetchImpl = options.fetchImpl ?? createProxyFetch(options.modelProxyUrl ?? '') ?? fetch
  }

  async embed(input: {
    texts: string[]
    baseUrl?: string
    apiKey?: string
    model?: string
    dimensions?: number
    signal?: AbortSignal
  }): Promise<number[][]> {
    const model = input.model?.trim()
    const baseUrl = input.baseUrl?.trim()
    if (!model || !baseUrl || input.texts.length === 0) return []
    const body: Record<string, unknown> = {
      model,
      input: input.texts
    }
    if (input.dimensions) body.dimensions = input.dimensions
    const response = await this.fetchImpl(joinEndpoint(baseUrl, 'embeddings'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(input.apiKey ? { authorization: `Bearer ${input.apiKey}` } : {})
      },
      body: JSON.stringify(body),
      signal: input.signal
    })
    if (!response.ok) {
      throw new Error(`embedding request failed with status ${response.status}: ${await summarizedBody(response)}`)
    }
    const json = await response.json() as EmbeddingResponse
    const embeddings = (json.data ?? [])
      .map((entry) => entry.embedding)
      .filter((embedding): embedding is number[] =>
        Array.isArray(embedding) && embedding.every((value) => typeof value === 'number')
      )
    if (embeddings.length !== input.texts.length) {
      throw new Error(`embedding response count mismatch: expected ${input.texts.length}, got ${embeddings.length}`)
    }
    return embeddings
  }
}

export class OpenAICompatibleRerankerProvider implements RerankerProvider {
  private readonly fetchImpl: typeof fetch

  constructor(options: { fetchImpl?: typeof fetch; modelProxyUrl?: string } = {}) {
    this.fetchImpl = options.fetchImpl ?? createProxyFetch(options.modelProxyUrl ?? '') ?? fetch
  }

  async rerank(input: {
    query: string
    documents: string[]
    baseUrl?: string
    apiKey?: string
    model?: string
    topK?: number
    signal?: AbortSignal
  }): Promise<Array<{ index: number; score: number }>> {
    const model = input.model?.trim()
    const baseUrl = input.baseUrl?.trim()
    if (!model || !baseUrl || input.documents.length === 0) return []
    const response = await this.fetchImpl(joinEndpoint(baseUrl, 'rerank'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(input.apiKey ? { authorization: `Bearer ${input.apiKey}` } : {})
      },
      body: JSON.stringify({
        model,
        query: input.query,
        documents: input.documents,
        ...(input.topK ? { top_n: input.topK } : {})
      }),
      signal: input.signal
    })
    if (!response.ok) {
      throw new Error(`rerank request failed with status ${response.status}: ${await summarizedBody(response)}`)
    }
    const json = await response.json() as RerankResponse
    return (json.results ?? json.data ?? [])
      .map((entry) => {
        const index = typeof entry.index === 'number' ? entry.index : -1
        const score = typeof entry.relevance_score === 'number'
          ? entry.relevance_score
          : typeof entry.score === 'number'
            ? entry.score
            : 0
        return { index, score }
      })
      .filter((entry) => entry.index >= 0)
  }
}

function joinEndpoint(baseUrl: string, endpoint: 'embeddings' | 'rerank'): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (new RegExp(`/${endpoint}$`, 'i').test(trimmed)) return trimmed
  return `${trimmed}/${endpoint}`
}

async function summarizedBody(response: Response): Promise<string> {
  try {
    const text = await response.text()
    return text.replace(/\s+/g, ' ').slice(0, 500)
  } catch {
    return ''
  }
}

