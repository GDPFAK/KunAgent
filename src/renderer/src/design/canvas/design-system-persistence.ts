/**
 * Persistence for the doc-level design system (tokens + components). Lives at
 * `<docDir>/design-system.json` — one per DesignDocument, shared by all its
 * artifacts/screens — alongside each artifact's `canvas.json`. Mirrors
 * canvas-persistence (debounced save, lenient load).
 */
import type { DesignSystem } from './design-system-types'

const DESIGN_DIR = '.kun-design'

export function designSystemPath(baseDir: string = DESIGN_DIR): string {
  return `${baseDir}/design-system.json`
}

export function serializeDesignSystem(system: DesignSystem): string {
  return JSON.stringify(system, null, 2)
}

function parseNamedEntries<T extends { name: string }>(
  value: unknown,
  isEntry: (value: Record<string, unknown>) => boolean
): Record<string, T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const entries: Record<string, T> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const record = entry as Record<string, unknown>
    if (!isEntry(record)) continue
    const name = typeof record.name === 'string' && record.name.trim() ? record.name : key
    entries[key] = { ...record, name } as T
  }
  return entries
}

export function parseDesignSystem(raw: string): DesignSystem | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const obj = parsed as { tokens?: unknown; components?: unknown }
    const tokens = parseNamedEntries<DesignSystem['tokens'][string]>(
      obj.tokens,
      (entry) => typeof entry.kind === 'string' && 'value' in entry
    )
    const components = parseNamedEntries<DesignSystem['components'][string]>(
      obj.components,
      (entry) =>
        typeof entry.id === 'string' &&
        typeof entry.version === 'number' &&
        Array.isArray(entry.tree) &&
        Array.isArray(entry.slots)
    )
    return { tokens, components }
  } catch {
    return null
  }
}

const _saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

function designSystemSaveKey(workspaceRoot: string, baseDir: string | undefined): string {
  return [workspaceRoot, baseDir ?? DESIGN_DIR].join('\0')
}

export function persistDesignSystem(
  workspaceRoot: string,
  system: DesignSystem,
  baseDir?: string
): void {
  if (!workspaceRoot || typeof window.kunGui?.writeWorkspaceFile !== 'function') return
  const key = designSystemSaveKey(workspaceRoot, baseDir)
  const existingTimer = _saveTimers.get(key)
  if (existingTimer) clearTimeout(existingTimer)
  const timer = setTimeout(() => {
    _saveTimers.delete(key)
    void window.kunGui
      .writeWorkspaceFile({
        path: designSystemPath(baseDir),
        workspaceRoot,
        content: serializeDesignSystem(system)
      })
      .catch(() => undefined)
  }, 600)
  _saveTimers.set(key, timer)
}

export async function loadDesignSystem(
  workspaceRoot: string,
  baseDir?: string
): Promise<DesignSystem | null> {
  if (!workspaceRoot || typeof window.kunGui?.readWorkspaceFile !== 'function') return null
  try {
    const result = await window.kunGui.readWorkspaceFile({
      path: designSystemPath(baseDir),
      workspaceRoot
    })
    if (!result || !result.ok) return null
    return parseDesignSystem(result.content)
  } catch {
    return null
  }
}
