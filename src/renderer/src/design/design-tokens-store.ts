/**
 * Ephemeral store for design-tokens extraction results.
 *
 * Tokens are derived data — re-extractable in a few ms from the live HTML
 * artifact — so we deliberately keep them out of `design-workspace-store`
 * (and out of `DesignSettingsV1` + the `.strict()` patch schema). The store
 * is keyed by artifact `relativePath` so each design has its own snapshot.
 */

import { create } from 'zustand'
import {
  extractTokensFromWebview,
  type DerivedTokens,
  type WebviewLike
} from './design-token-extract'

export type DesignTokensStatus = 'idle' | 'extracting' | 'error'

type Slot = DerivedTokens & { at: number }

type DesignTokensState = {
  byArtifact: Record<string, Slot>
  status: DesignTokensStatus
  errorPath: string | null
  extractFor: (relativePath: string, webview: WebviewLike) => Promise<void>
  clear: (relativePath: string) => void
}

export const useDesignTokensStore = create<DesignTokensState>((set, get) => ({
  byArtifact: {},
  status: 'idle',
  errorPath: null,
  extractFor: async (relativePath, webview) => {
    if (!relativePath || !webview) return
    set({ status: 'extracting', errorPath: null })
    const result = await extractTokensFromWebview(webview)
    if (!result) {
      set({ status: 'error', errorPath: relativePath })
      return
    }
    set((state) => ({
      byArtifact: { ...state.byArtifact, [relativePath]: { ...result, at: Date.now() } },
      status: 'idle',
      errorPath: null
    }))
  },
  clear: (relativePath) => {
    if (!relativePath) return
    const current = get().byArtifact
    if (!(relativePath in current)) return
    const next = { ...current }
    delete next[relativePath]
    set({ byArtifact: next })
  }
}))
