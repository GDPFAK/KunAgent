import { describe, expect, it } from 'vitest'
import {
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
} from '../shared/app-settings'
import { runtimeSettingsApplyMode } from './runtime-settings-apply-mode'

function settings(): AppSettingsV1 {
  return {
    version: 1,
    locale: 'en',
    theme: 'system',
    uiFontScale: 0.82,
    chatContentMaxWidthPx: 896,
    provider: defaultModelProviderSettings(),
    agents: {
      kun: defaultKunRuntimeSettings()
    },
    workspaceRoot: '/tmp/workspace',
    conversationWorkspaceRoot: '~/Documents/Kun',
    log: { enabled: false, retentionDays: 7 },
    checkpointCleanup: { enabled: false, intervalDays: 3 },
    notifications: { turnComplete: true },
    appBehavior: { openAtLogin: false, startMinimized: false, closeToTray: false },
    keyboardShortcuts: defaultKeyboardShortcuts(),
    write: defaultWriteSettings(),
    claw: defaultClawSettings(),
    schedule: defaultScheduleSettings(),
    workflow: defaultWorkflowSettings(),
    design: defaultDesignSettings(),
    terminal: defaultTerminalSettings(),
    guiUpdate: { channel: 'stable' },
    codePromptPrefix: '',
    disabledSkillIds: []
  }
}

describe('runtimeSettingsApplyMode', () => {
  it('ignores UI-only settings', () => {
    const prev = settings()
    const next = { ...prev, uiFontScale: 0.9, theme: 'dark' as const }

    expect(runtimeSettingsApplyMode(prev, next)).toBe('none')
  })

  it('hot-applies model, provider, approval, media, MCP, and memory changes', () => {
    const prev = settings()
    const withModel = {
      ...prev,
      agents: { kun: { ...prev.agents.kun, model: 'deepseek-reasoner' } }
    }
    const withProviderKey = {
      ...prev,
      provider: { ...prev.provider, apiKey: 'sk-next' }
    }
    const withApproval = {
      ...prev,
      agents: { kun: { ...prev.agents.kun, approvalPolicy: 'never' as const, sandboxMode: 'read-only' as const } }
    }
    const withMedia = {
      ...prev,
      agents: {
        kun: {
          ...prev.agents.kun,
          imageGeneration: {
            ...prev.agents.kun.imageGeneration,
            enabled: true,
            providerId: 'deepseek',
            model: 'image-model'
          }
        }
      }
    }
    const withMcp = {
      ...prev,
      schedule: {
        ...prev.schedule,
        internal: { ...prev.schedule.internal, port: prev.schedule.internal.port + 1 }
      }
    }
    const withMemory = {
      ...prev,
      agents: { kun: { ...prev.agents.kun, memoryEnabled: true } }
    }

    expect(runtimeSettingsApplyMode(prev, withModel)).toBe('hot')
    expect(runtimeSettingsApplyMode(prev, withProviderKey)).toBe('hot')
    expect(runtimeSettingsApplyMode(prev, withApproval)).toBe('hot')
    expect(runtimeSettingsApplyMode(prev, withMedia)).toBe('hot')
    expect(runtimeSettingsApplyMode(prev, withMcp)).toBe('hot')
    expect(runtimeSettingsApplyMode(prev, withMemory)).toBe('hot')
  })

  it('requires restart for process-level runtime changes', () => {
    const prev = settings()

    expect(runtimeSettingsApplyMode(prev, {
      ...prev,
      agents: { kun: { ...prev.agents.kun, port: prev.agents.kun.port + 1 } }
    })).toBe('restart')
    expect(runtimeSettingsApplyMode(prev, {
      ...prev,
      agents: { kun: { ...prev.agents.kun, dataDir: '/tmp/kun-next' } }
    })).toBe('restart')
    expect(runtimeSettingsApplyMode(prev, {
      ...prev,
      agents: { kun: { ...prev.agents.kun, runtimeToken: 'tok-next' } }
    })).toBe('restart')
    expect(runtimeSettingsApplyMode(prev, {
      ...prev,
      agents: {
        kun: {
          ...prev.agents.kun,
          storage: { ...prev.agents.kun.storage, backend: 'file' as const }
        }
      }
    })).toBe('restart')
  })

  it('requires restart when the active default provider switches between http and agent-sdk', () => {
    const prev = settings()
    const provider = prev.provider.providers[0]!
    const next = {
      ...prev,
      provider: {
        ...prev.provider,
        providers: [
          { ...provider, kind: 'agent-sdk' as const }
        ]
      }
    }

    expect(runtimeSettingsApplyMode(prev, next)).toBe('restart')
  })
})
