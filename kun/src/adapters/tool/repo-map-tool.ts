import { searchRepoMap } from '../workspace/repo-map.js'
import type { LocalTool } from './local-tool-host.js'

export const repoMapTool: LocalTool = {
  name: 'repo_map',
  description: 'Search an incrementally indexed local repository by file path, symbols, dependencies, keywords, and recent Git changes before reading files.',
  toolKind: 'tool_call',
  policy: 'auto',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Symbol, dependency, file path, or concept to find.' },
      limit: { type: 'integer', minimum: 1, maximum: 50, default: 12 },
      refresh: { type: 'boolean', description: 'Force rebuilding changed index entries.' }
    },
    required: ['query']
  },
  execute: async (args, context) => {
    const query = typeof args.query === 'string' ? args.query.trim() : ''
    if (!query) return { output: { error: 'query is required' }, isError: true }
    if (!context.workspace.trim()) {
      return { output: { error: 'repo_map requires an active workspace' }, isError: true }
    }
    try {
      return {
        output: await searchRepoMap({
          workspace: context.workspace,
          query,
          limit: typeof args.limit === 'number' ? args.limit : undefined,
          refresh: args.refresh === true
        })
      }
    } catch (error) {
      return {
        output: { error: error instanceof Error ? error.message : String(error) },
        isError: true
      }
    }
  }
}
