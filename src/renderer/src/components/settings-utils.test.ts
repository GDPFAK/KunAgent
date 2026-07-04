import { describe, expect, it } from 'vitest'
import type { AppSettingsV1, KunRuntimeSettingsV1 } from '@shared/app-settings'
import { coerceRendererSettings, diffSettingsPatch, mergeSettings } from './settings-utils'

function settings(kunPatch: Partial<KunRuntimeSettingsV1> = {}): AppSettingsV1 {
  return coerceRendererSettings({
    agents: {
      kun: kunPatch
    }
  } as unknown as AppSettingsV1)
}

describe('diffSettingsPatch', () => {
  it('omits an unchanged blank runtime token when another setting changes', () => {
    const base = settings({ runtimeToken: '' })
    const next: AppSettingsV1 = {
      ...base,
      theme: 'dark'
    }

    const patch = diffSettingsPatch(base, next)

    expect(patch).toEqual({ theme: 'dark' })
    expect(patch.agents).toBeUndefined()
  })

  it('preserves an explicit runtime token clear', () => {
    const base = settings({ runtimeToken: 'generated-token' })
    const next: AppSettingsV1 = {
      ...base,
      agents: {
        kun: {
          ...base.agents.kun,
          runtimeToken: ''
        }
      }
    }

    expect(diffSettingsPatch(base, next)).toEqual({
      agents: {
        kun: {
          runtimeToken: ''
        }
      }
    })
  })

  it('diffs nested provider fields without sending the full settings snapshot', () => {
    const base = settings()
    const next: AppSettingsV1 = {
      ...base,
      provider: {
        ...base.provider,
        apiKey: 'sk-next'
      }
    }

    expect(diffSettingsPatch(base, next)).toEqual({
      provider: {
        apiKey: 'sk-next'
      }
    })
  })

  it('preserves provider proxy siblings when applying a partial diff patch', () => {
    const base: AppSettingsV1 = {
      ...settings(),
      provider: {
        ...settings().provider,
        proxy: {
          enabled: true,
          url: 'http://127.0.0.1:7890'
        }
      }
    }
    const next: AppSettingsV1 = {
      ...base,
      provider: {
        ...base.provider,
        proxy: {
          ...base.provider.proxy,
          url: 'http://127.0.0.1:9999'
        }
      }
    }

    const patch = diffSettingsPatch(base, next)

    expect(patch).toEqual({
      provider: {
        proxy: {
          url: 'http://127.0.0.1:9999'
        }
      }
    })
    expect(mergeSettings(base, patch).provider.proxy).toEqual({
      enabled: true,
      url: 'http://127.0.0.1:9999'
    })
  })
})
