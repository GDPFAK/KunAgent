import type {
  CoreKnowledgeBaseRecordJson,
  CoreMemoryRecordJson,
  CoreRuntimeInfoJson,
  CoreRuntimeToolDiagnosticsJson
} from '../agent/kun-contract'
import type { AgentProvider } from '../agent/types'
import { describeRuntimeError } from './format-runtime-error'

type DiagnosticsProvider = Pick<AgentProvider, 'getRuntimeInfo' | 'getToolDiagnostics' | 'listMemories' | 'listKnowledgeBases'>

export type LoadedKunDiagnostics = {
  runtimeInfo?: CoreRuntimeInfoJson | null
  toolDiagnostics?: CoreRuntimeToolDiagnosticsJson | null
  memoryRecords?: CoreMemoryRecordJson[]
  knowledgeBases?: CoreKnowledgeBaseRecordJson[]
  errors: string[]
}

export async function loadKunDiagnostics(
  provider: DiagnosticsProvider,
  options: { workspace?: string } = {}
): Promise<LoadedKunDiagnostics> {
  const [runtimeInfo, toolDiagnostics, memoryRecords, knowledgeBases] = await Promise.allSettled([
    provider.getRuntimeInfo ? provider.getRuntimeInfo() : Promise.resolve(null),
    provider.getToolDiagnostics ? provider.getToolDiagnostics() : Promise.resolve(null),
    provider.listMemories
      ? provider.listMemories({ workspace: options.workspace, includeDeleted: false })
      : Promise.resolve([]),
    provider.listKnowledgeBases
      ? provider.listKnowledgeBases({ workspace: options.workspace, includeDisabled: true })
      : Promise.resolve([])
  ])

  const loaded: LoadedKunDiagnostics = { errors: [] }

  if (runtimeInfo.status === 'fulfilled') {
    loaded.runtimeInfo = runtimeInfo.value ?? null
  } else {
    loaded.errors.push(`Runtime: ${errorMessage(runtimeInfo.reason)}`)
  }

  if (toolDiagnostics.status === 'fulfilled') {
    loaded.toolDiagnostics = toolDiagnostics.value ?? null
  } else {
    loaded.errors.push(`Tools: ${errorMessage(toolDiagnostics.reason)}`)
  }

  if (memoryRecords.status === 'fulfilled') {
    loaded.memoryRecords = memoryRecords.value ?? []
  } else {
    loaded.errors.push(`Memory: ${errorMessage(memoryRecords.reason)}`)
  }

  if (knowledgeBases.status === 'fulfilled') {
    loaded.knowledgeBases = knowledgeBases.value ?? []
  } else {
    loaded.errors.push(`Knowledge: ${errorMessage(knowledgeBases.reason)}`)
  }

  loaded.errors = [...new Set(loaded.errors)]
  return loaded
}

function errorMessage(error: unknown): string {
  return describeRuntimeError(error).summary
}
