import type { ChatBlock } from '../agent/types'
import { getProvider } from '../agent/registry'
import {
  designDocKey,
  designDocRefForThreadId,
  normalizeDesignThreadRegistry,
  readDesignThreadRegistry,
  saveDesignThreadRegistry,
  type DesignThreadWorkspaceRecord
} from './design-thread-registry'

/**
 * Mirrors Design Assistant conversations into the owning design document dir:
 * `.kun-design/<docId>/chat/<threadId>.md` plus `chat/meta.json`.
 *
 * The runtime remains the live source of truth. These files make a design
 * document self-contained for review, backup, and physical deletion.
 */

const TRANSCRIPT_THREAD_ID_PATTERN = /^[A-Za-z0-9._-]+$/

export type DesignChatMeta = {
  version: 1
  activeThreadId: string
  threads: Array<{ id: string; updatedAt?: string }>
}

type ChatStateLike = {
  activeThreadId: string | null
  blocks: ChatBlock[]
}

function safePathSegment(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '.' || trimmed === '..') return ''
  if (trimmed.includes('/') || trimmed.includes('\\')) return ''
  return trimmed
}

export function designChatDir(docId: string): string | null {
  const safeDocId = safePathSegment(docId)
  return safeDocId ? `.kun-design/${safeDocId}/chat` : null
}

export function designChatMetaPath(docId: string): string | null {
  const dir = designChatDir(docId)
  return dir ? `${dir}/meta.json` : null
}

export function designChatTranscriptRelativePath(docId: string, threadId: string): string | null {
  const dir = designChatDir(docId)
  const trimmed = threadId.trim()
  if (!dir || !trimmed || !TRANSCRIPT_THREAD_ID_PATTERN.test(trimmed)) return null
  return `${dir}/${trimmed}.md`
}

export function serializeDesignChatTranscript(
  blocks: ChatBlock[],
  options: { threadId: string; docId?: string; generatedAt?: string }
): string {
  const lines: string[] = [
    '# 设计 Agent 对话记录',
    '',
    ...(options.docId ? [`- 设计稿: ${options.docId}`] : []),
    `- 线程: ${options.threadId}`,
    `- 更新时间: ${options.generatedAt ?? new Date().toISOString()}`
  ]
  for (const block of blocks) {
    if (block.kind === 'user') {
      const text = (block.meta?.displayText ?? block.text).trim()
      if (!text) continue
      lines.push('', '---', '', '## 用户', '', text)
      continue
    }
    if (block.kind === 'assistant') {
      const text = block.text.trim()
      if (!text) continue
      lines.push('', '## 设计 Agent', '', text)
      continue
    }
    if (block.kind === 'tool' || block.kind === 'compaction') {
      const status = block.status === 'success' ? '' : `（${block.status}）`
      lines.push('', `> [工具] ${block.summary}${status}`)
      continue
    }
    if (block.kind === 'approval') {
      lines.push('', `> [审批] ${block.summary}（${block.status}）`)
      continue
    }
    if (block.kind === 'review') {
      lines.push('', `> [评审] ${block.title}（${block.status}）`)
    }
  }
  return `${lines.join('\n')}\n`
}

export function parseDesignChatMeta(raw: string): DesignChatMeta | null {
  try {
    const parsed = JSON.parse(raw) as Partial<DesignChatMeta>
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.threads)) return null
    return {
      version: 1,
      activeThreadId: typeof parsed.activeThreadId === 'string' ? parsed.activeThreadId : '',
      threads: parsed.threads
        .filter((entry): entry is { id: string; updatedAt?: string } =>
          Boolean(entry) && typeof (entry as { id?: unknown }).id === 'string'
        )
        .map((entry) => ({
          id: entry.id,
          ...(typeof entry.updatedAt === 'string' ? { updatedAt: entry.updatedAt } : {})
        }))
    }
  } catch {
    return null
  }
}

function recordForDesignDoc(
  workspaceRoot: string,
  docId: string
): DesignThreadWorkspaceRecord | null {
  const registry = readDesignThreadRegistry()
  return registry.workspaces[designDocKey(workspaceRoot, docId)] ?? null
}

function validThreadIds(ids: Array<{ id: string }>): string[] {
  const ordered = new Set<string>()
  for (const entry of ids) {
    const id = entry.id.trim()
    if (id && TRANSCRIPT_THREAD_ID_PATTERN.test(id)) ordered.add(id)
  }
  return [...ordered]
}

export async function hydrateDesignChatMetaForDoc(input: {
  workspaceRoot: string
  docId: string
}): Promise<boolean> {
  const metaPath = designChatMetaPath(input.docId)
  if (!metaPath || typeof window.kunGui?.readWorkspaceFile !== 'function') return false
  try {
    const read = await window.kunGui.readWorkspaceFile({
      workspaceRoot: input.workspaceRoot,
      path: metaPath
    })
    if (!read.ok) return false
    const meta = parseDesignChatMeta(read.content)
    const metaThreadIds = meta ? validThreadIds(meta.threads) : []
    if (!meta || metaThreadIds.length === 0) return false

    const registry = readDesignThreadRegistry()
    const key = designDocKey(input.workspaceRoot, input.docId)
    const current = registry.workspaces[key]
    const threadIds = current
      ? [...current.threadIds, ...metaThreadIds.filter((id) => !current.threadIds.includes(id))]
      : metaThreadIds
    const activeThreadId =
      current?.activeThreadId && threadIds.includes(current.activeThreadId)
        ? current.activeThreadId
        : threadIds.includes(meta.activeThreadId)
          ? meta.activeThreadId
          : threadIds[0]
    saveDesignThreadRegistry(
      normalizeDesignThreadRegistry({
        ...registry,
        workspaces: {
          ...registry.workspaces,
          [key]: { activeThreadId, threadIds }
        }
      })
    )
    return true
  } catch {
    return false
  }
}

export async function persistDesignChatMetaForDoc(input: {
  workspaceRoot: string
  docId: string
  stampThreadId?: string
}): Promise<boolean> {
  const metaPath = designChatMetaPath(input.docId)
  const record = recordForDesignDoc(input.workspaceRoot, input.docId)
  if (!metaPath || !record) return false
  if (
    typeof window.kunGui?.writeWorkspaceFile !== 'function' ||
    typeof window.kunGui?.readWorkspaceFile !== 'function'
  ) {
    return false
  }

  let previous: DesignChatMeta | null = null
  try {
    const existing = await window.kunGui.readWorkspaceFile({
      workspaceRoot: input.workspaceRoot,
      path: metaPath
    })
    if (existing.ok) previous = parseDesignChatMeta(existing.content)
  } catch {
    // Missing or unreadable meta is regenerated from the current registry.
  }

  const previousById = new Map((previous?.threads ?? []).map((entry) => [entry.id, entry]))
  const now = new Date().toISOString()
  const meta: DesignChatMeta = {
    version: 1,
    activeThreadId: record.activeThreadId,
    threads: record.threadIds.map((id) => {
      const carried = previousById.get(id)
      const updatedAt = id === input.stampThreadId ? now : carried?.updatedAt
      return { id, ...(updatedAt ? { updatedAt } : {}) }
    })
  }

  try {
    const written = await window.kunGui.writeWorkspaceFile({
      workspaceRoot: input.workspaceRoot,
      path: metaPath,
      content: `${JSON.stringify(meta, null, 2)}\n`
    })
    return written.ok
  } catch {
    return false
  }
}

export async function writeDesignChatTranscriptForThread(input: {
  workspaceRoot: string
  docId: string
  threadId: string
  blocks: ChatBlock[]
}): Promise<boolean> {
  if (typeof window.kunGui?.writeWorkspaceFile !== 'function') return false
  const transcriptPath = designChatTranscriptRelativePath(input.docId, input.threadId)
  if (!transcriptPath) return false
  try {
    const written = await window.kunGui.writeWorkspaceFile({
      workspaceRoot: input.workspaceRoot,
      path: transcriptPath,
      content: serializeDesignChatTranscript(input.blocks, {
        docId: input.docId,
        threadId: input.threadId
      })
    })
    if (!written.ok) return false
    await persistDesignChatMetaForDoc({
      workspaceRoot: input.workspaceRoot,
      docId: input.docId,
      stampThreadId: input.threadId
    })
    return true
  } catch {
    return false
  }
}

export function notifyDesignChatTranscriptMirror(get: () => ChatStateLike): void {
  const state = get()
  const threadId = state.activeThreadId
  if (!threadId) return
  const ref = designDocRefForThreadId(threadId)
  if (!ref) return
  void writeDesignChatTranscriptForThread({
    workspaceRoot: ref.workspaceRoot,
    docId: ref.docId,
    threadId,
    blocks: state.blocks
  }).catch(() => undefined)
}

export async function refreshDesignChatTranscriptFromProvider(input: {
  workspaceRoot: string
  docId: string
}): Promise<void> {
  const record = recordForDesignDoc(input.workspaceRoot, input.docId)
  const threadId = record?.activeThreadId
  if (!threadId) return
  try {
    const detail = await getProvider().getThreadDetail(threadId)
    await writeDesignChatTranscriptForThread({
      workspaceRoot: input.workspaceRoot,
      docId: input.docId,
      threadId,
      blocks: detail.blocks
    })
  } catch {
    // The runtime thread may be gone; the existing transcript stays in place.
  }
}
