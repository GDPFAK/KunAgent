import type { NormalizedThread } from '../agent/types'
import {
  activeDesignThreadForWorkspace,
  designDocKey,
  markDesignThread,
  readDesignThreadRegistry,
  saveDesignThreadRegistry,
  type DesignThreadRegistry
} from './design-thread-registry'
import { persistDesignChatMetaForDoc } from './design-chat-transcript'

export type DesignThreadSelectorOptions = {
  threads: NormalizedThread[]
  workspaceRoot?: string | null
  docId?: string | null
  registry?: DesignThreadRegistry
}

export function designThreadsForDocument(options: DesignThreadSelectorOptions): NormalizedThread[] {
  const root = options.workspaceRoot?.trim()
  const docId = options.docId?.trim()
  if (!root || !docId) return []
  const registry = options.registry ?? readDesignThreadRegistry()
  const key = designDocKey(root, docId)
  const record = registry.workspaces[key]
  if (!record) return []
  const idSet = new Set(record.threadIds)
  return options.threads
    .filter((thread) => idSet.has(thread.id) && thread.archived !== true)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

export function designThreadBelongsToDocument(options: DesignThreadSelectorOptions & {
  activeThreadId?: string | null
}): boolean {
  const activeThreadId = options.activeThreadId?.trim()
  if (!activeThreadId) return false
  return designThreadsForDocument(options).some((thread) => thread.id === activeThreadId)
}

export function designThreadToSelectForDocument(options: DesignThreadSelectorOptions & {
  activeThreadId?: string | null
  route: string
}): string | null {
  const root = options.workspaceRoot?.trim()
  const docId = options.docId?.trim()
  if (options.route !== 'design' || !root || !docId) return null
  const activeThreadId = options.activeThreadId?.trim()
  if (!activeThreadId) {
    return designThreadsForDocument(options)[0]?.id ?? null
  }
  const existing = activeDesignThreadForWorkspace(
    root,
    docId,
    options.threads,
    options.registry ?? readDesignThreadRegistry()
  )
  if (!existing || existing.id === activeThreadId) return null
  return existing.id
}

export type DesignThreadSelectionSync =
  | { action: 'none' }
  | { action: 'select'; threadId: string }
  | { action: 'clear' }

export function designThreadSelectionSyncForDocument(options: DesignThreadSelectorOptions & {
  activeThreadId?: string | null
  route: string
}): DesignThreadSelectionSync {
  const activeThreadId = options.activeThreadId?.trim()
  if (options.route !== 'design') return { action: 'none' }
  const threadId = designThreadToSelectForDocument(options)
  if (threadId) return { action: 'select', threadId }
  if (!activeThreadId) return { action: 'none' }
  return designThreadBelongsToDocument(options)
    ? { action: 'none' }
    : { action: 'clear' }
}

export type SwitchDesignThreadOptions = {
  workspaceRoot?: string | null
  docId?: string | null
  threadId: string
  selectThread: (threadId: string) => Promise<void>
  registry?: DesignThreadRegistry
  saveRegistry?: (registry: DesignThreadRegistry) => void
  persistMeta?: typeof persistDesignChatMetaForDoc
}

export async function switchDesignThreadForDocument(
  options: SwitchDesignThreadOptions
): Promise<boolean> {
  const root = options.workspaceRoot?.trim()
  const docId = options.docId?.trim()
  const threadId = options.threadId.trim()
  if (!root || !threadId) return false
  const nextRegistry = markDesignThread(root, docId ?? '', threadId, options.registry ?? readDesignThreadRegistry())
  const saveRegistry = options.saveRegistry ?? saveDesignThreadRegistry
  saveRegistry(nextRegistry)
  void (options.persistMeta ?? persistDesignChatMetaForDoc)({
    workspaceRoot: root,
    docId: docId ?? '',
    stampThreadId: threadId
  }).catch(() => undefined)
  await options.selectThread(threadId)
  return true
}
