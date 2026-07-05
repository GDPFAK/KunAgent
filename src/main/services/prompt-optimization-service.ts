import {
  DEFAULT_DEEPSEEK_BASE_URL,
  getModelProviderProfile,
  modelEndpointPath,
  modelProviderModelProfile,
  resolveKunPromptOptimizationPrompt,
  resolveKunRuntimeSettings,
  resolveModelEndpointFormat,
  resolveModelProviderProxyUrl,
  isCustomModelEndpointFormat,
  type AppSettingsV1,
  type ModelEndpointFormat,
  type ModelProviderProfileV1
} from '../../shared/app-settings'
import type { PromptOptimizationResult } from '../../shared/kun-gui-api'
import { fetchWithOptionalProxy } from '../proxy-fetch'

type PromptOptimizationRequestPayload = {
  url: string
  endpointFormat: ModelEndpointFormat
  headers: Record<string, string>
  body: Record<string, unknown>
}

const DEFAULT_MAX_OUTPUT_TOKENS = 1600

function buildModelEndpointUrl(baseUrl: string, endpointFormat: ModelEndpointFormat): string {
  if (isCustomModelEndpointFormat(endpointFormat)) return exactModelEndpointUrl(baseUrl)
  const path = modelEndpointPath(endpointFormat)
  const normalized = baseUrl.replace(/\/+$/, '')
  if (!normalized) return `/v1/${path}`
  if (normalized.endsWith('/v1')) return `${normalized}/${path}`
  if (normalized.endsWith('/beta')) return `${normalized.slice(0, -5)}/v1/${path}`
  return `${normalized}/v1/${path}`
}

function exactModelEndpointUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim()
  const query = trimmed.search(/[?#]/)
  if (query < 0) return trimmed.replace(/\/+$/, '')
  return `${trimmed.slice(0, query).replace(/\/+$/, '')}${trimmed.slice(query)}`
}

function firstProviderModel(provider: ModelProviderProfileV1): string {
  return provider.models.map((item) => item.trim()).find(Boolean) ?? ''
}

function defaultPromptOptimizationModel(
  runtime: ReturnType<typeof resolveKunRuntimeSettings>,
  provider: ModelProviderProfileV1
): string {
  const smallModel = runtime.smallModel?.trim() ?? ''
  const smallProviderId = runtime.smallModelProviderId?.trim() || runtime.providerId.trim() || provider.id
  if (smallModel && smallProviderId === provider.id) return smallModel

  const mainModel = runtime.model.trim()
  const mainProviderId = runtime.providerId.trim() || provider.id
  if (mainModel && mainProviderId === provider.id) return mainModel

  return firstProviderModel(provider) || mainModel
}

function effectivePromptOptimizationModel(settings: AppSettingsV1): {
  providerId: string
  model: string
  apiKey: string
  baseUrl: string
  endpointFormat: ModelEndpointFormat
  systemPrompt: string
  timeoutMs: number
} {
  const runtime = resolveKunRuntimeSettings(settings)
  const promptOptimization = runtime.promptOptimization
  const providerId = promptOptimization.providerId.trim() || runtime.providerId
  const provider = getModelProviderProfile(settings, providerId)
  const model = promptOptimization.model.trim() || defaultPromptOptimizationModel(runtime, provider)
  const profile = modelProviderModelProfile(provider, model)
  const endpointFormat = profile?.endpointFormat ?? provider.endpointFormat
  return {
    providerId: provider.id,
    model,
    apiKey: provider.apiKey.trim() || runtime.apiKey.trim(),
    baseUrl: provider.baseUrl.trim() || runtime.baseUrl.trim() || DEFAULT_DEEPSEEK_BASE_URL,
    endpointFormat,
    systemPrompt: resolveKunPromptOptimizationPrompt(runtime),
    timeoutMs: promptOptimization.timeoutMs
  }
}

function buildPromptOptimizationRequest(input: {
  baseUrl: string
  apiKey: string
  endpointFormat: ModelEndpointFormat
  model: string
  systemPrompt: string
  sourceText: string
}): PromptOptimizationRequestPayload | null {
  const endpointFormat = resolveModelEndpointFormat(input.endpointFormat, input.baseUrl)
  if (!endpointFormat) return null
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${input.apiKey}`
  }
  if (endpointFormat === 'messages') {
    headers['x-api-key'] = input.apiKey
    headers['anthropic-version'] = '2023-06-01'
  }
  if (endpointFormat === 'responses') {
    return {
      url: buildModelEndpointUrl(input.baseUrl, input.endpointFormat),
      endpointFormat,
      headers,
      body: {
        model: input.model,
        instructions: input.systemPrompt,
        input: input.sourceText,
        max_output_tokens: DEFAULT_MAX_OUTPUT_TOKENS
      }
    }
  }
  if (endpointFormat === 'messages') {
    return {
      url: buildModelEndpointUrl(input.baseUrl, input.endpointFormat),
      endpointFormat,
      headers,
      body: {
        model: input.model,
        system: input.systemPrompt,
        messages: [{ role: 'user', content: input.sourceText }],
        max_tokens: DEFAULT_MAX_OUTPUT_TOKENS
      }
    }
  }
  return {
    url: buildModelEndpointUrl(input.baseUrl, input.endpointFormat),
    endpointFormat,
    headers,
    body: {
      model: input.model,
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.sourceText }
      ],
      max_tokens: DEFAULT_MAX_OUTPUT_TOKENS
    }
  }
}

function extractPromptOptimizationContent(rawJson: string, endpointFormat: ModelEndpointFormat): string {
  const parsed = JSON.parse(rawJson) as Record<string, unknown>
  if (endpointFormat === 'responses') {
    if (typeof parsed.output_text === 'string') return parsed.output_text.trim()
    const output = parsed.output
    if (!Array.isArray(output)) return ''
    return output.map((item) => {
      if (!item || typeof item !== 'object') return ''
      const content = (item as { content?: unknown }).content
      if (!Array.isArray(content)) return ''
      return content.map((block) => {
        if (!block || typeof block !== 'object') return ''
        const text = (block as { text?: unknown }).text
        if (typeof text === 'string') return text
        const outputText = (block as { output_text?: unknown }).output_text
        return typeof outputText === 'string' ? outputText : ''
      }).join('')
    }).join('').trim()
  }
  if (endpointFormat === 'messages') {
    const content = parsed.content
    if (!Array.isArray(content)) return ''
    return content.map((block) =>
      block && typeof block === 'object' && typeof (block as { text?: unknown }).text === 'string'
        ? (block as { text: string }).text
        : ''
    ).join('').trim()
  }
  const choices = parsed.choices
  if (!Array.isArray(choices)) return ''
  const first = choices[0]
  return first && typeof first === 'object'
    ? String((first as { message?: { content?: unknown } }).message?.content ?? '').trim()
    : ''
}

export async function optimizePrompt(
  settings: AppSettingsV1,
  sourceText: string
): Promise<PromptOptimizationResult> {
  const trimmed = sourceText.trim()
  if (!trimmed) return { ok: false, message: 'Prompt text is empty.' }
  const modelSettings = effectivePromptOptimizationModel(settings)
  if (!resolveKunRuntimeSettings(settings).promptOptimization.enabled) {
    return { ok: false, message: 'Prompt optimization is disabled.' }
  }
  if (!modelSettings.apiKey) {
    return { ok: false, message: 'Prompt optimization model is missing an API key.' }
  }
  const request = buildPromptOptimizationRequest({
    baseUrl: modelSettings.baseUrl,
    apiKey: modelSettings.apiKey,
    endpointFormat: modelSettings.endpointFormat,
    model: modelSettings.model,
    systemPrompt: modelSettings.systemPrompt,
    sourceText: trimmed
  })
  if (!request) return { ok: false, message: 'Prompt optimization endpoint format is invalid.' }

  let response: Response
  let bodyText = ''
  try {
    response = await fetchWithOptionalProxy(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(modelSettings.timeoutMs)
    }, resolveModelProviderProxyUrl(settings))
    bodyText = await response.text()
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    }
  }
  if (!response.ok) {
    return {
      ok: false,
      message: `Prompt optimization request failed with HTTP ${response.status}: ${bodyText.slice(0, 300)}`
    }
  }
  try {
    const optimized = extractPromptOptimizationContent(bodyText, request.endpointFormat).trim()
    if (!optimized) return { ok: false, message: 'Prompt optimization returned empty text.' }
    return {
      ok: true,
      text: optimized,
      model: modelSettings.model,
      providerId: modelSettings.providerId
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    }
  }
}
