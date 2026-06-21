import type { KnowledgeProvider } from '../../knowledge/knowledge-provider.js'
import type { CapabilityToolProvider } from './capability-registry.js'
import { LocalToolHost } from './local-tool-host.js'

export function buildKnowledgeToolProviders(store: KnowledgeProvider | undefined): CapabilityToolProvider[] {
  if (!store) return []
  return [{
    id: 'knowledge',
    kind: 'knowledge',
    enabled: true,
    available: true,
    tools: [
      LocalToolHost.defineTool({
        name: 'knowledge_search',
        description: 'Search the user-managed Kun knowledge bases. Returns cited chunks from local SQLite RAG and configured external RAG providers.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Natural-language query or keywords to retrieve supporting context.'
            },
            knowledgeBaseIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional knowledge base ids. Empty means all enabled bases visible to this workspace.'
            },
            topK: {
              type: 'number',
              description: 'Maximum number of chunks to return. Default follows runtime config.'
            }
          },
          required: ['query'],
          additionalProperties: false
        },
        policy: 'auto',
        execute: async (args, context) => {
          const query = typeof args.query === 'string' ? args.query.trim() : ''
          if (!query) return { output: { error: 'query is required' }, isError: true }
          const knowledgeBaseIds = Array.isArray(args.knowledgeBaseIds)
            ? args.knowledgeBaseIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
            : []
          const topK = typeof args.topK === 'number' && Number.isFinite(args.topK)
            ? Math.max(1, Math.min(50, Math.floor(args.topK)))
            : undefined
          const results = await store.search({
            query,
            workspace: context.workspace,
            knowledgeBaseIds,
            ...(topK ? { topK } : {})
          })
          return {
            output: {
              query,
              resultCount: results.length,
              results: results.map((result, index) => ({
                rank: index + 1,
                knowledgeBaseId: result.knowledgeBaseId,
                knowledgeBaseName: result.knowledgeBaseName,
                documentId: result.documentId,
                documentName: result.documentName,
                sourceType: result.sourceType,
                sourcePath: result.sourcePath,
                chunkId: result.chunkId,
                ordinal: result.ordinal,
                score: Number(result.score.toFixed(4)),
                bm25Score: result.bm25Score === undefined ? undefined : Number(result.bm25Score.toFixed(4)),
                vectorScore: result.vectorScore === undefined ? undefined : Number(result.vectorScore.toFixed(4)),
                rerankScore: result.rerankScore === undefined ? undefined : Number(result.rerankScore.toFixed(4)),
                citation: `${result.knowledgeBaseName} / ${result.documentName} #${result.ordinal + 1}`,
                text: truncateChunk(result.text)
              }))
            }
          }
        }
      })
    ]
  }]
}

function truncateChunk(text: string): string {
  return text.length > 3_000 ? `${text.slice(0, 3_000)}\n...[truncated]` : text
}
