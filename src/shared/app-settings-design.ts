import type { DesignSettingsPatchV1, DesignSettingsV1, DesignSystemPreset } from './app-settings-types'

export const DESIGN_SYSTEM_PRESETS: readonly DesignSystemPreset[] = [
  'none',
  'shadcn',
  'material',
  'ios',
  'fluent'
]

const MAX_TONE_CHIPS = 12
const MAX_TONE_LENGTH = 32
const MAX_BRAND_COLOR_LENGTH = 32

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeDesignSystemPreset(value: unknown): DesignSystemPreset {
  return typeof value === 'string' && (DESIGN_SYSTEM_PRESETS as readonly string[]).includes(value)
    ? (value as DesignSystemPreset)
    : 'none'
}

function normalizeTone(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const trimmed = entry.trim().slice(0, MAX_TONE_LENGTH)
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
    if (out.length >= MAX_TONE_CHIPS) break
  }
  return out
}

export function defaultDesignSettings(): DesignSettingsV1 {
  return {
    defaultWorkspaceRoot: '',
    brandColor: '',
    tone: [],
    designSystemPreset: 'none'
  }
}

export function normalizeDesignSettings(input: DesignSettingsPatchV1 | undefined): DesignSettingsV1 {
  const source = isRecord(input) ? (input as DesignSettingsPatchV1) : {}
  return {
    defaultWorkspaceRoot:
      typeof source.defaultWorkspaceRoot === 'string' ? source.defaultWorkspaceRoot.trim() : '',
    brandColor:
      typeof source.brandColor === 'string'
        ? source.brandColor.trim().slice(0, MAX_BRAND_COLOR_LENGTH)
        : '',
    tone: normalizeTone(source.tone),
    designSystemPreset: normalizeDesignSystemPreset(source.designSystemPreset)
  }
}

export function mergeDesignSettings(
  current: DesignSettingsV1,
  patch: DesignSettingsPatchV1 | undefined
): DesignSettingsV1 {
  if (!patch) return normalizeDesignSettings(current)
  return normalizeDesignSettings({ ...current, ...patch })
}
