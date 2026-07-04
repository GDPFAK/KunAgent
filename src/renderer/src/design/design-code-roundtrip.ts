import type { WorkspaceFileWritePayload, WorkspaceFileWriteResult } from '@shared/workspace-file'
import type { SendMessageOverrides } from '../store/chat-store-types'
import { canImplementDesignArtifact } from './design-artifact-actions'
import type { DesignArtifact } from './design-types'
import {
  formatDesignSystemMarkdown,
  hashDesignSystem
} from './design-context'
import type { DesignWorkspaceState } from './design-workspace-store-types'
import { buildImplementDesignPrompt } from './design-implement-prompt'
import { createDesignArtifactId } from './design-types'
import { buildDesignFromCodePrompt } from './design-turn-prompt'

export type DesignCodeRoundtripWriteApi = {
  writeWorkspaceFile?: (payload: WorkspaceFileWritePayload) => Promise<WorkspaceFileWriteResult>
}

export type DesignCodeRoundtripCreateThread = (options: { workspaceRoot: string }) => Promise<void>

export type DesignCodeRoundtripSendMessage = (
  text: string,
  mode?: string,
  overrides?: SendMessageOverrides
) => Promise<boolean>

type ImplementDesignState = Pick<
  DesignWorkspaceState,
  'publishDesignSystem' | 'designContext' | 'implementStackHint' | 'injectIntoCode'
>

export type PrepareImplementDesignTurnOptions = {
  artifact: DesignArtifact
  designState: ImplementDesignState
  workspaceRoot: string
  api?: DesignCodeRoundtripWriteApi
}

export type PrepareImplementDesignTurnResult =
  | { ok: true; prompt: string; designSystemHash?: string }
  | { ok: false; reason: 'unsupported-artifact' }

type DispatchImplementDesignState = ImplementDesignState & Pick<
  DesignWorkspaceState,
  'openImplementPanel' | 'markImplemented'
>

export type DispatchImplementDesignTurnOptions = {
  artifact: DesignArtifact
  designState: DispatchImplementDesignState
  workspaceRoot: string
  createThread: DesignCodeRoundtripCreateThread
  sendMessage: DesignCodeRoundtripSendMessage
  displayText: string
  getActiveThreadId: () => string | null
  api?: DesignCodeRoundtripWriteApi
}

export type DispatchImplementDesignTurnResult =
  | { status: 'sent'; designSystemHash?: string }
  | { status: 'unsupported-artifact' }
  | { status: 'send-failed'; designSystemHash?: string }

type DesignFromCodeState = Pick<
  DesignWorkspaceState,
  'designContext'
>

export type PrepareDesignFromCodeTurnOptions = {
  sourceRelativePath: string
  workspaceRoot: string
  documentId: string
  title: string
  designState: DesignFromCodeState
  createArtifactId?: () => string
  now?: () => string
}

export type PreparedDesignFromCodeTurn = {
  artifact: DesignArtifact & { kind: 'html' }
  prompt: string
}

type DispatchDesignFromCodeState = DesignFromCodeState & Pick<
  DesignWorkspaceState,
  | 'setWorkspaceRoot'
  | 'ensureActiveDocument'
  | 'upsertArtifact'
  | 'assistantModel'
  | 'assistantProviderId'
>

export type DispatchDesignFromCodeTurnOptions = {
  sourceRelativePath: string
  workspaceRoot: string
  title: string
  displayText: string
  designState: DispatchDesignFromCodeState
  ensureDesignThreadForWorkspace: (workspaceRoot: string, documentId: string) => Promise<string | null>
  sendMessage: DesignCodeRoundtripSendMessage
  resolveProviderId: (model: string) => string
  createArtifactId?: () => string
  now?: () => string
}

export type DispatchDesignFromCodeTurnResult =
  | { status: 'sent'; artifactId: string; threadId: string }
  | { status: 'empty-source' }
  | { status: 'missing-thread' }
  | { status: 'send-failed'; artifactId: string; threadId: string }

export function canPrepareImplementDesignTurn(
  artifact: DesignArtifact | null | undefined
): artifact is DesignArtifact & { kind: 'html' } {
  return canImplementDesignArtifact(artifact)
}

function currentWriteApi(api?: DesignCodeRoundtripWriteApi): DesignCodeRoundtripWriteApi | undefined {
  return api ?? (typeof window !== 'undefined' ? window.kunGui : undefined)
}

async function publishDesignSystemForImplementation(options: {
  workspaceRoot: string
  designState: ImplementDesignState
  api?: DesignCodeRoundtripWriteApi
}): Promise<{ relativePath?: string; hash?: string }> {
  if (!options.designState.publishDesignSystem) return {}
  const api = currentWriteApi(options.api)
  if (typeof api?.writeWorkspaceFile !== 'function') return {}
  const relativePath = '.kun-design/DESIGN_SYSTEM.md'
  const content = formatDesignSystemMarkdown(options.designState.designContext)
  try {
    const result = await api.writeWorkspaceFile({
      path: relativePath,
      workspaceRoot: options.workspaceRoot,
      content
    })
    return result.ok ? { relativePath, hash: hashDesignSystem(content) } : {}
  } catch {
    return {}
  }
}

export async function prepareImplementDesignTurn(
  options: PrepareImplementDesignTurnOptions
): Promise<PrepareImplementDesignTurnResult> {
  if (!canImplementDesignArtifact(options.artifact)) {
    return { ok: false, reason: 'unsupported-artifact' }
  }
  const designSystem = await publishDesignSystemForImplementation({
    workspaceRoot: options.workspaceRoot,
    designState: options.designState,
    api: options.api
  })
  const prompt = buildImplementDesignPrompt({
    artifactTitle: options.artifact.title,
    artifactRelativePath: options.artifact.relativePath,
    ...(designSystem.relativePath ? { designSystemRelativePath: designSystem.relativePath } : {}),
    ...(options.artifact.designMdPath ? { designNotesRelativePath: options.artifact.designMdPath } : {}),
    stackHint: options.designState.implementStackHint || undefined,
    referenceDesignSystem: options.designState.injectIntoCode,
    workspaceRoot: options.workspaceRoot,
    designContext: options.designState.designContext
  })
  return {
    ok: true,
    prompt,
    ...(designSystem.hash ? { designSystemHash: designSystem.hash } : {})
  }
}

function implementationDispatchResult(
  status: 'sent' | 'send-failed',
  designSystemHash?: string
): DispatchImplementDesignTurnResult {
  return designSystemHash ? { status, designSystemHash } : { status }
}

export async function dispatchImplementDesignTurn(
  options: DispatchImplementDesignTurnOptions
): Promise<DispatchImplementDesignTurnResult> {
  const prepared = await prepareImplementDesignTurn({
    artifact: options.artifact,
    designState: options.designState,
    workspaceRoot: options.workspaceRoot,
    api: options.api
  })
  if (!prepared.ok) return { status: 'unsupported-artifact' }

  await options.createThread({ workspaceRoot: options.workspaceRoot })
  options.designState.openImplementPanel(options.artifact.title)
  const ok = await options.sendMessage(prepared.prompt, 'agent', {
    displayText: options.displayText
  })
  if (!ok) return implementationDispatchResult('send-failed', prepared.designSystemHash)

  options.designState.markImplemented(
    options.artifact.id,
    options.getActiveThreadId() ?? '',
    prepared.designSystemHash
  )
  return implementationDispatchResult('sent', prepared.designSystemHash)
}

export function prepareDesignFromCodeTurn(
  options: PrepareDesignFromCodeTurnOptions
): PreparedDesignFromCodeTurn {
  const source = options.sourceRelativePath.trim()
  const artifactId = (options.createArtifactId ?? createDesignArtifactId)()
  const createdAt = (options.now ?? (() => new Date().toISOString()))()
  const relativePath = `.kun-design/${options.documentId}/${artifactId}/v1.html`
  const artifact: DesignArtifact & { kind: 'html' } = {
    id: artifactId,
    kind: 'html',
    title: options.title,
    relativePath,
    createdAt,
    updatedAt: createdAt,
    versions: [{ id: `${artifactId}-v1`, relativePath, createdAt, summary: options.title }]
  }
  return {
    artifact,
    prompt: buildDesignFromCodePrompt({
      sourceRelativePath: source,
      artifactRelativePath: relativePath,
      workspaceRoot: options.workspaceRoot,
      designContext: options.designState.designContext
    })
  }
}

export async function dispatchDesignFromCodeTurn(
  options: DispatchDesignFromCodeTurnOptions
): Promise<DispatchDesignFromCodeTurnResult> {
  const source = options.sourceRelativePath.trim()
  if (!source) return { status: 'empty-source' }

  options.designState.setWorkspaceRoot(options.workspaceRoot)
  const documentId = options.designState.ensureActiveDocument()
  const threadId = await options.ensureDesignThreadForWorkspace(options.workspaceRoot, documentId)
  if (!threadId) return { status: 'missing-thread' }

  const prepared = prepareDesignFromCodeTurn({
    sourceRelativePath: source,
    workspaceRoot: options.workspaceRoot,
    documentId,
    title: options.title,
    designState: options.designState,
    createArtifactId: options.createArtifactId,
    now: options.now
  })
  options.designState.upsertArtifact(prepared.artifact)

  const model = options.designState.assistantModel.trim()
  const providerId = options.designState.assistantProviderId.trim() || options.resolveProviderId(model)
  const ok = await options.sendMessage(prepared.prompt, 'agent', {
    displayText: options.displayText,
    ...(model ? { model } : {}),
    ...(providerId ? { providerId } : {})
  })

  return ok
    ? { status: 'sent', artifactId: prepared.artifact.id, threadId }
    : { status: 'send-failed', artifactId: prepared.artifact.id, threadId }
}
