import type { WorkspaceFileWritePayload, WorkspaceFileWriteResult } from '@shared/workspace-file'
import type { CanvasShape } from '../canvas/canvas-types'
import type { DesignContext } from '../design-context'
import { buildDesignArtifactMarkdown } from '../design-artifact-markdown'
import type { DesignArtifact } from '../design-types'
import type { GeneratedScreenSpec } from './screen-generation-support'
import { buildGeneratedScreenDraftHtml } from './generate-screen-draft-content'

type DraftWriteApi = {
  writeWorkspaceFile?: (payload: WorkspaceFileWritePayload) => Promise<WorkspaceFileWriteResult>
}

export type ScreenDraftWriteResult =
  | {
      status: 'queued'
      htmlPath: string
      designMdPath: string
    }
  | {
      status: 'skipped'
      reason: 'missing-workspace-root' | 'missing-write-api' | 'missing-artifact'
    }

type QueueScreenDraftWriteOptions = {
  workspaceRoot: string
  artifact: DesignArtifact | undefined
  designMdPath: string | undefined
  spec: GeneratedScreenSpec
  frame?: CanvasShape
  designContext?: DesignContext
  api?: DraftWriteApi
  onReady?: () => void
  onError?: (message: string) => void
}

function currentDraftWriteApi(api?: DraftWriteApi): DraftWriteApi | undefined {
  return api ?? (typeof window !== 'undefined' ? window.kunGui : undefined)
}

function writeWorkspaceTextFile(
  api: DraftWriteApi,
  payload: WorkspaceFileWritePayload
): Promise<WorkspaceFileWriteResult> {
  return api.writeWorkspaceFile!(payload).catch((error: unknown): WorkspaceFileWriteResult => ({
    ok: false,
    message: error instanceof Error ? error.message : String(error)
  }))
}

function writeFailureMessage(results: WorkspaceFileWriteResult[]): string {
  const failed = results.find((result) => !result.ok)
  return failed && !failed.ok ? failed.message : 'Screen draft write failed.'
}

export function queueGeneratedScreenDraftWrite(
  options: QueueScreenDraftWriteOptions
): ScreenDraftWriteResult {
  const api = currentDraftWriteApi(options.api)
  if (!options.artifact) return { status: 'skipped', reason: 'missing-artifact' }
  if (!options.workspaceRoot.trim()) return { status: 'skipped', reason: 'missing-workspace-root' }
  if (typeof api?.writeWorkspaceFile !== 'function') return { status: 'skipped', reason: 'missing-write-api' }

  const designMdPath = options.designMdPath ?? options.artifact.designMdPath
  if (!designMdPath) return { status: 'skipped', reason: 'missing-artifact' }

  const htmlContent = buildGeneratedScreenDraftHtml({
    artifact: options.artifact,
    spec: options.spec,
    frame: options.frame,
    designContext: options.designContext
  })
  const designNotes = buildDesignArtifactMarkdown({
    artifact: options.artifact,
    designMdPath,
    currentTurn: options.spec.brief ?? options.spec.name,
    designContext: options.designContext,
    selectedContext: [{
      kind: 'generated-screen',
      label: options.frame?.name ?? options.artifact.title,
      detail: `${Math.round(options.frame?.width ?? 0)} x ${Math.round(options.frame?.height ?? 0)}`
    }]
  })

  void Promise
    .all([
      writeWorkspaceTextFile(api, {
        path: options.artifact.relativePath,
        workspaceRoot: options.workspaceRoot,
        content: htmlContent
      }),
      writeWorkspaceTextFile(api, {
        path: designMdPath,
        workspaceRoot: options.workspaceRoot,
        content: designNotes
      })
    ])
    .then((results) => {
      if (results.every((result) => result.ok)) {
        options.onReady?.()
        return
      }
      options.onError?.(writeFailureMessage(results))
    })
    .catch((error: unknown) => {
      options.onError?.(error instanceof Error ? error.message : String(error))
    })

  return {
    status: 'queued',
    htmlPath: options.artifact.relativePath,
    designMdPath
  }
}
