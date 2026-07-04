import type {
  WorkspaceFileReadResult,
  WorkspaceFileTarget,
  WorkspaceFileWritePayload,
  WorkspaceFileWriteResult
} from '@shared/workspace-file'
import type { DesignCodeChangePlan, DesignCodeChangeRequest } from './code-change-request'
import {
  applyReactTailwindRequestsToSource,
  type ReactTailwindSourceSkip
} from './react-tailwind-source-adapter'

export type ReactTailwindWorkspaceFileWrite = {
  sourceFile: string
  requestIds: string[]
}

export type ReactTailwindWorkspaceApplyResult = {
  written: ReactTailwindWorkspaceFileWrite[]
  skipped: ReactTailwindSourceSkip[]
}

export type ReactTailwindWorkspaceAdapter = {
  readWorkspaceFile: (target: WorkspaceFileTarget) => Promise<WorkspaceFileReadResult>
  writeWorkspaceFile: (payload: WorkspaceFileWritePayload) => Promise<WorkspaceFileWriteResult>
}

export type ApplyReactTailwindWorkspaceOptions = {
  workspaceRoot: string
  plan: DesignCodeChangePlan
  adapter: ReactTailwindWorkspaceAdapter
}

function groupRequestsBySourceFile(
  requests: readonly DesignCodeChangeRequest[],
  skipped: ReactTailwindSourceSkip[]
): Map<string, DesignCodeChangeRequest[]> {
  const groups = new Map<string, DesignCodeChangeRequest[]>()
  for (const request of requests) {
    const sourceFile = request.sourceFile?.trim()
    if (!sourceFile) {
      skipped.push({ requestId: request.id, reason: 'Request has no sourceFile binding.' })
      continue
    }
    const list = groups.get(sourceFile) ?? []
    list.push(request)
    groups.set(sourceFile, list)
  }
  return groups
}

export async function applyReactTailwindPlanToWorkspace({
  workspaceRoot,
  plan,
  adapter
}: ApplyReactTailwindWorkspaceOptions): Promise<ReactTailwindWorkspaceApplyResult> {
  const skipped: ReactTailwindSourceSkip[] = plan.skipped.map((item) => ({
    requestId: item.operationId,
    reason: item.reason
  }))
  const written: ReactTailwindWorkspaceFileWrite[] = []
  const groups = groupRequestsBySourceFile(plan.requests, skipped)

  for (const [sourceFile, requests] of groups) {
    const read = await adapter.readWorkspaceFile({ workspaceRoot, path: sourceFile }).catch((error: unknown) => ({
      ok: false as const,
      message: error instanceof Error ? error.message : String(error)
    }))
    if (!read.ok) {
      for (const request of requests) skipped.push({ requestId: request.id, reason: read.message })
      continue
    }
    if (read.truncated) {
      for (const request of requests) {
        skipped.push({ requestId: request.id, reason: 'Source file read was truncated.' })
      }
      continue
    }
    const applied = applyReactTailwindRequestsToSource(read.content, requests)
    skipped.push(...applied.skipped)
    if (!applied.changed) continue
    const write = await adapter.writeWorkspaceFile({
      workspaceRoot,
      path: sourceFile,
      content: applied.content
    }).catch((error: unknown) => ({
      ok: false as const,
      message: error instanceof Error ? error.message : String(error)
    }))
    if (!write.ok) {
      for (const request of applied.applied) skipped.push({ requestId: request.id, reason: write.message })
      continue
    }
    written.push({
      sourceFile,
      requestIds: applied.applied.map((request) => request.id)
    })
  }

  return { written, skipped }
}
