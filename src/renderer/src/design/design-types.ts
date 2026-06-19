/**
 * Design-mode core types.
 *
 * The unions below are the "layer on later" seams agreed for the hybrid
 * roadmap: the MVP ships only the `'html'` artifact with a `'preview' | 'code'`
 * canvas. The node-canvas phase (P2) and penpot phase (P3) each ADD a member
 * here plus a matching `case` in the canvas renderer and the turn builder —
 * they never rewrite the `'html'` path.
 */

/** Artifact kind. P2 adds `'graph'` (node canvas), P3 adds `'penpot'`. */
export type DesignArtifactKind = 'html'

/** Canvas surface. `'live'` shows the real running app (code mode's dev server). P2 adds `'graph'`, P3 adds `'penpot'`. */
export type DesignCanvasView = 'preview' | 'code' | 'live'

export type DesignViewport = 'mobile' | 'tablet' | 'desktop'

/** Pixel width applied to the canvas wrapper per viewport; null = full width. */
export const DESIGN_VIEWPORT_WIDTHS: Record<DesignViewport, number | null> = {
  mobile: 390,
  tablet: 768,
  desktop: null
}

export type DesignArtifactVersion = {
  id: string
  /** Workspace-relative path to this version's snapshot document. */
  relativePath: string
  createdAt: string
  /** The agent's one-paragraph summary of what this turn produced. */
  summary: string
}

export type DesignArtifact = {
  id: string
  kind: DesignArtifactKind
  title: string
  /** Workspace-relative path to the current (latest) single-file document. */
  relativePath: string
  createdAt: string
  updatedAt: string
  versions: DesignArtifactVersion[]
  /** ISO time the design was handed to code; absent = not implemented yet. */
  implementedAt?: string
  /** Code thread that implemented it (provenance). */
  implementedThreadId?: string
}

/** Short, collision-resistant id for a design artifact directory. */
export function createDesignArtifactId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 8)
  }
  return Math.random().toString(36).slice(2, 10)
}
