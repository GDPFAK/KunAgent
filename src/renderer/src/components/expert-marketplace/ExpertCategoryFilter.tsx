import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

export type ExpertCategory = {
  id: string
  name: { zh: string; en: string }
  description: { zh: string; en: string }
}

type Props = {
  categories: ExpertCategory[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function ExpertCategoryFilter({ categories, selectedId, onSelect }: Props): ReactElement {
  const { i18n } = useTranslation()
  const lang = i18n.language?.startsWith('zh') ? 'zh' : 'en'

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
          selectedId === null
            ? 'bg-[var(--ds-accent)] text-white'
            : 'bg-[var(--ds-surface-subtle)] text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-hover)]'
        }`}
      >
        {lang === 'zh' ? '全部' : 'All'}
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onSelect(cat.id)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            selectedId === cat.id
              ? 'bg-[var(--ds-accent)] text-white'
              : 'bg-[var(--ds-surface-subtle)] text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-hover)]'
          }`}
        >
          {cat.name[lang]}
        </button>
      ))}
    </div>
  )
}
