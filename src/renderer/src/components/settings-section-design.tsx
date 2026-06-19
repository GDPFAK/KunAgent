import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DESIGN_SYSTEM_PRESETS,
  defaultDesignSettings,
  type DesignSettingsV1,
  type DesignSystemPreset
} from '@shared/app-settings'
import { DESIGN_TONE_OPTIONS } from '../design/design-context'
import { SettingsCard, SettingRow } from './settings-controls'

const textInputClass =
  'w-full rounded-xl border border-ds-border bg-ds-card px-3 py-2 text-[14px] text-ds-ink shadow-sm focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/30'

function chipClass(active: boolean): string {
  return `rounded-full px-3 py-1 text-[13px] transition-colors ${
    active
      ? 'bg-[#3b82d8] text-white'
      : 'border border-ds-border bg-ds-card text-ds-ink hover:bg-ds-hover'
  }`
}

/**
 * Persistent design defaults (brand color / tone / design system / workspace).
 * These seed the per-session design-context form in the design agent panel.
 */
export function DesignSettingsSection({ ctx }: { ctx: Record<string, unknown> }): ReactElement {
  const { t } = useTranslation('common')
  const form = ctx.form as { design?: DesignSettingsV1 }
  const update = ctx.update as (patch: { design: Partial<DesignSettingsV1> }) => void
  const design = form.design ?? defaultDesignSettings()
  const tone = design.tone ?? []
  const toggleTone = (value: string): void => {
    update({
      design: { tone: tone.includes(value) ? tone.filter((item) => item !== value) : [...tone, value] }
    })
  }

  return (
    <SettingsCard title={t('design')}>
      <SettingRow
        title={t('designSettingsWorkspace')}
        description={t('designSettingsWorkspaceHint')}
        wideControl
        control={
          <input
            type="text"
            value={design.defaultWorkspaceRoot}
            onChange={(e) => update({ design: { defaultWorkspaceRoot: e.target.value } })}
            placeholder="~/Designs"
            className={textInputClass}
          />
        }
      />
      <SettingRow
        title={t('designAgentBrandColor')}
        wideControl
        control={
          <input
            type="text"
            value={design.brandColor}
            onChange={(e) => update({ design: { brandColor: e.target.value } })}
            placeholder="#3b82d8"
            className={textInputClass}
          />
        }
      />
      <SettingRow
        title={t('designAgentTone')}
        wideControl
        control={
          <div className="flex flex-wrap gap-1.5">
            {DESIGN_TONE_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleTone(value)}
                className={chipClass(tone.includes(value))}
              >
                {value}
              </button>
            ))}
          </div>
        }
      />
      <SettingRow
        title={t('designAgentSystem')}
        wideControl
        control={
          <select
            value={design.designSystemPreset}
            onChange={(e) => update({ design: { designSystemPreset: e.target.value as DesignSystemPreset } })}
            className={textInputClass}
          >
            {DESIGN_SYSTEM_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {t(`designSystem_${preset}`)}
              </option>
            ))}
          </select>
        }
      />
    </SettingsCard>
  )
}
