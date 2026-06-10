import { describe, expect, it, vi } from 'vitest'
import {
  defaultClawSettings,
  defaultKeyboardShortcuts,
  defaultKunRuntimeSettings,
  defaultModelProviderSettings,
  defaultScheduleSettings,
  defaultWriteSettings,
  mergeScheduleSettings,
  type AppSettingsPatch,
  type AppSettingsV1
} from '../shared/app-settings'
import { ScheduleRuntime } from './schedule-runtime'

function settingsWith(schedulePatch: AppSettingsPatch['schedule'] = {}): AppSettingsV1 {
  return {
    version: 1,
    locale: 'en',
    theme: 'system',
    uiFontScale: 'small',
    provider: defaultModelProviderSettings(),
    agents: {
      kun: {
        ...defaultKunRuntimeSettings(),
        apiKey: 'test-key'
      }
    },
    workspaceRoot: '/tmp/workspace',
    log: { enabled: true, retentionDays: 7 },
    notifications: { turnComplete: true },
    appBehavior: { openAtLogin: false, startMinimized: false, closeToTray: false },
    keyboardShortcuts: defaultKeyboardShortcuts(),
    write: defaultWriteSettings(),
    claw: defaultClawSettings(),
    schedule: mergeScheduleSettings(defaultScheduleSettings(), {
      enabled: true,
      promptPrefix: 'Schedule-only prefix',
      ...schedulePatch
    }),
    guiUpdate: { channel: 'stable' },
    codePromptPrefix: ''
  }
}

function createStore(initial: AppSettingsV1) {
  let current = initial
  return {
    load: vi.fn(async () => current),
    patch: vi.fn(async (partial: AppSettingsPatch) => {
      current = {
        ...current,
        schedule: mergeScheduleSettings(current.schedule, partial.schedule),
        claw: current.claw
      }
      return current
    }),
    read: () => current
  }
}

describe('ScheduleRuntime gui thread creation', () => {
  it('starts a direct Kun thread without wrapping the prompt as a scheduled task', async () => {
    const runtimeRequest = vi.fn(async (_settings, path, init) => {
      if (path === '/v1/threads' && init?.method === 'POST') {
        return { ok: true, status: 201, body: JSON.stringify({ id: 'thr_direct' }) }
      }
      if (path === '/v1/threads/thr_direct/turns' && init?.method === 'POST') {
        return { ok: true, status: 202, body: JSON.stringify({ turnId: 'turn_direct' }) }
      }
      throw new Error(`unexpected path ${path}`)
    })
    const store = createStore(settingsWith())
    const runtime = new ScheduleRuntime({
      store: store as never,
      runtimeRequest: runtimeRequest as never,
      logError: vi.fn()
    })

    const result = await runtime.createThreadFromInput({
      title: 'Continue long task',
      prompt: 'Continue from the handoff summary.',
      workspaceRoot: '/tmp/project',
      model: 'deepseek-v4-flash',
      reasoningEffort: 'high',
      mode: 'plan'
    })

    expect(result).toMatchObject({
      ok: true,
      threadId: 'thr_direct',
      turnId: 'turn_direct',
      message: 'Started'
    })
    const createBody = JSON.parse(String(runtimeRequest.mock.calls[0]?.[2]?.body))
    const turnBody = JSON.parse(String(runtimeRequest.mock.calls[1]?.[2]?.body))
    expect(createBody).toMatchObject({
      title: 'Continue long task',
      workspace: '/tmp/project',
      model: 'deepseek-v4-flash',
      mode: 'plan'
    })
    expect(turnBody).toMatchObject({
      prompt: 'Continue from the handoff summary.',
      mode: 'plan',
      model: 'deepseek-v4-flash',
      reasoningEffort: 'high'
    })
    expect(turnBody.prompt).not.toContain('Current scheduled task')
    expect(turnBody.prompt).not.toContain('Schedule-only prefix')
    expect(store.patch).not.toHaveBeenCalled()
  })
})
