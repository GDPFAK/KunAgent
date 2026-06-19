import type { NormalizedThread } from '../agent/types'
import { browserStorage, type BrowserStorageLike } from '../lib/browser-storage'
import { normalizeWorkspaceRoot } from '../lib/workspace-path'

/**
 * Thin design-thread registry — keeps design-assistant threads out of the
 * code-thread sidebar and lets a workspace reuse its design thread. MVP scope:
 * mark + lookup + active-for-workspace (R3). The startup-inference / hydrate
 * pass that `write-thread-registry.ts` has is intentionally deferred.
 */

export const DESIGN_ASSISTANT_THREAD_TITLE = 'Design Assistant'
const MAX_DESIGN_THREAD_IDS_PER_WORKSPACE = 20
const MAX_DESIGN_REGISTRY_WORKSPACES = 80
const DESIGN_THREAD_REGISTRY_KEY = 'kun.design.threadRegistry.v1'

export type DesignThreadWorkspaceRecord = {
  activeThreadId: string
  threadIds: string[]
}

export type DesignThreadRegistry = {
  version: 1
  workspaces: Record<string, DesignThreadWorkspaceRecord>
}

export function designWorkspaceKey(workspaceRoot: string | undefined | null): string {
  return normalizeWorkspaceRoot(workspaceRoot ?? '')
}

export function emptyDesignThreadRegistry(): DesignThreadRegistry {
  return { version: 1, workspaces: {} }
}

function normalizeThreadIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  const ordered = new Set<string>()
  for (const id of ids) {
    if (typeof id === 'string' && id.trim()) ordered.add(id.trim())
  }
  return [...ordered].slice(0, MAX_DESIGN_THREAD_IDS_PER_WORKSPACE)
}

export function normalizeDesignThreadRegistry(raw: unknown): DesignThreadRegistry {
  if (!raw || typeof raw !== 'object') return emptyDesignThreadRegistry()
  const source = raw as { workspaces?: unknown }
  if (!source.workspaces || typeof source.workspaces !== 'object') return emptyDesignThreadRegistry()

  const workspaces: DesignThreadRegistry['workspaces'] = {}
  for (const [workspaceRoot, value] of Object.entries(source.workspaces as Record<string, unknown>)) {
    const key = designWorkspaceKey(workspaceRoot)
    if (!key || !value || typeof value !== 'object') continue
    const record = value as { activeThreadId?: unknown; threadIds?: unknown }
    const threadIds = normalizeThreadIds(record.threadIds)
    if (threadIds.length === 0) continue
    const activeThreadId =
      typeof record.activeThreadId === 'string' && threadIds.includes(record.activeThreadId.trim())
        ? record.activeThreadId.trim()
        : threadIds[0]
    workspaces[key] = { activeThreadId, threadIds }
  }
  const trimmed = Object.fromEntries(
    Object.entries(workspaces).slice(-MAX_DESIGN_REGISTRY_WORKSPACES)
  )
  return { version: 1, workspaces: trimmed }
}

export function readDesignThreadRegistry(
  storage: BrowserStorageLike | null = browserStorage()
): DesignThreadRegistry {
  if (!storage) return emptyDesignThreadRegistry()
  try {
    const raw = storage.getItem(DESIGN_THREAD_REGISTRY_KEY)
    return normalizeDesignThreadRegistry(raw ? JSON.parse(raw) : null)
  } catch {
    return emptyDesignThreadRegistry()
  }
}

export function saveDesignThreadRegistry(
  registry: DesignThreadRegistry,
  storage: BrowserStorageLike | null = browserStorage()
): void {
  if (!storage) return
  try {
    storage.setItem(DESIGN_THREAD_REGISTRY_KEY, JSON.stringify(normalizeDesignThreadRegistry(registry)))
  } catch {
    /* ignore storage failures */
  }
}

export function designThreadIds(
  registry: DesignThreadRegistry = readDesignThreadRegistry()
): Set<string> {
  const ids = new Set<string>()
  for (const record of Object.values(registry.workspaces)) {
    for (const id of record.threadIds) ids.add(id)
  }
  return ids
}

export function isDesignThreadId(
  threadId: string | null | undefined,
  registry: DesignThreadRegistry = readDesignThreadRegistry()
): boolean {
  return Boolean(threadId && designThreadIds(registry).has(threadId))
}

export function markDesignThread(
  workspaceRoot: string,
  threadId: string,
  registry: DesignThreadRegistry = readDesignThreadRegistry()
): DesignThreadRegistry {
  const key = designWorkspaceKey(workspaceRoot)
  const id = threadId.trim()
  if (!key || !id) return registry
  const record = registry.workspaces[key] ?? { activeThreadId: '', threadIds: [] }
  const threadIds = [id, ...record.threadIds.filter((item) => item !== id)]
  return normalizeDesignThreadRegistry({
    ...registry,
    workspaces: { ...registry.workspaces, [key]: { activeThreadId: id, threadIds } }
  })
}

export function forgetDesignThread(
  threadId: string,
  registry: DesignThreadRegistry = readDesignThreadRegistry()
): DesignThreadRegistry {
  const id = threadId.trim()
  if (!id) return registry
  const workspaces: DesignThreadRegistry['workspaces'] = {}
  for (const [workspaceRoot, record] of Object.entries(registry.workspaces)) {
    const threadIds = record.threadIds.filter((item) => item !== id)
    if (threadIds.length === 0) continue
    workspaces[workspaceRoot] = {
      activeThreadId: record.activeThreadId === id ? threadIds[0] : record.activeThreadId,
      threadIds
    }
  }
  return normalizeDesignThreadRegistry({ version: 1, workspaces })
}

export function activeDesignThreadForWorkspace(
  workspaceRoot: string,
  threads: NormalizedThread[],
  registry: DesignThreadRegistry = readDesignThreadRegistry()
): NormalizedThread | null {
  const key = designWorkspaceKey(workspaceRoot)
  if (!key) return null
  const record = registry.workspaces[key]
  if (!record) return null
  const candidates = record.threadIds
    .map((id) => threads.find((thread) => thread.id === id) ?? null)
    .filter((thread): thread is NormalizedThread => Boolean(thread))
    .filter((thread) => thread.archived !== true)
  return candidates.find((thread) => thread.id === record.activeThreadId) ?? candidates[0] ?? null
}
