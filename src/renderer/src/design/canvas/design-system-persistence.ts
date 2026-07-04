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

export function parseDesignSystem(raw: string): DesignSystem | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const obj = parsed as { tokens?: unknown; components?: unknown }
    const tokens =
      obj.tokens && typeof obj.tokens === 'object' ? (obj.tokens as DesignSystem['tokens']) : {}
    const components =
      obj.components && typeof obj.components === 'object'
        ? (obj.components as DesignSystem['components'])
        : {}
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
