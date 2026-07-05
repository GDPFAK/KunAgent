import { useMemo } from 'react'
import type { ModelProviderModelGroup } from '@shared/kun-gui-api'
import {
  buildComposerAssistantPickList,
  resolveComposerAssistantProviderId
} from '../chat/composer-model-selection'
import { useWriteWorkspaceStore } from '../../write/write-workspace-store'

type WorkbenchWriteAssistantRuntimeOptions = {
  composerPickList: string[]
  composerModelGroups: ModelProviderModelGroup[]
}

export function useWorkbenchWriteAssistantRuntime({
  composerPickList,
  composerModelGroups
}: WorkbenchWriteAssistantRuntimeOptions) {
  const writeAssistantOpen = useWriteWorkspaceStore((s) => s.assistantOpen)
  const setWriteAssistantOpen = useWriteWorkspaceStore((s) => s.setAssistantOpen)
  const writeAssistantModel = useWriteWorkspaceStore((s) => s.assistantModel)
  const writeAssistantProviderId = useWriteWorkspaceStore((s) => s.assistantProviderId)
  const setWriteAssistantModel = useWriteWorkspaceStore((s) => s.setAssistantModel)
  const writeAssistantPickList = useMemo(() => {
    return buildComposerAssistantPickList({
      composerPickList
    })
  }, [composerPickList])
  const resolvedWriteAssistantProviderId = useMemo(() => {
    return resolveComposerAssistantProviderId({
      composerModelGroups,
      model: writeAssistantModel,
      storedProviderId: writeAssistantProviderId
    })
  }, [composerModelGroups, writeAssistantModel, writeAssistantProviderId])

  return {
    resolvedWriteAssistantProviderId,
    setWriteAssistantModel,
    setWriteAssistantOpen,
    writeAssistantModel,
    writeAssistantOpen,
    writeAssistantPickList
  }
}
