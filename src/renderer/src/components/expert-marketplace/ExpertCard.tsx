import type { ReactElement } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bot, Sparkles } from 'lucide-react'
import { rendererRuntimeClient } from '../../agent/runtime-client'

export type ExpertCardData = {
  id: string
  displayName: { zh: string; en: string }
  profession: { zh: string; en: string }
  description: { zh: string; en: string }
  avatar?: string
  tags: Array<{ zh: string; en: string }>
  isOPC?: boolean
  quickPrompts?: Array<{ zh: string; en: string }>
  expertType?: string
  memberCount?: number
}

type Props = {
  expert: ExpertCardData
  onSelect: (expert: ExpertCardData) => void
  locale?: 'zh' | 'en'
}

function useAvatarUrl(avatarPath: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    if (!avatarPath) {
      setUrl(null)
      return
    }
    const filename = avatarPath.split('/').pop() ?? avatarPath
    setUrl(null)
    rendererRuntimeClient.runtimeRequest(`/v1/experts/avatars/${encodeURIComponent(filename)}`, 'GET')
      .then((result) => {
        if (!mountedRef.current) return
        if (result.ok) {
          try {
            const parsed = JSON.parse(result.body) as { dataUrl: string }
            setUrl(parsed.dataUrl)
          } catch {
            setUrl(null)
          }
        } else {
          setUrl(null)
        }
      })
      .catch(() => {
        if (mountedRef.current) setUrl(null)
      })
    return () => { mountedRef.current = false }
  }, [avatarPath])

  return url
}

export function ExpertCard({ expert, onSelect, locale = 'zh' }: Props): ReactElement {
  const { i18n } = useTranslation()
  const lang = i18n.language?.startsWith('zh') ? 'zh' : locale
  const avatarUrl = useAvatarUrl(expert.avatar)
  const isTeam = expert.expertType === 'team'
  const memberCount = expert.memberCount ?? 0

  return (
    <button
      type="button"
      onClick={() => onSelect(expert)}
      className="group flex flex-col gap-3 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-card)] p-4 text-left transition-all hover:border-[var(--ds-accent)] hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--ds-surface-subtle)]">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={expert.displayName[lang]}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <Bot className="h-6 w-6 text-[var(--ds-text-muted)]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-[var(--ds-text)]">
              {expert.displayName[lang]}
            </h3>
            {isTeam && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                团队
              </span>
            )}
            {expert.isOPC && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ds-accent-soft)] px-2 py-0.5 text-xs text-[var(--ds-accent)]">
                <Sparkles className="h-3 w-3" />
                OPC
              </span>
            )}
          </div>
          <p className="truncate text-xs text-[var(--ds-text-muted)]">
            {expert.profession[lang]}
            {isTeam && memberCount > 0 && ` · ${memberCount}人`}
          </p>
        </div>
      </div>
      <p className="line-clamp-2 text-xs leading-relaxed text-[var(--ds-text-muted)]">
        {expert.description[lang]}
      </p>
      {expert.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {expert.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.en}
              className="rounded-md bg-[var(--ds-surface-subtle)] px-2 py-0.5 text-xs text-[var(--ds-text-muted)]"
            >
              {tag[lang]}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}
