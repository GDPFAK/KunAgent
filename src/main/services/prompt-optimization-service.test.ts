import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_PROMPT_OPTIMIZATION_PROMPT,
  defaultClawSettings,
  defaultDesignSettings,
  defaultKeyboardShortcuts,
  defaultKunRuntimeSettings,
  defaultModelProviderSettings,
  defaultScheduleSettings,
  defaultTerminalSettings,
  defaultWorkflowSettings,
  defaultWriteSettings,
  type AppSettingsV1
} from '../../shared/app-settings'
import { optimizePrompt } from './prompt-optimization-service'

function createSettings(patch: Partial<AppSettingsV1['agents']['kun']> = {}): AppSettingsV1 {
  return {
    version: 1,
    locale: 'en',
    theme: 'system',
    uiFontScale: 0.82,
    chatContentMaxWidthPx: 896,
    provider: defaultModelProviderSettings(),
    agents: {
      kun: {
        ...defaultKunRuntimeSettings(),
        apiKey: 'sk-runtime',
        promptOptimization: {
          ...defaultKunRuntimeSettings().promptOptimization,
          enabled: true
        },
        ...patch
      }
    },
    workspaceRoot: '/tmp/workspace',
    conversationWorkspaceRoot: '~/Documents/Kun',
    log: {
      enabled: true,
      retentionDays: 2
    },
    checkpointCleanup: { enabled: false, intervalDays: 3 },
    notifications: {
      turnComplete: true
    },
    appBehavior: { openAtLogin: false, startMinimized: false, closeToTray: false },
    keyboardShortcuts: defaultKeyboardShortcuts(),
    write: defaultWriteSettings(),
    schedule: defaultScheduleSettings(),
    workflow: defaultWorkflowSettings(),
    terminal: defaultTerminalSettings(),
    guiUpdate: {
      channel: 'stable'
    },
    design: defaultDesignSettings(),
    codePromptPrefix: '',
    disabledSkillIds: [],
    claw: defaultClawSettings()
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('optimizePrompt', () => {
  it('uses the default prompt and replaces rough text with the model response', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        choices: [{ message: { content: 'Implement prompt optimization with a composer button.' } }]
      }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await optimizePrompt(createSettings(), '嗯 加个按钮 优化一下 prompt')

    expect(result).toEqual({
      ok: true,
      text: 'Implement prompt optimization with a composer button.',
      model: 'deepseek-v4-pro',
      providerId: 'deepseek'
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-runtime'
        })
      })
    )
    const firstCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(String(firstCall[1].body)) as {
      model: string
      messages: Array<{ role: string; content: string }>
    }
    expect(body.model).toBe('deepseek-v4-pro')
    expect(body.messages[0]).toEqual({
      role: 'system',
      content: DEFAULT_PROMPT_OPTIMIZATION_PROMPT
    })
    expect(body.messages[1]).toEqual({
      role: 'user',
      content: '嗯 加个按钮 优化一下 prompt'
    })
  })

  it('honors custom prompt optimization model settings', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        choices: [{ message: { content: 'Use the configured optimizer model.' } }]
      }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)
    const settings = createSettings({
      promptOptimization: {
        enabled: true,
        providerId: '',
        model: 'deepseek-v4-flash',
        prompt: 'Rewrite only.',
        timeoutMs: 12345
      }
    })

    const result = await optimizePrompt(settings, 'rewrite this')

    expect(result).toEqual({
      ok: true,
      text: 'Use the configured optimizer model.',
      model: 'deepseek-v4-flash',
      providerId: 'deepseek'
    })
    const firstCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(String(firstCall[1].body)) as {
      model: string
      messages: Array<{ role: string; content: string }>
    }
    expect(body.model).toBe('deepseek-v4-flash')
    expect(body.messages[0].content).toBe('Rewrite only.')
  })

  it('uses the selected optimizer provider model instead of an unrelated small model', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        choices: [{ message: { content: 'Use the selected provider default.' } }]
      }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)
    const settings = createSettings({
      providerId: 'deepseek',
      smallModelProviderId: 'deepseek',
      smallModel: 'deepseek-v4-flash',
      promptOptimization: {
        enabled: true,
        providerId: 'other',
        model: '',
        prompt: '',
        timeoutMs: 60000
      }
    })
    settings.provider.providers.push({
      id: 'other',
      name: 'Other',
      apiKey: 'sk-other',
      baseUrl: 'https://other.example',
      endpointFormat: 'chat_completions',
      models: ['other-chat'],
      modelProfiles: {}
    })

    const result = await optimizePrompt(settings, 'rewrite this')

    expect(result).toEqual({
      ok: true,
      text: 'Use the selected provider default.',
      model: 'other-chat',
      providerId: 'other'
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://other.example/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-other'
        })
      })
    )
    const firstCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(String(firstCall[1].body)) as { model: string }
    expect(body.model).toBe('other-chat')
  })
})
