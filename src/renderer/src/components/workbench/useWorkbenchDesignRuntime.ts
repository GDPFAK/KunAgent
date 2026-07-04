import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react'
import type { ModelProviderModelGroup } from '@shared/kun-gui-api'
import {
  buildComposerAssistantPickList,
  resolveComposerAssistantProviderId
} from '../chat/composer-model-selection'
import { useDesignComposerContextState } from '../design/useDesignComposerContextState'
import { useCanvasSelectionStore } from '../../design/canvas/canvas-selection-store'
import { useCanvasShapeStore } from '../../design/canvas/canvas-shape-store'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'

type UseWorkbenchDesignRuntimeInput = {
  route: string
  composerPickList: readonly string[]
  composerModelGroups: readonly ModelProviderModelGroup[]
  setInput: Dispatch<SetStateAction<string>>
}

export function useWorkbenchDesignRuntime({
  route,
  composerPickList,
  composerModelGroups,
  setInput
}: UseWorkbenchDesignRuntimeInput) {
  const designWorkspaceRoot = useDesignWorkspaceStore((s) => s.workspaceRoot)
  const designAssistantOpen = useDesignWorkspaceStore((s) => s.canvasAssistantOpen)
  const setDesignAssistantOpen = useDesignWorkspaceStore((s) => s.setCanvasAssistantOpen)
  const designImplementOpen = useDesignWorkspaceStore((s) => s.implementOpen)
  const designImplementTitle = useDesignWorkspaceStore((s) => s.implementTitle)
  const designActiveDocumentId = useDesignWorkspaceStore((s) => s.activeDocumentId)
  const designAssistantModel = useDesignWorkspaceStore((s) => s.assistantModel)
  const designAssistantProviderId = useDesignWorkspaceStore((s) => s.assistantProviderId)
  const setDesignAssistantModel = useDesignWorkspaceStore((s) => s.setAssistantModel)
  const canvasDocument = useCanvasShapeStore((s) => s.document)
  const canvasDocumentKey = useCanvasShapeStore((s) => s.documentKey)
  const canvasSelectedIds = useCanvasSelectionStore((s) => s.selectedIds)
  const contextState = useDesignComposerContextState({
    route,
    canvasDocument,
    selectedIds: canvasSelectedIds,
    setInput
  })
  const designAssistantPickList = useMemo(() => {
    return buildComposerAssistantPickList({
      composerPickList
    })
  }, [composerPickList])
  const resolvedDesignAssistantProviderId = useMemo(() => {
    return resolveComposerAssistantProviderId({
      composerModelGroups,
      model: designAssistantModel,
      storedProviderId: designAssistantProviderId
    })
  }, [composerModelGroups, designAssistantModel, designAssistantProviderId])
  const selectCanvasShape = useCallback((shapeId: string): void => {
    useCanvasSelectionStore.getState().select([shapeId])
  }, [])

  return {
    designWorkspaceRoot,
    designAssistantOpen,
    setDesignAssistantOpen,
    designImplementOpen,
    designImplementTitle,
    designActiveDocumentId,
    designAssistantModel,
    setDesignAssistantModel,
    canvasDocument,
    canvasDocumentKey,
    canvasSelectedIds,
    designAssistantPickList,
    resolvedDesignAssistantProviderId,
    selectCanvasShape,
    ...contextState
  }
}
