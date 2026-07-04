import type {
  WorkspaceFileReadResult,
  WorkspaceFileTarget,
  WorkspaceFileWritePayload,
  WorkspaceFileWriteResult
} from '@shared/workspace-file'
import type { DesignContext } from '../design-context'
import { buildDesignArtifactMarkdown } from '../design-artifact-markdown'
import type { DesignArtifact } from '../design-types'
import {
  prepareDesignPreviewFile,
  type PrepareDesignPreviewFileResult
} from '../design-preview-file'
import type { ResolvedDesignTurnTarget } from './target'

type DesignTurnSetupApi = {
  readWorkspaceFile?: (options: WorkspaceFileTarget) => Promise<WorkspaceFileReadResult>
  writeWorkspaceFile?: (payload: WorkspaceFileWritePayload) => Promise<WorkspaceFileWriteResult>
}

export type PrepareDesignTurnFilesResult =
  | { ok: true; previewSource?: 'base' | 'skeleton'; notesWritten: boolean }
  | { ok: false; phase: 'preview' | 'notes'; message: string }

export type PrepareDesignTurnFilesOptions = {
  workspaceRoot: string
  promptText: string
  resolvedTarget: ResolvedDesignTurnTarget
  artifacts: readonly DesignArtifact[]
  designContext?: DesignContext
  api?: DesignTurnSetupApi
}

function currentSetupApi(api?: DesignTurnSetupApi): DesignTurnSetupApi | undefined {
  return api ?? (typeof window !== 'undefined' ? window.kunGui : undefined)
}

function selectedContextForNotes(target: ResolvedDesignTurnTarget) {
  return target.visibleTargets.map((item) => ({
    kind: item.chip.kind,
    label: item.chip.label,
    detail: item.chip.detail
  }))
}

async function writeDesignNotes(options: {
  api: DesignTurnSetupApi | undefined
  workspaceRoot: string
  promptText: string
  resolvedTarget: ResolvedDesignTurnTarget
  artifacts: readonly DesignArtifact[]
  designContext?: DesignContext
}): Promise<{ ok: true; written: boolean } | { ok: false; message: string }> {
  const notesPath = options.resolvedTarget.designNotesPath
  const artifactId = options.resolvedTarget.htmlArtifactId
  const artifact = artifactId ? options.artifacts.find((item) => item.id === artifactId) : undefined
  if (!artifact || !notesPath || typeof options.api?.writeWorkspaceFile !== 'function') {
    return { ok: true, written: false }
  }
  const content = buildDesignArtifactMarkdown({
    artifact,
    designMdPath: notesPath,
    currentTurn: options.promptText,
    designContext: options.designContext,
    selectedContext: selectedContextForNotes(options.resolvedTarget)
  })
  const write = await options.api
    .writeWorkspaceFile({
      path: notesPath,
      workspaceRoot: options.workspaceRoot,
      content
    })
    .catch((error: unknown): WorkspaceFileWriteResult => ({
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    }))
  return write.ok ? { ok: true, written: true } : { ok: false, message: write.message }
}

export async function prepareDesignTurnFiles(
  options: PrepareDesignTurnFilesOptions
): Promise<PrepareDesignTurnFilesResult> {
  if (options.resolvedTarget.target === 'canvas') return { ok: true, notesWritten: false }
  const api = currentSetupApi(options.api)
  const preview: PrepareDesignPreviewFileResult = await prepareDesignPreviewFile(
    options.workspaceRoot,
    options.resolvedTarget.artifactRelativePath,
    options.resolvedTarget.basePath,
    api
  )
  if (!preview.ok) {
    return {
      ok: false,
      phase: 'preview',
      message: `Design preview setup failed: ${preview.message}`
    }
  }
  const notes = await writeDesignNotes({
    api,
    workspaceRoot: options.workspaceRoot,
    promptText: options.promptText,
    resolvedTarget: options.resolvedTarget,
    artifacts: options.artifacts,
    designContext: options.designContext
  })
  if (!notes.ok) {
    return {
      ok: false,
      phase: 'notes',
      message: `Design notes setup failed: ${notes.message}`
    }
  }
  return {
    ok: true,
    previewSource: preview.source,
    notesWritten: notes.written
  }
}
