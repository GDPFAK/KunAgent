import type { AppSettingsV1 } from '../shared/app-settings-types'
import {
  getKunRuntimeSettings,
  getModelProviderProfile,
  resolveKunRuntimeSettings
} from '../shared/app-settings'
import { clawScheduleMcpSettingsChanged } from './claw-schedule-mcp-config'

export type RuntimeSettingsApplyMode = 'none' | 'hot' | 'restart'

/**
 * Stable equality for the Kun runtime settings. Most fields are flat,
 * but GUI-managed capability options can be nested, so compare values
 * structurally while still surviving future field additions.
 */
export function kunRuntimeConfigChanged(prev: AppSettingsV1, next: AppSettingsV1): boolean {
  const a = resolveKunRuntimeSettings(prev)
  const b = resolveKunRuntimeSettings(next)
  const keys = new Set([...Object.keys(a), ...Object.keys(b)] as Array<keyof typeof a>)
  for (const key of keys) {
    if (!stableSettingsValueEqual(a[key], b[key])) return true
  }
  return false
}

export function stableSettingsStringify(value: unknown): string {
  return JSON.stringify(canonicalSettingsValue(value))
}

export function runtimeProcessConfigChanged(prev: AppSettingsV1, next: AppSettingsV1): boolean {
  return runtimeProcessConfigFingerprint(prev) !== runtimeProcessConfigFingerprint(next)
}

export function runtimeSettingsApplyMode(prev: AppSettingsV1, next: AppSettingsV1): RuntimeSettingsApplyMode {
  if (runtimeProcessConfigChanged(prev, next)) return 'restart'
  if (runtimeHotConfigChanged(prev, next)) return 'hot'
  return 'none'
}

function runtimeProcessConfigFingerprint(settings: AppSettingsV1): string {
  const runtime = getKunRuntimeSettings(settings)
  const activeProvider = getModelProviderProfile(settings, runtime.providerId)
  return stableSettingsStringify({
    binaryPath: runtime.binaryPath.trim(),
    port: runtime.port,
    autoStart: runtime.autoStart,
    runtimeToken: runtime.runtimeToken.trim(),
    dataDir: runtime.dataDir.trim(),
    storage: runtime.storage,
    insecure: runtime.insecure,
    defaultProviderKind: activeProvider.kind ?? 'http',
    ...(process.platform === 'darwin'
      ? { computerUseEnabled: runtime.computerUse.enabled }
      : {})
  })
}

function runtimeHotConfigChanged(prev: AppSettingsV1, next: AppSettingsV1): boolean {
  return kunRuntimeConfigChanged(prev, next) || clawScheduleMcpSettingsChanged(prev, next)
}

function stableSettingsValueEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  return stableSettingsStringify(a) === stableSettingsStringify(b)
}

function canonicalSettingsValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalSettingsValue)
  if (!value || typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    out[key] = canonicalSettingsValue((value as Record<string, unknown>)[key])
  }
  return out
}
