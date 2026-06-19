import type { DesignArtifact, DesignArtifactVersion, DesignCanvasView, DesignViewport } from './design-types'
import type { DesignContext } from './design-context'

export type DesignWorkspaceState = {
  /** Workspace root design artifacts live under; '' = none chosen yet. */
  workspaceRoot: string
  artifacts: DesignArtifact[]
  activeArtifactId: string | null
  canvasView: DesignCanvasView
  viewport: DesignViewport
  /** Live dev-server URL synced from code mode; '' = none running. */
  devPreviewUrl: string
  agentPanelOpen: boolean
  /** Composer model used for design-agent turns; '' = inherit runtime default. */
  assistantModel: string
  assistantProviderId: string
  designContext: DesignContext
  // settings-driven runtime knobs (loaded from settings.design)
  canvasBackground: 'light' | 'dark'
  liveRefresh: boolean
  deviceFrame: boolean
  generationPrompt: string
  reasoningEffort: string
  implementStackHint: string
  injectIntoCode: boolean
  publishDesignSystem: boolean
  settingsLoaded: boolean
  fileError: string | null

  setWorkspaceRoot: (workspaceRoot: string) => void
  setCanvasView: (view: DesignCanvasView) => void
  setViewport: (viewport: DesignViewport) => void
  setDevPreviewUrl: (url: string) => void
  setCanvasBackground: (background: 'light' | 'dark') => void
  setActiveArtifact: (artifactId: string | null) => void
  /** Insert a new artifact (or replace one with the same id) and make it active. */
  upsertArtifact: (artifact: DesignArtifact) => void
  /** Append a new version, repointing the artifact's current document at it. */
  addArtifactVersion: (artifactId: string, version: DesignArtifactVersion) => void
  /** Stamp an artifact as handed to code (provenance + drift baseline). */
  markImplemented: (artifactId: string, threadId: string) => void
  removeArtifact: (artifactId: string) => void
  setAgentPanelOpen: (open: boolean) => void
  setAssistantModel: (model: string, providerId?: string) => void
  updateDesignContext: (patch: Partial<DesignContext>) => void
  /** Hydrate workspace root + design context defaults from persisted settings. */
  loadDesignSettings: () => Promise<void>
  resetWorkspace: () => void
}
