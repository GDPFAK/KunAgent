import { ModelReasoningEffort } from '../contracts/capabilities.js'

/**
 * Normalize a configured per-role reasoning-depth value into a valid
 * ModelReasoningEffort. Invalid or missing values fall back to 'off' so the
 * cheap default never accidentally escalates a title/summary/review call.
 */
export function normalizeRoleReasoningEffort(value: string | undefined): ModelReasoningEffort {
  const parsed = ModelReasoningEffort.safeParse(typeof value === 'string' ? value.trim() : value)
  return parsed.success ? parsed.data : 'off'
}
