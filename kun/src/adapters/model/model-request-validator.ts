/**
 * Provider-layer parameter validation and normalization.
 *
 * Before a provider adapter sends a request to a model API, this validator
 * checks that known parameters (reasoning_effort, max_tokens, temperature,
 * top_p) have valid types and values. Invalid parameters produce a clear
 * error. Out-of-range values are automatically clamped to the nearest valid
 * value instead of silently dropped.
 *
 * The normalized params MUST be merged back into the request body so the
 * corrected values actually reach the API (addresses Issue #281).
 */

import type { ModelRequest } from '../../ports/model-client.js'

// ── Reasoning effort ──────────────────────────────────────────────────────

export const REASONING_EFFORT_VALUES = ['auto', 'off', 'low', 'medium', 'high', 'max'] as const
export type ReasoningEffort = (typeof REASONING_EFFORT_VALUES)[number]

export function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return typeof value === 'string' && (REASONING_EFFORT_VALUES as readonly string[]).includes(value)
}

/** Normalize reasoning effort aliases to canonical form. */
export function normalizeReasoningEffort(value: unknown): ReasoningEffort | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  switch (normalized) {
    case 'auto':
    case 'adaptive':
      return 'auto'
    case 'off':
    case 'disabled':
    case 'none':
    case 'false':
      return 'off'
    case 'low':
    case 'minimal':
      return 'low'
    case 'medium':
    case 'mid':
      return 'medium'
    case 'high':
      return 'high'
    case 'max':
    case 'maximum':
    case 'xhigh':
      return 'max'
    default:
      return undefined
  }
}

// ── Validation rules ──────────────────────────────────────────────────────

export type ModelValidationRules = {
  supportedReasoningEfforts?: readonly ReasoningEffort[]
  maxTokensRange?: [number, number]
  temperatureRange?: [number, number]
  topPRange?: [number, number]
  supportsStreaming?: boolean
  supportsToolCalls?: boolean
  supportsResponseFormat?: boolean
}

export type ValidationResult =
  | { valid: true; normalized: NormalizedModelParams }
  | { valid: false; error: string; field: string }

export type NormalizedModelParams = {
  reasoningEffort?: ReasoningEffort
  maxTokens?: number
  temperature?: number
  topP?: number
  stream: boolean
}

export const DEFAULT_VALIDATION_RULES: ModelValidationRules = {
  supportedReasoningEfforts: REASONING_EFFORT_VALUES,
  maxTokensRange: [1, 1_000_000],
  temperatureRange: [0, 2],
  topPRange: [0, 1],
  supportsStreaming: true,
  supportsToolCalls: true,
  supportsResponseFormat: true
}

/**
 * Validate a model request against provider-specific rules.
 *
 * On success returns the normalized params — these MUST be merged into
 * the request before sending so corrected values reach the API.
 *
 * On failure returns the field name and a human-readable error message.
 */
export function validateModelRequest(
  request: Pick<ModelRequest, 'reasoningEffort' | 'maxTokens' | 'temperature' | 'topP' | 'stream'>,
  rules: ModelValidationRules = {}
): ValidationResult {
  const merged: NormalizedModelParams = { stream: request.stream ?? true }

  // ── reasoning_effort ──────────────────────────────────────────
  if (request.reasoningEffort !== undefined && request.reasoningEffort !== null) {
    const normalized = normalizeReasoningEffort(request.reasoningEffort)
    if (normalized === undefined) {
      return {
        valid: false,
        field: 'reasoningEffort',
        error: `Invalid reasoning_effort: "${String(request.reasoningEffort)}". Valid values: ${REASONING_EFFORT_VALUES.join(', ')}`
      }
    }
    const supported = rules.supportedReasoningEfforts ?? DEFAULT_VALIDATION_RULES.supportedReasoningEfforts ?? REASONING_EFFORT_VALUES
    if (!(supported as readonly string[]).includes(normalized)) {
      // Don't reject — map to the closest supported value instead.
      const corrected = closestSupportedEffort(normalized, supported)
      if (corrected) {
        merged.reasoningEffort = corrected
      }
    } else {
      merged.reasoningEffort = normalized
    }
  }

  // ── max_tokens ────────────────────────────────────────────────
  if (request.maxTokens !== undefined && request.maxTokens !== null) {
    if (typeof request.maxTokens !== 'number' || !Number.isFinite(request.maxTokens)) {
      return {
        valid: false,
        field: 'maxTokens',
        error: `max_tokens must be a finite number, got ${typeof request.maxTokens}`
      }
    }
    const [min, max] = rules.maxTokensRange ?? DEFAULT_VALIDATION_RULES.maxTokensRange ?? [1, 1_000_000]
    if (request.maxTokens < min) {
      merged.maxTokens = min
    } else if (request.maxTokens > max) {
      merged.maxTokens = max
    } else {
      merged.maxTokens = Math.floor(request.maxTokens)
    }
  }

  // ── temperature ───────────────────────────────────────────────
  if (request.temperature !== undefined && request.temperature !== null) {
    if (typeof request.temperature !== 'number' || !Number.isFinite(request.temperature)) {
      return {
        valid: false,
        field: 'temperature',
        error: `temperature must be a finite number, got ${typeof request.temperature}`
      }
    }
    const [min, max] = rules.temperatureRange ?? DEFAULT_VALIDATION_RULES.temperatureRange ?? [0, 2]
    if (request.temperature < min) {
      merged.temperature = min
    } else if (request.temperature > max) {
      merged.temperature = max
    } else {
      merged.temperature = request.temperature
    }
  }

  // ── top_p ─────────────────────────────────────────────────────
  if (request.topP !== undefined && request.topP !== null) {
    if (typeof request.topP !== 'number' || !Number.isFinite(request.topP)) {
      return {
        valid: false,
        field: 'topP',
        error: `top_p must be a finite number, got ${typeof request.topP}`
      }
    }
    const [min, max] = rules.topPRange ?? DEFAULT_VALIDATION_RULES.topPRange ?? [0, 1]
    if (request.topP < min) {
      merged.topP = min
    } else if (request.topP > max) {
      merged.topP = max
    } else {
      merged.topP = request.topP
    }
  }

  return { valid: true, normalized: merged }
}

/**
 * Find the closest supported reasoning effort when the requested one
 * is not in the provider's supported list. Prefers lower effort levels
 * to avoid unexpectedly expensive responses.
 */
function closestSupportedEffort(
  requested: ReasoningEffort,
  supported: readonly ReasoningEffort[]
): ReasoningEffort | undefined {
  const order: Record<ReasoningEffort, number> = {
    off: 0,
    auto: 0,
    low: 1,
    medium: 2,
    high: 3,
    max: 4
  }
  // Auto is not in supported list; fall back to lowest non-zero effort
  // so the model still performs some reasoning rather than turning it off.
  if (requested === 'auto' && !(supported as readonly string[]).includes('auto')) {
    for (const effort of ['low', 'medium', 'high', 'max'] as const) {
      if ((supported as readonly string[]).includes(effort)) return effort
    }
  }

  const requestedRank = order[requested]

  // Try exact rank match or nearest lower
  let best: ReasoningEffort | undefined
  let bestRank = -1
  for (const s of supported) {
    const r = order[s]
    if (r <= requestedRank && r > bestRank) {
      best = s
      bestRank = r
    }
  }
  if (best) return best

  // Fall back to nearest higher
  let bestHigher: ReasoningEffort | undefined
  let bestHigherRank = 99
  for (const s of supported) {
    const r = order[s]
    if (r > requestedRank && r < bestHigherRank) {
      bestHigher = s
      bestHigherRank = r
    }
  }
  return bestHigher
}

// ── Per-provider validation rules ─────────────────────────────────────────

export const PROVIDER_VALIDATION_RULES: Record<string, ModelValidationRules> = {
  openai: {
    supportedReasoningEfforts: ['auto', 'low', 'medium', 'high'],
    maxTokensRange: [1, 200_000],
    temperatureRange: [0, 2],
    topPRange: [0, 1],
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsResponseFormat: true
  },
  deepseek: {
    supportedReasoningEfforts: ['auto', 'off', 'low', 'medium', 'high', 'max'],
    maxTokensRange: [1, 32_768],
    temperatureRange: [0, 2],
    topPRange: [0, 1],
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsResponseFormat: true
  },
  siliconflow: {
    supportedReasoningEfforts: ['off', 'low', 'medium', 'high'],
    maxTokensRange: [1, 32_768],
    temperatureRange: [0, 2],
    topPRange: [0, 1],
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsResponseFormat: true
  },
  anthropic: {
    supportedReasoningEfforts: ['off', 'low', 'medium', 'high', 'max'],
    maxTokensRange: [1, 200_000],
    temperatureRange: [0, 1],
    topPRange: [0, 1],
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsResponseFormat: false
  },
  gemini: {
    supportedReasoningEfforts: ['off', 'low', 'medium', 'high'],
    maxTokensRange: [1, 65_536],
    temperatureRange: [0, 2],
    topPRange: [0, 1],
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsResponseFormat: true
  },
  minimax: {
    supportedReasoningEfforts: ['off', 'low', 'medium', 'high'],
    maxTokensRange: [1, 32_768],
    temperatureRange: [0, 2],
    topPRange: [0, 1],
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsResponseFormat: true
  }
}

/**
 * Detect which provider's validation rules to apply based on the base URL.
 * Unknown providers get the most generous defaults.
 */
export function detectProviderRules(baseUrl: string): ModelValidationRules {
  const lower = baseUrl.toLowerCase()
  if (lower.includes('api.deepseek.com')) return PROVIDER_VALIDATION_RULES.deepseek
  if (lower.includes('api.openai.com')) return PROVIDER_VALIDATION_RULES.openai
  if (lower.includes('api.siliconflow.cn') || lower.includes('siliconflow')) return PROVIDER_VALIDATION_RULES.siliconflow
  if (lower.includes('api.anthropic.com')) return PROVIDER_VALIDATION_RULES.anthropic
  if (lower.includes('generativelanguage') || lower.includes('gemini')) return PROVIDER_VALIDATION_RULES.gemini
  if (lower.includes('api.minimaxi.com') || lower.includes('minimax')) return PROVIDER_VALIDATION_RULES.minimax
  return DEFAULT_VALIDATION_RULES
}
