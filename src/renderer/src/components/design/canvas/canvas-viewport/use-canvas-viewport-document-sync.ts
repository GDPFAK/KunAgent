import { useEffect, useMemo, useState } from 'react'
import {
  buildHtmlArtifactSyncKey,
  removedLinkedHtmlArtifactIds,
  syncHtmlArtifactsToBoardDocument,
  syncHtmlFrameNodesToArtifacts
} from '../../../../design/design-board'
import type { DesignTarget } from '../../../../design/design-context'
import type { DesignArtifact } from '../../../../design/design-types'
import type { CanvasDocument, Rect } from '../../../../design/canvas/canvas-types'
import { createEmptyDocument } from '../../../../design/canvas/canvas-types'
import {
  loadCanvasDocument,
  persistCanvasDocument
} from '../../../../design/canvas/canvas-persistence'
import { getCanvasDocumentContentBounds } from '../../../../design/canvas/canvas-placement'
import { useCanvasSelectionStore } from '../../../../design/canvas/canvas-selection-store'
import { useCanvasShapeStore } from '../../../../design/canvas/canvas-shape-store'
import { useCanvasUndoStore } from '../../../../design/canvas/canvas-undo-store'
import { useCanvasViewportStore } from '../../../../design/canvas/canvas-viewport-store'
import { loadDesignSystem, persistDesignSystem } from '../../../../design/canvas/design-system-persistence'
import { useDesignSystemStore } from '../../../../design/canvas/design-system-store'
import { createEmptyDesignSystem } from '../../../../design/canvas/design-system-types'
import { useDesignWorkspaceStore } from '../../../../design/design-workspace-store'
import {
  boundsForShapeIds,
  mergeLoadedCanvasDocumentWithLiveChanges,
  readStoredCanvasViewport,
  resolveCanvasSelectionAfterDocumentSync,
  shouldResetCanvasTransientInteractionAfterDocumentSync,
  writeStoredCanvasViewport
} from './helpers'

type UseCanvasViewportDocumentSyncArgs = {
  workspaceRoot: string
  artifactId: string
  baseDir?: string
  resolvedDesignSystemBaseDir?: string
  viewportStorageKey: string
  documentKey: string
  htmlFrameSyncEnabled: boolean
  designArtifacts: DesignArtifact[]
  designTarget?: DesignTarget
}

function focusBoundsToFitLater(bounds: Rect | null, cancelled: () => boolean): number {
  if (!bounds) return 0
  return requestAnimationFrame(() => {
    if (!cancelled()) {
      useCanvasViewportStore.getState().zoomToFit(bounds, 72, { maxZoom: 1, minZoom: 0.04 })
    }
  })
}

function scheduleHtmlFrameNodeSync(
  doc: CanvasDocument,
  currentTimer: ReturnType<typeof setTimeout> | null,
  setTimer: (timer: ReturnType<typeof setTimeout> | null) => void,
  cancelled: () => boolean
): ReturnType<typeof setTimeout> {
  if (currentTimer) clearTimeout(currentTimer)
  const timer = setTimeout(() => {
    setTimer(null)
    if (!cancelled()) syncHtmlFrameNodesToArtifacts(doc)
  }, 180)
  setTimer(timer)
  return timer
}

export function useCanvasViewportDocumentSync({
  workspaceRoot,
  artifactId,
  baseDir,
  resolvedDesignSystemBaseDir,
  viewportStorageKey,
  documentKey,
  htmlFrameSyncEnabled,
  designArtifacts,
  designTarget
}: UseCanvasViewportDocumentSyncArgs): boolean {
  const [docLoaded, setDocLoaded] = useState(false)

  useEffect(() => {
    if (!artifactId || !workspaceRoot) {
      setDocLoaded(false)
      return
    }

    let cancelled = false
    let viewFrame = 0
    let nodeSyncTimer: ReturnType<typeof setTimeout> | null = null
    const isCancelled = (): boolean => cancelled
    const setNodeSyncTimer = (timer: ReturnType<typeof setTimeout> | null): void => {
      nodeSyncTimer = timer
    }
    setDocLoaded(false)

    useCanvasSelectionStore.getState().clearSelection()
    useCanvasSelectionStore.getState().setMarquee(null)
    useCanvasSelectionStore.getState().setHoverTarget(null)
    const initialDocument = createEmptyDocument()
    useCanvasShapeStore.getState().loadDocument(initialDocument, documentKey)
    useCanvasViewportStore.getState().resetView()
    useCanvasUndoStore.getState().clear()

    void loadCanvasDocument(workspaceRoot, artifactId, baseDir).then((loaded) => {
      if (cancelled) return
      const currentShapeState = useCanvasShapeStore.getState()
      const liveDocument = currentShapeState.documentKey === documentKey
        ? currentShapeState.document
        : initialDocument
      let doc = mergeLoadedCanvasDocumentWithLiveChanges(
        loaded ?? createEmptyDocument(),
        liveDocument,
        initialDocument
      )
      let addedFrameIds: string[] = []
      if (htmlFrameSyncEnabled) {
        const synced = syncHtmlArtifactsToBoardDocument(doc, useDesignWorkspaceStore.getState().artifacts)
        doc = synced.document
        addedFrameIds = synced.addedFrameIds
        if (synced.addedFrameIds.length > 0 || synced.updatedFrameIds.length > 0 || synced.removedFrameIds.length > 0) {
          persistCanvasDocument(workspaceRoot, artifactId, doc, baseDir)
        }
      }
      useCanvasShapeStore.getState().loadDocument(doc, documentKey)
      const storedView = readStoredCanvasViewport(viewportStorageKey)
      if (storedView) {
        useCanvasViewportStore.getState().setVbox(storedView)
      } else if (addedFrameIds.length > 0) {
        viewFrame = focusBoundsToFitLater(boundsForShapeIds(doc, addedFrameIds), isCancelled)
      } else if (loaded) {
        viewFrame = focusBoundsToFitLater(getCanvasDocumentContentBounds(doc), isCancelled)
      }
      setDocLoaded(true)
    })

    void loadDesignSystem(workspaceRoot, resolvedDesignSystemBaseDir).then((system) => {
      if (cancelled) return
      useDesignSystemStore.getState().loadSystem(system ?? createEmptyDesignSystem())
    })

    const unsubscribe = useCanvasShapeStore.subscribe((state, prev) => {
      if (cancelled) return
      if (state.document === prev.document) return
      persistCanvasDocument(workspaceRoot, artifactId, state.document, baseDir)
      if (!htmlFrameSyncEnabled) return

      const removedArtifactIds = removedLinkedHtmlArtifactIds(prev.document, state.document)
      if (removedArtifactIds.length > 0) {
        const designStore = useDesignWorkspaceStore.getState()
        const htmlArtifacts = new Map(
          designStore.artifacts
            .filter((item) => item.kind === 'html')
            .map((item) => [item.id, item])
        )
        for (const removedArtifactId of removedArtifactIds) {
          const artifact = htmlArtifacts.get(removedArtifactId)
          if (artifact && artifact.node?.boardHidden !== true) {
            designStore.updateArtifactNode(removedArtifactId, { boardHidden: true })
          }
        }
      }
      scheduleHtmlFrameNodeSync(state.document, nodeSyncTimer, setNodeSyncTimer, isCancelled)
    })

    const unsubscribeDesignSystem = useDesignSystemStore.subscribe((state, prev) => {
      if (cancelled) return
      if (state.system === prev.system) return
      persistDesignSystem(workspaceRoot, state.system, resolvedDesignSystemBaseDir)
    })

    return () => {
      cancelled = true
      if (viewFrame) cancelAnimationFrame(viewFrame)
      if (nodeSyncTimer) clearTimeout(nodeSyncTimer)
      unsubscribe()
      unsubscribeDesignSystem()
    }
  }, [workspaceRoot, artifactId, baseDir, documentKey, htmlFrameSyncEnabled, resolvedDesignSystemBaseDir, viewportStorageKey])

  const htmlArtifactSyncKey = useMemo(() => {
    if (!htmlFrameSyncEnabled) return ''
    return buildHtmlArtifactSyncKey(designArtifacts, designTarget)
  }, [designArtifacts, designTarget, htmlFrameSyncEnabled])

  useEffect(() => {
    if (!docLoaded || !htmlFrameSyncEnabled || !artifactId || !workspaceRoot) return
    const current = useCanvasShapeStore.getState().document
    const synced = syncHtmlArtifactsToBoardDocument(current, useDesignWorkspaceStore.getState().artifacts)
    if (
      synced.addedFrameIds.length === 0 &&
      synced.updatedFrameIds.length === 0 &&
      synced.removedFrameIds.length === 0
    ) return
    useCanvasShapeStore.getState().loadDocument(synced.document, documentKey)
    if (synced.removedFrameIds.length > 0) {
      const selection = useCanvasSelectionStore.getState()
      if (shouldResetCanvasTransientInteractionAfterDocumentSync(synced.removedFrameIds)) {
        selection.setMarquee(null)
        selection.setSnapGuides([])
      }
      const nextSelection = resolveCanvasSelectionAfterDocumentSync(synced.document, selection)
      if (nextSelection.selectedIds.length !== selection.selectedIds.size) {
        selection.select(nextSelection.selectedIds)
      }
      const afterSelection = useCanvasSelectionStore.getState()
      if (afterSelection.hoverTargetId !== nextSelection.hoverTargetId) {
        afterSelection.setHoverTarget(nextSelection.hoverTargetId)
      }
      if (afterSelection.editingId !== nextSelection.editingId) {
        afterSelection.setEditing(nextSelection.editingId)
      }
    }
    persistCanvasDocument(workspaceRoot, artifactId, synced.document, baseDir)
    if (synced.addedFrameIds.length > 0) {
      const bounds = boundsForShapeIds(synced.document, synced.addedFrameIds)
      if (bounds) useCanvasViewportStore.getState().zoomToFit(bounds, 72, { maxZoom: 1, minZoom: 0.04 })
    }
  }, [artifactId, baseDir, docLoaded, documentKey, htmlArtifactSyncKey, htmlFrameSyncEnabled, workspaceRoot])

  useEffect(() => {
    if (!docLoaded || !artifactId || !workspaceRoot) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsubscribe = useCanvasViewportStore.subscribe((state, prev) => {
      if (state.vbox === prev.vbox) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        writeStoredCanvasViewport(viewportStorageKey, useCanvasViewportStore.getState().vbox)
      }, 250)
    })
    return () => {
      if (timer) clearTimeout(timer)
      unsubscribe()
    }
  }, [artifactId, docLoaded, viewportStorageKey, workspaceRoot])

  return docLoaded
}
