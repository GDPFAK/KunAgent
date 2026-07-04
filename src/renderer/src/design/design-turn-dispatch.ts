import type { AttachmentReference } from '../agent/types'
import type { SendMessageOverrides } from '../store/chat-store-types'
import type { DesignTurnTarget } from './design-turn-prompt'
import type { DesignWorkspaceState } from './design-workspace-store-types'

export type DesignTurnPromptState = Pick<
  DesignWorkspaceState,
  'assistantModel' | 'assistantProviderId'
>

export type DesignAssistantModelOptions = {
  promptState: DesignTurnPromptState
  resolveProviderId: (model: string) => string
  reasoningEffort?: string
}

export type DesignTurnSendOptions = DesignAssistantModelOptions & {
  displayText: string
  target: DesignTurnTarget
  attachmentIds?: string[]
  attachments?: AttachmentReference[]
}

export type CodeCanvasSendOptions = {
  displayText?: string
  reasoningEffort?: string
}

function buildAssistantModelOverrides({
  promptState,
  resolveProviderId,
  reasoningEffort
}: DesignAssistantModelOptions): SendMessageOverrides {
  const model = promptState.assistantModel.trim()
  const providerId = promptState.assistantProviderId.trim() || resolveProviderId(model)
  return {
    ...(model ? { model } : {}),
    ...(providerId ? { providerId } : {}),
    ...(reasoningEffort ? { reasoningEffort } : {})
  }
}

export function buildDesignTurnSendOverrides(options: DesignTurnSendOptions): SendMessageOverrides {
  const attachmentIds = options.attachmentIds ?? []
  const attachments = options.attachments ?? []
  return {
    displayText: options.displayText,
    ...buildAssistantModelOverrides(options),
    ...(options.target === 'canvas' ? { guiDesignCanvas: true } : {}),
    ...(attachmentIds.length ? { attachmentIds, attachments } : {})
  }
}

export function buildCodeCanvasSendOverrides(options: CodeCanvasSendOptions): SendMessageOverrides {
  return {
    ...(options.displayText ? { displayText: options.displayText } : {}),
    guiDesignCanvas: true,
    ...(options.reasoningEffort ? { reasoningEffort: options.reasoningEffort } : {})
  }
}
