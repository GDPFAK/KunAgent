import { useMemo, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Search } from 'lucide-react'
import type { ModelProviderProfileV1 } from '@shared/app-settings'

const FIELD_CLASS =
  'w-full rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-[13px] text-ds-ink outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/25'

type Props = {
  providers: ModelProviderProfileV1[]
  providerId: string
  model: string
  onChange: (next: { providerId: string; model: string }) => void
  /** Restrict the provider dropdown, e.g. only image-capable providers. Default: all. */
  providerFilter?: (provider: ModelProviderProfileV1) => boolean
  /** Models offered for the selected provider. Default: provider.models (chat models). */
  modelsOf?: (provider: ModelProviderProfileV1) => string[]
  /** Label for the model field. Default: the generic "Model" label. */
  modelLabel?: string
  /** Hint shown under the picker when no concrete model is selected (e.g. the runtime fallback). */
  emptyHint?: string
}

/** Provider dropdown + a searchable model combobox (handles providers with many models). */
export function ModelPicker({
  providers,
  providerId,
  model,
  onChange,
  providerFilter,
  modelsOf,
  modelLabel,
  emptyHint
}: Props): ReactElement {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [rect, setRect] = useState<DOMRect | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const visibleProviders = useMemo(
    () => (providerFilter ? providers.filter(providerFilter) : providers),
    [providers, providerFilter]
  )
  const provider = providers.find((item) => item.id === providerId)
  const providerChosen = providerId.trim().length > 0
  // A model is only meaningful within a provider — never pool every provider's
  // models together, otherwise the combobox lets you pick a model with no
  // provider selected (the runtime would then have to guess the provider).
  const models = useMemo(() => {
    if (!provider) return []
    return (modelsOf ? modelsOf(provider) : provider.models).filter(Boolean)
  }, [provider, modelsOf])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (q ? models.filter((item) => item.toLowerCase().includes(q)) : models).slice(0, 200)
  }, [models, query])

  const openPanel = (): void => {
    if (!providerChosen) return
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
    setQuery('')
    setOpen(true)
  }
  const choose = (value: string): void => {
    onChange({ providerId, model: value })
    setOpen(false)
  }
  const trimmedQuery = query.trim()
  const showCustom = Boolean(trimmedQuery) && !models.some((item) => item.toLowerCase() === trimmedQuery.toLowerCase())

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-ds-muted">{t('scheduleProvider')}</span>
        <select
          className={FIELD_CLASS}
          value={providerId}
          onChange={(event) => onChange({ providerId: event.target.value, model: '' })}
        >
          <option value="">—</option>
          {visibleProviders.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name || item.id}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-ds-muted">{modelLabel ?? t('scheduleModel')}</span>
        <button
          ref={triggerRef}
          type="button"
          disabled={!providerChosen}
          className={`${FIELD_CLASS} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60`}
          onClick={() => (open ? setOpen(false) : openPanel())}
        >
          <span className={`truncate ${providerChosen && model ? 'text-ds-ink' : 'text-ds-faint'}`}>
            {providerChosen ? model || 'auto' : t('workflowModelPickProviderFirst')}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ds-faint" strokeWidth={1.8} />
        </button>
      </label>
      {emptyHint && (!providerChosen || !model.trim()) ? (
        <span className="text-[11px] leading-4 text-ds-faint">{emptyHint}</span>
      ) : null}

      {open && rect
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[80]" onClick={() => setOpen(false)} />
              <div
                className="fixed z-[81] flex max-h-[320px] flex-col overflow-hidden rounded-xl border border-ds-border bg-ds-card shadow-lg"
                style={{ left: rect.left, top: rect.bottom + 4, width: rect.width }}
              >
                <div className="flex items-center gap-2 border-b border-ds-border px-3 py-2">
                  <Search className="h-3.5 w-3.5 shrink-0 text-ds-faint" strokeWidth={1.8} />
                  <input
                    autoFocus
                    className="w-full bg-transparent text-[13px] text-ds-ink outline-none placeholder:text-ds-faint"
                    placeholder={t('workflowModelSearch')}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto py-1">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[12.5px] text-ds-muted transition hover:bg-ds-hover"
                    onClick={() => choose('')}
                  >
                    auto
                    {model === '' ? <Check className="h-3.5 w-3.5 text-accent" strokeWidth={2} /> : null}
                  </button>
                  {filtered.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[12.5px] text-ds-ink transition hover:bg-ds-hover"
                      onClick={() => choose(item)}
                    >
                      <span className="truncate">{item}</span>
                      {item === model ? <Check className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2} /> : null}
                    </button>
                  ))}
                  {showCustom ? (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-accent transition hover:bg-ds-hover"
                      onClick={() => choose(trimmedQuery)}
                    >
                      {t('workflowModelUseCustom', { model: trimmedQuery })}
                    </button>
                  ) : null}
                  {filtered.length === 0 && !showCustom ? (
                    <div className="px-3 py-2 text-[12px] text-ds-faint">{t('workflowModelNone')}</div>
                  ) : null}
                </div>
              </div>
            </>,
            document.body
          )
        : null}
    </div>
  )
}
