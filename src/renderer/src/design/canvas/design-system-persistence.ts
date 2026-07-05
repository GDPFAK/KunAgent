/**
 * Persistence for the doc-level design system (tokens + components). Lives at
 * `<docDir>/design-system.json` — one per DesignDocument, shared by all its
 * artifacts/screens — alongside each artifact's `canvas.json`. Mirrors
 * canvas-persistence (debounced save, lenient load).
 */
import type { DesignSystem } from './design-system-types'
import type { CanvasShape, ShapeType } from './canvas-types'

const DESIGN_DIR = '.kun-design'
const CANVAS_SHAPE_TYPES = new Set<ShapeType>([
  'rect',
  'ellipse',
  'text',
  'image',
  'frame',
  'group',
  'arrow',
  'line',
  'draw'
])
const COMPONENT_SLOT_KINDS = new Set(['text', 'image', 'color', 'visible'])

export function designSystemPath(baseDir: string = DESIGN_DIR): string {
  return `${baseDir}/design-system.json`
}

export function serializeDesignSystem(system: DesignSystem): string {
  return JSON.stringify(system, null, 2)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isStringOrNull(value: unknown): boolean {
  return value === null || typeof value === 'string'
}

function isCornerRadius(value: unknown): boolean {
  return (
    typeof value === 'number' ||
    (Array.isArray(value) && value.length === 4 && value.every((item) => typeof item === 'number'))
  )
}

function isCanvasShapeLike(value: unknown): value is CanvasShape {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    CANVAS_SHAPE_TYPES.has(value.type as ShapeType) &&
    typeof value.name === 'string' &&
    isStringOrNull(value.parentId) &&
    isStringOrNull(value.frameId) &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.width === 'number' &&
    typeof value.height === 'number' &&
    typeof value.rotation === 'number' &&
    typeof value.opacity === 'number' &&
    typeof value.visible === 'boolean' &&
    typeof value.locked === 'boolean' &&
    Array.isArray(value.fills) &&
    Array.isArray(value.strokes) &&
    isCornerRadius(value.cornerRadius) &&
    Array.isArray(value.children) &&
    value.children.every((child) => typeof child === 'string')
  )
}

function isComponentSlotLike(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.path === 'string' &&
    typeof value.kind === 'string' &&
    COMPONENT_SLOT_KINDS.has(value.kind) &&
    (value.label === undefined || typeof value.label === 'string')
  )
}

function parseNamedEntries<T extends { name: string }>(
  value: unknown,
  isEntry: (value: Record<string, unknown>) => boolean
): Record<string, T> {
  if (!isRecord(value)) return {}
  const entries: Record<string, T> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (!isRecord(entry)) continue
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
        entry.tree.length > 0 &&
        entry.tree.every(isCanvasShapeLike) &&
        Array.isArray(entry.slots) &&
        entry.slots.every(isComponentSlotLike)
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
