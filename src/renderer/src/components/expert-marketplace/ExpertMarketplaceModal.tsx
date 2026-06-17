import type { ReactElement } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { ExpertMarketplaceView, type ExpertMarketplaceItem } from './ExpertMarketplaceView'
import { getProvider } from '../../agent/registry'

type Props = {
  open: boolean
  onClose: () => void
  onSelectExpert: (expert: ExpertMarketplaceItem) => void
}

export function ExpertMarketplaceModal({ open, onClose, onSelectExpert }: Props): ReactElement | null {
  const { i18n } = useTranslation()
  const [categories, setCategories] = useState<Array<{ id: string; name: { zh: string; en: string }; description: { zh: string; en: string } }>>([])
  const [experts, setExperts] = useState<ExpertMarketplaceItem[]>([])
  const [loading, setLoading] = useState(false)

  const loadExperts = useCallback(async () => {
    setLoading(true)
    try {
      const provider = getProvider()
      if (provider.getExperts) {
        const result = await provider.getExperts()
        setCategories(result.categories)
        setExperts(result.experts as ExpertMarketplaceItem[])
      }
    } catch (error) {
      console.error('Failed to load experts:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      loadExperts()
    }
  }, [open, loadExperts])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex h-[80vh] w-[90vw] max-w-[1200px] flex-col overflow-hidden rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-bg-canvas)] shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-subtle)] hover:text-[var(--ds-text)]"
        >
          <X className="h-4 w-4" />
        </button>
        <ExpertMarketplaceView
          categories={categories}
          experts={experts}
          onSelectExpert={onSelectExpert}
          loading={loading}
        />
      </div>
    </div>
  )
}
