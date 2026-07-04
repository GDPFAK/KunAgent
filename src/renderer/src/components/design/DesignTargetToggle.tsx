import type { ReactElement } from 'react'
import { Monitor, Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { defaultFrameSizeForDesignTarget } from '../../design/design-context'

export type DesignTargetToggleValue = 'web' | 'app'

export function DesignTargetToggle({
  designTarget,
  disabled,
  disabledReason,
  hint,
  webDetail,
  appDetail,
  onChange
}: {
  designTarget: DesignTargetToggleValue
  disabled?: boolean
  disabledReason?: string
  hint?: string
  webDetail?: string
  appDetail?: string
  onChange: (target: DesignTargetToggleValue) => void
}): ReactElement {
  const { t } = useTranslation('common')
  const webSize = defaultFrameSizeForDesignTarget('web')
  const appSize = defaultFrameSizeForDesignTarget('app')
  const webName = t('designTargetWeb', 'Web')
  const appName = t('designTargetApp', 'App')
  const resolvedWebDetail =
    webDetail ??
    t('designTargetContextWeb', {
      width: webSize.width,
      height: webSize.height,
      defaultValue: `Default ${webSize.width} x ${webSize.height} web frame`
    })
  const resolvedAppDetail =
    appDetail ??
    t('designTargetContextApp', {
      width: appSize.width,
      height: appSize.height,
      defaultValue: `Default ${appSize.width} x ${appSize.height} app frame`
    })
  const webLabel = `${webName}: ${resolvedWebDetail}`
  const appLabel = `${appName}: ${resolvedAppDetail}`
  const resolvedHint =
    disabled && disabledReason
      ? disabledReason
      : (hint ?? t('designTargetHint', 'Choose whether the design agent defaults to web pages or mobile app screens'))
  const webAriaLabel = disabled && disabledReason ? `${webLabel}. ${disabledReason}` : webLabel
  const appAriaLabel = disabled && disabledReason ? `${appLabel}. ${disabledReason}` : appLabel
  const webTitle = disabled && disabledReason ? `${resolvedWebDetail}. ${disabledReason}` : resolvedWebDetail
  const appTitle = disabled && disabledReason ? `${resolvedAppDetail}. ${disabledReason}` : resolvedAppDetail
  return (
    <div
      className="inline-flex shrink-0 items-center rounded-full border border-ds-border bg-ds-surface-subtle p-0.5 text-[12px] font-semibold text-ds-muted shadow-sm dark:bg-white/6"
      title={resolvedHint}
      aria-label={resolvedHint}
    >
      <button
        type="button"
        onClick={() => onChange('web')}
        aria-pressed={designTarget === 'web'}
        aria-label={webAriaLabel}
        title={webTitle}
        disabled={disabled}
        className={`inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 transition disabled:cursor-not-allowed disabled:opacity-60 ${
          designTarget === 'web'
            ? 'bg-white text-ds-ink shadow-sm dark:bg-white/14 dark:text-white'
            : 'hover:bg-ds-hover hover:text-ds-ink'
        }`}
      >
        <Monitor className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
        {webName}
      </button>
      <button
        type="button"
        onClick={() => onChange('app')}
        aria-pressed={designTarget === 'app'}
        aria-label={appAriaLabel}
        title={appTitle}
        disabled={disabled}
        className={`inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 transition disabled:cursor-not-allowed disabled:opacity-60 ${
          designTarget === 'app'
            ? 'bg-white text-ds-ink shadow-sm dark:bg-white/14 dark:text-white'
            : 'hover:bg-ds-hover hover:text-ds-ink'
        }`}
      >
        <Smartphone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
        {appName}
      </button>
    </div>
  )
}
