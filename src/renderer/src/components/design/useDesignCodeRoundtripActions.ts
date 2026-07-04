import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { ModelProviderModelGroup } from '@shared/kun-gui-api'
import { useChatStore } from '../../store/chat-store'
import { providerIdForComposerModel } from '../../store/chat-store-helpers'
import {
  canPrepareImplementDesignTurn,
  dispatchDesignFromCodeTurn,
  dispatchImplementDesignTurn,
  type DesignCodeRoundtripCreateThread,
  type DesignCodeRoundtripSendMessage
} from '../../design/design-code-roundtrip'
import type { DesignArtifact } from '../../design/design-types'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'

export type DesignCodeRoundtripActionsOptions = {
  workspaceRoot: string
  composerModelGroups: readonly ModelProviderModelGroup[]
  createThread: DesignCodeRoundtripCreateThread
  sendMessage: DesignCodeRoundtripSendMessage
  ensureDesignThreadForWorkspace: (workspaceRoot: string, docId: string) => Promise<string | null>
  setError: (error: string | null) => void
  setConnectPhoneSidebarOpen: (open: boolean) => void
  openDesign: () => void
}

export type DesignCodeRoundtripActions = {
  openDesignMode: () => void
  implementDesignInCode: (artifact: DesignArtifact) => void
  sendDesignFromCode: (sourceRelativePath: string, sourceWorkspaceRoot?: string) => void
}

export function useDesignCodeRoundtripActions({
  workspaceRoot,
  composerModelGroups,
  createThread,
  sendMessage,
  ensureDesignThreadForWorkspace,
  setError,
  setConnectPhoneSidebarOpen,
  openDesign
}: DesignCodeRoundtripActionsOptions): DesignCodeRoundtripActions {
  const { t } = useTranslation()
  const setDesignAssistantOpen = useDesignWorkspaceStore((s) => s.setCanvasAssistantOpen)

  const openDesignMode = useCallback((): void => {
    setConnectPhoneSidebarOpen(false)
    setDesignAssistantOpen(true)
    openDesign()
  }, [openDesign, setConnectPhoneSidebarOpen, setDesignAssistantOpen])

  const implementDesignInCode = useCallback((artifact: DesignArtifact): void => {
    if (!canPrepareImplementDesignTurn(artifact)) {
      setError(t('designImplementHtmlOnly'))
      return
    }
    const designState = useDesignWorkspaceStore.getState()
    const designWorkspaceRoot = designState.workspaceRoot || workspaceRoot
    if (!designWorkspaceRoot) {
      setError(t('workspaceRequiredToCreateThread'))
      return
    }
    void dispatchImplementDesignTurn({
      artifact,
      designState,
      workspaceRoot: designWorkspaceRoot,
      createThread,
      sendMessage,
      displayText: t('designImplementDisplay', { title: artifact.title }),
      getActiveThreadId: () => useChatStore.getState().activeThreadId
    })
  }, [createThread, sendMessage, setError, t, workspaceRoot])

  const sendDesignFromCode = useCallback((
    sourceRelativePath: string,
    sourceWorkspaceRoot?: string
  ): void => {
    const source = sourceRelativePath.trim()
    if (!source) return
    const designState = useDesignWorkspaceStore.getState()
    const designWorkspaceRoot = sourceWorkspaceRoot?.trim() || designState.workspaceRoot || workspaceRoot
    if (!designWorkspaceRoot) {
      setError(t('workspaceRequiredToCreateThread'))
      return
    }
    const fileName = source.replaceAll('\\', '/').split('/').pop() || source
    void dispatchDesignFromCodeTurn({
      sourceRelativePath: source,
      workspaceRoot: designWorkspaceRoot,
      title: t('designFromCodeTitle', { file: fileName }),
      displayText: t('designFromCodeDisplay', { file: fileName }),
      designState,
      ensureDesignThreadForWorkspace,
      sendMessage,
      resolveProviderId: (model) => providerIdForComposerModel(composerModelGroups, model)
    })
  }, [composerModelGroups, ensureDesignThreadForWorkspace, sendMessage, setError, t, workspaceRoot])

  return {
    openDesignMode,
    implementDesignInCode,
    sendDesignFromCode
  }
}
