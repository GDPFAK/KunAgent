import { type ReactElement } from 'react'
import { WandSparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DesignAgentAction } from '../../../design/agent-actions/design-agent-actions'

type Props = {
  open: boolean
  actions: readonly DesignAgentAction[]
  buttonClassName: string
  buttonActiveClassName: string
  buttonInactiveClassName: string
  onToggle: () => void
  onSelect: (action: DesignAgentAction) => void
}

export function DesignAgentActionMenu({
  open,
  actions,
  buttonClassName,
  buttonActiveClassName,
  buttonInactiveClassName,
  onToggle,
  onSelect
}: Props): ReactElement {
  const { t } = useTranslation('common')
  return (
    <div className="relative">
      <button
        type="button"
        className={`${buttonClassName} ${open ? buttonActiveClassName : buttonInactiveClassName}`}
        onClick={onToggle}
        title={t('designAgentActions')}
        aria-label={t('designAgentActions')}
        aria-expanded={open}
      >
        <WandSparkles className="h-4 w-4" strokeWidth={1.9} />
      </button>
      {open ? (
        <div className="absolute right-12 top-1/2 z-30 w-64 -translate-y-1/2 rounded-2xl border border-ds-border bg-white p-1.5 shadow-[0_18px_42px_rgba(20,47,95,0.18)] dark:bg-ds-card">
          {actions.map((action) => {
            const disabled = Boolean(action.disabledReasonKey)
            const title = action.disabledReasonKey ? t(action.disabledReasonKey) : t(action.detailKey)
            return (
              <button
                key={action.id}
                type="button"
                disabled={disabled}
                title={title}
                onClick={() => onSelect(action)}
                className="flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left text-[12.5px] text-ds-ink transition hover:bg-ds-hover disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t(action.labelKey)}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-ds-faint">
                    {t(action.detailKey)}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
