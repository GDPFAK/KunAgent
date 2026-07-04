import { useDesignSystemStore } from '../canvas/design-system-store'
import { useCanvasShapeStore } from '../canvas/canvas-shape-store'
import { buildDesignDirectionManagerModel } from '../directions/direction-manager'
import { buildDesignGraphFromCanvasDocument } from '../graph/design-graph-from-canvas'
import { useDesignWorkspaceStore } from '../design-workspace-store'
import { groupDesignArtifacts } from '../design-artifact-actions'
import type { CanvasDocument } from '../canvas/canvas-types'
import type { DesignSystem } from '../canvas/design-system-types'
import type { DesignContext } from '../design-context'
import type { DesignArtifact, DesignDocument } from '../design-types'
import type { DesignDirectionManagerModel } from '../directions/direction-manager'
import type { DesignGraph } from '../graph/design-graph-types'

export type DesignToolState = {
  projectId: string
  document: DesignDocument | null
  artifacts: DesignArtifact[]
  canvasDocument: CanvasDocument
  designSystem: DesignSystem
  designContext: DesignContext
  graph: DesignGraph
  directionManager: DesignDirectionManagerModel
}

export function readDesignToolState(): DesignToolState {
  const workspace = useDesignWorkspaceStore.getState()
  const canvasDocument = useCanvasShapeStore.getState().document
  const designSystem = useDesignSystemStore.getState().system
  const document =
    workspace.documents.find((candidate) => candidate.id === workspace.activeDocumentId) ?? null
  const artifacts = document?.artifacts ?? workspace.artifacts
  const projectId = document?.id ?? workspace.activeDocumentId ?? 'active-design-board'
  const grouped = groupDesignArtifacts(artifacts)
  return {
    projectId,
    document,
    artifacts,
    canvasDocument,
    designSystem,
    designContext: workspace.designContext,
    graph: buildDesignGraphFromCanvasDocument(canvasDocument, {
      projectId,
      artifacts,
      designSystem,
      updatedAt: new Date().toISOString()
    }),
    directionManager: buildDesignDirectionManagerModel(grouped.directions, grouped.archivedDirections, {
      canvasDocument
    })
  }
}
