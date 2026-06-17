import type { CoreRuntimeInfoJson } from '../../agent/kun-contract'

export type ExpertMarketplaceStatus =
  | 'offline'
  | 'disabled'
  | 'loaded'
  | 'error'

export type ExpertMarketplaceOverlay = {
  status: ExpertMarketplaceStatus
  categoryCount: number
  expertCount: number
  lastError?: string
}

export function buildExpertMarketplaceOverlay(input: {
  runtimeInfo?: CoreRuntimeInfoJson | null
  expertDiagnostics?: {
    enabled?: boolean
    categoryCount?: number
    expertCount?: number
    lastError?: string
  } | null
}): ExpertMarketplaceOverlay {
  const diagnostics = input.expertDiagnostics
  if (!diagnostics) {
    return {
      status: input.runtimeInfo ? 'offline' : 'disabled',
      categoryCount: 0,
      expertCount: 0
    }
  }
  if (!diagnostics.enabled) {
    return {
      status: 'disabled',
      categoryCount: 0,
      expertCount: 0
    }
  }
  if (diagnostics.lastError) {
    return {
      status: 'error',
      categoryCount: diagnostics.categoryCount ?? 0,
      expertCount: diagnostics.expertCount ?? 0,
      lastError: diagnostics.lastError
    }
  }
  return {
    status: 'loaded',
    categoryCount: diagnostics.categoryCount ?? 0,
    expertCount: diagnostics.expertCount ?? 0
  }
}
