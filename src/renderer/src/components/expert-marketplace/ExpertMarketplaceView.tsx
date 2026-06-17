import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Bot, ChevronLeft, Loader2, Search, Users, X } from 'lucide-react'
import { ExpertCard, type ExpertCardData } from './ExpertCard'
import { ExpertCategoryFilter, type ExpertCategory } from './ExpertCategoryFilter'
import { rendererRuntimeClient } from '../../agent/runtime-client'

function MemberAvatar({ avatar, name }: { avatar?: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    if (!avatar) return
    const filename = avatar.split('/').pop() ?? avatar
    setUrl(null)
    rendererRuntimeClient.runtimeRequest(`/v1/experts/avatars/${encodeURIComponent(filename)}`, 'GET')
      .then((result) => {
        if (!mountedRef.current) return
        if (result.ok) {
          try { setUrl((JSON.parse(result.body) as { dataUrl: string }).dataUrl) } catch { setUrl(null) }
        } else { setUrl(null) }
      })
      .catch(() => { if (mountedRef.current) setUrl(null) })
    return () => { mountedRef.current = false }
  }, [avatar])

  return url ? (
    <img src={url} alt={name} className="h-10 w-10 rounded-full object-cover" />
  ) : (
    <Bot className="h-5 w-5 text-[var(--ds-text-muted)]" />
  )
}

export type ExpertMarketplaceItem = {
  id: string
  displayName: { zh: string; en: string }
  profession: { zh: string; en: string }
  description: { zh: string; en: string }
  avatar?: string
  avatarDataUrl?: string
  tags: Array<{ zh: string; en: string }>
  categoryId: string
  isOPC?: boolean
  promptFile: string
  quickPrompts?: Array<{ zh: string; en: string }>
  defaultInitPrompt?: { zh: string; en: string }
  expertType?: string
  agentName?: string
  plugin?: string
  members?: Array<{
    id: string
    displayName: { zh: string; en: string }
    profession: { zh: string; en: string }
    avatar?: string
    promptFile?: string
    role?: string
  }>
}

type Props = {
  categories: ExpertCategory[]
  experts: ExpertMarketplaceItem[]
  onSelectExpert: (expert: ExpertMarketplaceItem) => void
  onBack?: () => void
  loading?: boolean
}

export function ExpertMarketplaceView({
  categories,
  experts,
  onSelectExpert,
  onBack,
  loading = false
}: Props): ReactElement {
  const { i18n } = useTranslation()
  const lang = i18n.language?.startsWith('zh') ? 'zh' : 'en'
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedExpert, setSelectedExpert] = useState<ExpertMarketplaceItem | null>(null)
  const [viewFilter, setViewFilter] = useState<'all' | 'categories' | 'experts' | 'teams'>('all')

  const filteredExperts = useMemo(() => {
    let result = experts
    if (viewFilter === 'teams') {
      result = result.filter((e) => e.expertType === 'team')
    } else if (viewFilter === 'experts') {
      result = result.filter((e) => e.expertType !== 'team')
    } else if (viewFilter === 'categories') {
      result = []
    }
    if (selectedCategoryId && viewFilter !== 'categories') {
      result = result.filter((e) => e.categoryId === selectedCategoryId)
    }
    if (searchQuery.trim()) {
      const lower = searchQuery.toLowerCase()
      result = result.filter(
        (e) =>
          e.displayName.zh.toLowerCase().includes(lower) ||
          e.displayName.en.toLowerCase().includes(lower) ||
          e.profession.zh.toLowerCase().includes(lower) ||
          e.profession.en.toLowerCase().includes(lower) ||
          e.description.zh.toLowerCase().includes(lower) ||
          e.description.en.toLowerCase().includes(lower) ||
          e.tags.some((t) => t.zh.toLowerCase().includes(lower) || t.en.toLowerCase().includes(lower))
      )
    }
    return result
  }, [experts, selectedCategoryId, searchQuery, viewFilter])

  const handleSelect = useCallback(
    (expert: ExpertCardData) => {
      const item = experts.find((e) => e.id === expert.id)
      if (!item) return
      if (item.members && item.members.length > 0) {
        setSelectedExpert(item)
      } else {
        onSelectExpert(item)
      }
    },
    [experts, onSelectExpert]
  )

  if (selectedExpert) {
    const members = selectedExpert.members ?? []
    return (
      <div className="flex h-full flex-col bg-[var(--ds-bg-canvas)]">
        <header className="flex items-center gap-3 border-b border-[var(--ds-border)] px-4 py-3">
          <button
            type="button"
            onClick={() => setSelectedExpert(null)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-subtle)]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <Bot className="h-5 w-5 text-[var(--ds-accent)]" />
          <div>
            <h1 className="text-base font-semibold text-[var(--ds-text)]">
              {selectedExpert.displayName[lang]}
            </h1>
            <p className="text-xs text-[var(--ds-text-muted)]">
              {selectedExpert.profession[lang]} · {members.length}{lang === 'zh' ? '位成员' : ' members'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedExpert(null)
                onSelectExpert(selectedExpert)
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ds-accent)] px-3 py-2 text-sm font-medium text-white hover:brightness-110"
            >
              <Users className="h-4 w-4" />
              {lang === 'zh' ? '召唤团队协作' : 'Call Team'}
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="mb-4 text-sm leading-relaxed text-[var(--ds-text-muted)]">
            {selectedExpert.description[lang]}
          </p>
          <h2 className="mb-3 text-sm font-semibold text-[var(--ds-text)]">
            {lang === 'zh' ? '团队成员' : 'Team Members'}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-card)] p-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ds-surface-subtle)]">
                  <MemberAvatar avatar={member.avatar} name={member.displayName[lang]} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--ds-text)]">
                    {member.displayName[lang]}
                  </p>
                  <p className="truncate text-xs text-[var(--ds-text-muted)]">
                    {member.profession[lang]}
                    {member.role && ` · ${member.role === 'lead' ? (lang === 'zh' ? '队长' : 'Lead') : member.role === 'member' ? (lang === 'zh' ? '成员' : 'Member') : member.role}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[var(--ds-bg-canvas)]">
      <header className="flex items-center gap-3 border-b border-[var(--ds-border)] px-4 py-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-subtle)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-[var(--ds-accent)]" />
          <h1 className="text-base font-semibold text-[var(--ds-text)]">
            {lang === 'zh' ? '专家市场' : 'Expert Marketplace'}
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ds-text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'zh' ? '搜索专家职称或描述...' : 'Search experts...'}
              className="h-8 w-64 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-subtle)] pl-9 pr-3 text-xs text-[var(--ds-text)] placeholder:text-[var(--ds-text-faint)] focus:border-[var(--ds-accent)] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--ds-text-muted)] hover:text-[var(--ds-text)]"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex gap-1 border-b border-[var(--ds-border)] px-4 py-2">
        {(['all', 'categories', 'experts', 'teams'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setViewFilter(tab)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              viewFilter === tab
                ? 'bg-[var(--ds-accent)] text-white'
                : 'text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-subtle)]'
            }`}
          >
            {tab === 'all' ? (lang === 'zh' ? '全部' : 'All') : tab === 'categories' ? (lang === 'zh' ? '分类' : 'Categories') : tab === 'experts' ? (lang === 'zh' ? '专家' : 'Experts') : (lang === 'zh' ? '专家团' : 'Teams')}
          </button>
        ))}
      </div>

      {viewFilter !== 'categories' ? (
        <div className="border-b border-[var(--ds-border)] px-4 py-3">
          <ExpertCategoryFilter
            categories={categories}
            selectedId={selectedCategoryId}
            onSelect={setSelectedCategoryId}
          />
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--ds-accent)]" />
          </div>
        ) : viewFilter === 'categories' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setViewFilter('all')
                  setSelectedCategoryId(cat.id)
                }}
                className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-card)] p-4 text-left transition-all hover:border-[var(--ds-accent)] hover:shadow-md"
              >
                <h3 className="text-sm font-semibold text-[var(--ds-text)]">{cat.name[lang]}</h3>
                <p className="mt-1 text-xs text-[var(--ds-text-muted)]">{cat.description[lang]}</p>
              </button>
            ))}
          </div>
        ) : filteredExperts.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-[var(--ds-text-muted)]">
            <Bot className="h-8 w-8" />
            <p className="text-sm">
              {lang === 'zh' ? '未找到匹配的专家' : 'No experts found'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredExperts.map((expert) => (
              <ExpertCard
                key={expert.id}
                expert={{
                  ...expert,
                  expertType: expert.expertType,
                  memberCount: (expert.members ?? []).length
                }}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
