import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DEEPSEEK_BASE_URL,
  defaultClawSettings,
  defaultKeyboardShortcuts,
  defaultKunRuntimeSettings,
  defaultModelProviderSettings,
  defaultScheduleSettings,
  defaultWriteSettings,
  normalizeModelProviderSettings,
  resolveModelProviderBaseUrl,
  resolveKunRuntimeSettings,
  type AppSettingsV1
} from './app-settings'

function settings(): AppSettingsV1 {
  return {
    version: 1,
    locale: 'en',
    theme: 'system',
    uiFontScale: 'small',
    provider: {
      ...defaultModelProviderSettings(),
      providers: [
        ...defaultModelProviderSettings().providers,
        {
          id: 'custom',
          name: 'Custom Provider',
          apiKey: 'sk-custom',
          baseUrl: 'https://custom.example/v1',
          endpointFormat: 'messages',
          models: ['custom-model']
        }
      ]
    },
    agents: {
      kun: {
        ...defaultKunRuntimeSettings(),
        providerId: 'custom',
        model: 'custom-model'
      }
    },
    workspaceRoot: '/tmp/workspace',
    log: { enabled: false, retentionDays: 7 },
    notifications: { turnComplete: true },
    appBehavior: { openAtLogin: false, startMinimized: false, closeToTray: false },
    keyboardShortcuts: defaultKeyboardShortcuts(),
    write: defaultWriteSettings(),
    claw: defaultClawSettings(),
    schedule: defaultScheduleSettings(),
    guiUpdate: { channel: 'stable' },
    codePromptPrefix: ''
  }
}

describe('model provider settings', () => {
  it('resolves Kun runtime credentials from the selected provider', () => {
    const runtime = resolveKunRuntimeSettings(settings())

    expect(runtime.apiKey).toBe('sk-custom')
    expect(runtime.baseUrl).toBe('https://custom.example/v1')
    expect(runtime.endpointFormat).toBe('messages')
  })

  it('preserves a cleared default base URL while resolving the official runtime endpoint', () => {
    const state = settings()
    const normalized = normalizeModelProviderSettings({
      ...state.provider,
      baseUrl: '',
      providers: state.provider.providers.map((provider) =>
        provider.id === 'deepseek'
          ? { ...provider, baseUrl: '' }
          : provider
      )
    })

    expect(normalized.baseUrl).toBe('')
    expect(normalized.providers.find((provider) => provider.id === 'deepseek')?.baseUrl).toBe('')
    expect(resolveModelProviderBaseUrl({ ...state, provider: normalized })).toBe(DEFAULT_DEEPSEEK_BASE_URL)
  })

  it('keeps deprecated DeepSeek models out of the default provider list', () => {
    const defaultModels = defaultModelProviderSettings().providers[0].models

    expect(defaultModels).toEqual(['deepseek-v4-pro', 'deepseek-v4-flash'])
    expect(defaultModels).not.toContain('deepseek-chat')
    expect(defaultModels).not.toContain('deepseek-reasoner')
  })
})
