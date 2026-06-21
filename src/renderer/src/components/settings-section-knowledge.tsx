import { useEffect, useMemo, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { Database, FilePlus2, Plus, Search, Trash2 } from 'lucide-react'
import type {
  CoreKnowledgeBaseRecordJson,
  CoreKnowledgeChunkSearchResultJson,
  CoreKnowledgeDocumentRecordJson,
  CoreKnowledgeProviderKindJson
} from '../agent/kun-contract'
import { SettingsCard, SettingRow, Toggle } from './settings-controls'

type KnowledgeBaseDraft = {
  id: string
  name: string
  description: string
  providerKind: CoreKnowledgeProviderKindJson
  enabled: boolean
  embeddingBaseUrl: string
  embeddingApiKey: string
  embeddingModel: string
  embeddingDimensions: string
  rerankerEnabled: boolean
  rerankerBaseUrl: string
  rerankerApiKey: string
  rerankerModel: string
  externalProvider: string
  externalEndpoint: string
  externalApiKey: string
}

const EMPTY_KB_DRAFT: KnowledgeBaseDraft = {
  id: '',
  name: '',
  description: '',
  providerKind: 'local-sqlite',
  enabled: true,
  embeddingBaseUrl: '',
  embeddingApiKey: '',
  embeddingModel: '',
  embeddingDimensions: '',
  rerankerEnabled: false,
  rerankerBaseUrl: '',
  rerankerApiKey: '',
  rerankerModel: '',
  externalProvider: '',
  externalEndpoint: '',
  externalApiKey: ''
}

type KnowledgeDocumentDraft = {
  name: string
  mode: 'text' | 'file'
  text: string
  sourcePath: string
}

const EMPTY_DOC_DRAFT: KnowledgeDocumentDraft = {
  name: '',
  mode: 'text',
  text: '',
  sourcePath: ''
}

const NEW_KNOWLEDGE_BASE_ID = '__new_knowledge_base__'

export function KnowledgeSettingsSection({ ctx }: { ctx: Record<string, any> }): ReactElement {
  const {
    t,
    kun,
    updateKun,
    knowledgeBases,
    knowledgeDiagnostics,
    knowledgeDocumentsByBase,
    knowledgeSearchResults,
    createKnowledgeBaseRecord,
    updateKnowledgeBaseRecord,
    deleteKnowledgeBaseRecord,
    loadKnowledgeDocuments,
    addKnowledgeDocumentRecord,
    deleteKnowledgeDocumentRecord,
    searchKnowledgeRecords
  } = ctx

  const bases: CoreKnowledgeBaseRecordJson[] = knowledgeBases ?? []
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState<KnowledgeBaseDraft>(EMPTY_KB_DRAFT)
  const [docDraft, setDocDraft] = useState<KnowledgeDocumentDraft>(EMPTY_DOC_DRAFT)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTopK, setSearchTopK] = useState(8)

  const selected = useMemo(
    () => selectedId === NEW_KNOWLEDGE_BASE_ID
      ? null
      : bases.find((base) => base.id === selectedId) ?? bases[0] ?? null,
    [bases, selectedId]
  )
  const documents: CoreKnowledgeDocumentRecordJson[] = selected
    ? (knowledgeDocumentsByBase?.[selected.id] ?? [])
    : []
  const results: CoreKnowledgeChunkSearchResultJson[] = knowledgeSearchResults ?? []

  useEffect(() => {
    if (!selected) {
      setDraft(EMPTY_KB_DRAFT)
      return
    }
    setSelectedId(selected.id)
    setDraft(recordToDraft(selected))
    void loadKnowledgeDocuments?.(selected.id)
  }, [selected?.id])

  const beginCreate = (): void => {
    setSelectedId(NEW_KNOWLEDGE_BASE_ID)
    setDraft({ ...EMPTY_KB_DRAFT })
  }

  const saveKnowledgeBase = async (): Promise<void> => {
    const name = draft.name.trim()
    if (!name) return
    const payload = draftToPayload(draft)
    if (draft.id) {
      await updateKnowledgeBaseRecord?.(draft.id, payload)
      return
    }
    const created = await createKnowledgeBaseRecord?.(payload)
    if (created?.id) setSelectedId(created.id)
  }

  const addDocument = async (): Promise<void> => {
    if (!selected) return
    const payload: Record<string, string | undefined> = docDraft.mode === 'file'
      ? {
          name: docDraft.name.trim() || undefined,
          sourceType: 'file',
          sourcePath: docDraft.sourcePath.trim()
        }
      : {
          name: docDraft.name.trim() || undefined,
          sourceType: 'text',
          text: docDraft.text.trim()
        }
    if (!payload.sourcePath && !payload.text) return
    const created = await addKnowledgeDocumentRecord?.(selected.id, payload)
    if (created) setDocDraft(EMPTY_DOC_DRAFT)
  }

  const pickDocumentFile = async (): Promise<void> => {
    if (typeof window.kunGui?.pickKnowledgeDocumentFile !== 'function') return
    const picked = await window.kunGui.pickKnowledgeDocumentFile(docDraft.sourcePath || undefined)
    if (picked.canceled || !picked.path) return
    setDocDraft((prev) => ({
      ...prev,
      mode: 'file',
      sourcePath: picked.path ?? '',
      name: prev.name.trim() ? prev.name : fileNameFromPath(picked.path ?? '')
    }))
  }

  const runSearch = async (): Promise<void> => {
    const query = searchQuery.trim()
    if (!query) return
    await searchKnowledgeRecords?.({
      query,
      knowledgeBaseIds: selected ? [selected.id] : [],
      topK: searchTopK
    })
  }

  return (
    <SettingsCard title={t('sectionKnowledge')}>
      <SettingRow
        title={t('knowledgeEnable')}
        description={t('knowledgeEnableDesc')}
        control={
          <Toggle
            checked={kun?.knowledgeEnabled ?? false}
            onChange={(checked: boolean) => updateKun({ knowledgeEnabled: checked })}
          />
        }
      />
      <SettingRow
        title={t('knowledgeOverview')}
        description={t('knowledgeOverviewDesc')}
        wideControl
        control={
          <div className="grid grid-cols-4 gap-2 text-[12px]">
            {[
              [t('knowledgeBases'), knowledgeDiagnostics?.knowledgeBaseCount ?? bases.length],
              [t('knowledgeDocuments'), knowledgeDiagnostics?.documentCount ?? 0],
              [t('knowledgeChunks'), knowledgeDiagnostics?.chunkCount ?? 0],
              [t('knowledgeExternal'), knowledgeDiagnostics?.externalProviderCount ?? 0]
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-ds-border-muted bg-ds-main/40 px-3 py-2">
                <div className="text-ds-faint">{label}</div>
                <div className="mt-0.5 font-mono text-[15px] font-semibold text-ds-ink">{value}</div>
              </div>
            ))}
          </div>
        }
      />
      <SettingRow
        title={t('knowledgeManage')}
        description={t('knowledgeManageDesc')}
        wideControl
        control={
          <div className="grid gap-4">
            {knowledgeDiagnostics?.available === false ? (
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-[12px] text-amber-700 dark:border-amber-800/40 dark:bg-amber-500/10 dark:text-amber-300">
                {knowledgeDiagnostics.reason ?? t('knowledgeUnavailable')}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap gap-1.5">
                {bases.length === 0 ? (
                  <span className="text-[12px] text-ds-faint">{t('knowledgeEmpty')}</span>
                ) : bases.map((base) => (
                  <button
                    key={base.id}
                    type="button"
                    onClick={() => setSelectedId(base.id)}
                    className={`rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition ${
                      selected?.id === base.id
                        ? 'bg-ds-ink text-ds-main'
                        : 'bg-ds-hover/60 text-ds-muted hover:text-ds-ink'
                    }`}
                  >
                    {base.name}
                    <span className="ml-1 font-mono opacity-70">{base.chunkCount}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={beginCreate}
                className="inline-flex items-center gap-1.5 rounded-lg bg-ds-ink px-2.5 py-1.5 text-[12px] font-semibold text-ds-main transition hover:opacity-85"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                {t('knowledgeCreate')}
              </button>
            </div>

            <div className="rounded-2xl border border-ds-border-muted bg-ds-main/35 p-3">
              <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ds-ink">
                <Database className="h-4 w-4" strokeWidth={1.8} />
                {draft.id ? t('knowledgeEditBase') : t('knowledgeNewBase')}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input className={inputClass()} value={draft.name} placeholder={t('knowledgeName')}
                  onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
                <select className={inputClass()} value={draft.providerKind}
                  onChange={(e) => setDraft((prev) => ({ ...prev, providerKind: e.target.value as CoreKnowledgeProviderKindJson }))}>
                  <option value="local-sqlite">{t('knowledgeProviderLocal')}</option>
                  <option value="external">{t('knowledgeProviderExternal')}</option>
                </select>
                <input className={`${inputClass()} sm:col-span-2`} value={draft.description} placeholder={t('knowledgeDescription')}
                  onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} />
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {draft.providerKind === 'local-sqlite' ? (
                  <>
                    <Fieldset title={t('knowledgeEmbedding')}>
                      <input className={inputClass()} value={draft.embeddingBaseUrl} placeholder={t('knowledgeEmbeddingBaseUrl')}
                        onChange={(e) => setDraft((prev) => ({ ...prev, embeddingBaseUrl: e.target.value }))} />
                      <input className={inputClass()} value={draft.embeddingModel} placeholder={t('knowledgeEmbeddingModel')}
                        onChange={(e) => setDraft((prev) => ({ ...prev, embeddingModel: e.target.value }))} />
                      <input className={inputClass()} value={draft.embeddingApiKey} type="password" placeholder={t('knowledgeApiKey')}
                        onChange={(e) => setDraft((prev) => ({ ...prev, embeddingApiKey: e.target.value }))} />
                      <input className={inputClass()} value={draft.embeddingDimensions} placeholder={t('knowledgeEmbeddingDimensions')}
                        onChange={(e) => setDraft((prev) => ({ ...prev, embeddingDimensions: e.target.value }))} />
                    </Fieldset>
                    <Fieldset title={t('knowledgeReranker')}>
                      <label className="flex items-center justify-between gap-3 rounded-xl border border-ds-border-muted bg-ds-card px-3 py-2 text-[12px] text-ds-muted">
                        {t('knowledgeRerankerEnable')}
                        <Toggle checked={draft.rerankerEnabled} onChange={(checked) => setDraft((prev) => ({ ...prev, rerankerEnabled: checked }))} />
                      </label>
                      <input className={inputClass()} value={draft.rerankerBaseUrl} placeholder={t('knowledgeRerankerBaseUrl')}
                        onChange={(e) => setDraft((prev) => ({ ...prev, rerankerBaseUrl: e.target.value }))} />
                      <input className={inputClass()} value={draft.rerankerModel} placeholder={t('knowledgeRerankerModel')}
                        onChange={(e) => setDraft((prev) => ({ ...prev, rerankerModel: e.target.value }))} />
                      <input className={inputClass()} value={draft.rerankerApiKey} type="password" placeholder={t('knowledgeApiKey')}
                        onChange={(e) => setDraft((prev) => ({ ...prev, rerankerApiKey: e.target.value }))} />
                    </Fieldset>
                  </>
                ) : (
                  <Fieldset title={t('knowledgeExternalProvider')}>
                    <input className={inputClass()} value={draft.externalProvider} placeholder={t('knowledgeExternalName')}
                      onChange={(e) => setDraft((prev) => ({ ...prev, externalProvider: e.target.value }))} />
                    <input className={inputClass()} value={draft.externalEndpoint} placeholder={t('knowledgeExternalEndpoint')}
                      onChange={(e) => setDraft((prev) => ({ ...prev, externalEndpoint: e.target.value }))} />
                    <input className={inputClass()} value={draft.externalApiKey} type="password" placeholder={t('knowledgeApiKey')}
                      onChange={(e) => setDraft((prev) => ({ ...prev, externalApiKey: e.target.value }))} />
                  </Fieldset>
                )}
              </div>
              <div className="mt-3 flex justify-end gap-2">
                {draft.id ? (
                  <button type="button" onClick={() => void deleteKnowledgeBaseRecord?.(draft.id)}
                    className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-red-600 transition hover:bg-red-500/10">
                    {t('knowledgeDeleteBase')}
                  </button>
                ) : null}
                <button type="button" disabled={!draft.name.trim()} onClick={() => void saveKnowledgeBase()}
                  className="rounded-lg bg-ds-ink px-2.5 py-1.5 text-[12px] font-semibold text-ds-main transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45">
                  {t('knowledgeSaveBase')}
                </button>
              </div>
            </div>
          </div>
        }
      />

      {selected ? (
        <SettingRow
          title={t('knowledgeDocumentsTitle')}
          description={t('knowledgeDocumentsDesc')}
          wideControl
          control={
            <div className="grid gap-3">
              <div className="rounded-2xl border border-ds-border-muted bg-ds-main/35 p-3">
                <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ds-ink">
                  <FilePlus2 className="h-4 w-4" strokeWidth={1.8} />
                  {t('knowledgeAddDocument')}
                </div>
                <div className="mb-2 flex gap-1 text-[12px]">
                  {(['text', 'file'] as const).map((mode) => (
                    <button key={mode} type="button" onClick={() => setDocDraft((prev) => ({ ...prev, mode }))}
                      className={`rounded-lg px-2 py-1 font-medium transition ${docDraft.mode === mode ? 'bg-ds-ink text-ds-main' : 'text-ds-muted hover:bg-ds-hover hover:text-ds-ink'}`}>
                      {t(`knowledgeDocMode_${mode}`)}
                    </button>
                  ))}
                </div>
                <input className={inputClass()} value={docDraft.name} placeholder={t('knowledgeDocumentName')}
                  onChange={(e) => setDocDraft((prev) => ({ ...prev, name: e.target.value }))} />
                {docDraft.mode === 'file' ? (
                  <div className="mt-2 flex gap-2">
                    <input className={inputClass()} value={docDraft.sourcePath} placeholder={t('knowledgeDocumentPath')}
                      onChange={(e) => setDocDraft((prev) => ({ ...prev, sourcePath: e.target.value }))} />
                    <button type="button" onClick={() => void pickDocumentFile()}
                      className="shrink-0 rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-[12px] font-semibold text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink">
                      {t('knowledgeBrowseFile')}
                    </button>
                  </div>
                ) : (
                  <textarea className={`${inputClass()} mt-2 min-h-28 resize-y`} value={docDraft.text} placeholder={t('knowledgeDocumentText')}
                    onChange={(e) => setDocDraft((prev) => ({ ...prev, text: e.target.value }))} />
                )}
                <div className="mt-2 flex justify-end">
                  <button type="button" onClick={() => void addDocument()}
                    className="rounded-lg bg-ds-ink px-2.5 py-1.5 text-[12px] font-semibold text-ds-main transition hover:opacity-85">
                    {t('knowledgeAddDocument')}
                  </button>
                </div>
              </div>
              {documents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-ds-border-muted bg-ds-main/40 px-3 py-6 text-center text-[13px] text-ds-faint">
                  {t('knowledgeDocumentsEmpty')}
                </div>
              ) : documents.map((document) => (
                <div key={document.id} className="rounded-xl border border-ds-border-muted bg-ds-main/40 px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-ds-ink">{document.name}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-ds-faint">
                        <span>{document.sourceType}</span>
                        <span>{document.chunkCount} {t('knowledgeChunks')}</span>
                        <span className="font-mono">{document.id.slice(0, 10)}</span>
                        {document.error ? <span className="text-amber-600">{document.error}</span> : null}
                      </div>
                    </div>
                    <button type="button" onClick={() => void deleteKnowledgeDocumentRecord?.(selected.id, document.id)}
                      className="rounded-lg p-1.5 text-ds-muted transition hover:bg-red-500/10 hover:text-red-600"
                      aria-label={t('knowledgeDeleteDocument')} title={t('knowledgeDeleteDocument')}>
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          }
        />
      ) : null}

      <SettingRow
        title={t('knowledgeSearchTitle')}
        description={t('knowledgeSearchDesc')}
        wideControl
        control={
          <div className="grid gap-3">
            <div className="flex gap-2">
              <input className={inputClass()} value={searchQuery} placeholder={t('knowledgeSearchPlaceholder')}
                onChange={(e) => setSearchQuery(e.target.value)} />
              <input className="w-20 rounded-xl border border-ds-border bg-ds-card px-3 py-2 text-[13px] text-ds-ink outline-none focus:border-accent/40"
                type="number" min={1} max={50} value={searchTopK}
                onChange={(e) => setSearchTopK(Math.max(1, Math.min(50, Number(e.target.value) || 8)))} />
              <button type="button" onClick={() => void runSearch()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-ds-ink px-3 py-2 text-[12px] font-semibold text-ds-main transition hover:opacity-85">
                <Search className="h-3.5 w-3.5" strokeWidth={2} />
                {t('knowledgeSearch')}
              </button>
            </div>
            {results.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ds-border-muted bg-ds-main/40 px-3 py-5 text-center text-[13px] text-ds-faint">
                {t('knowledgeSearchEmpty')}
              </div>
            ) : results.map((result, index) => (
              <div key={result.chunkId} className="rounded-xl border border-ds-border-muted bg-ds-main/40 px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ds-faint">
                  <span className="font-mono">#{index + 1}</span>
                  <span>{result.knowledgeBaseName}</span>
                  <span>{result.documentName}</span>
                  <span className="font-mono">{result.score.toFixed(3)}</span>
                </div>
                <div className="mt-1 line-clamp-4 whitespace-pre-wrap text-[12.5px] leading-5 text-ds-muted">
                  {result.text}
                </div>
              </div>
            ))}
          </div>
        }
      />
    </SettingsCard>
  )
}

function Fieldset({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <div className="grid gap-2 rounded-xl border border-ds-border-muted bg-ds-card/60 p-3">
      <div className="text-[12px] font-semibold text-ds-muted">{title}</div>
      {children}
    </div>
  )
}

function inputClass(): string {
  return 'w-full min-w-0 rounded-xl border border-ds-border bg-ds-card px-3 py-2 text-[13px] text-ds-ink shadow-sm outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/30'
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? ''
}

function recordToDraft(record: CoreKnowledgeBaseRecordJson): KnowledgeBaseDraft {
  return {
    id: record.id,
    name: record.name,
    description: record.description ?? '',
    providerKind: record.providerKind,
    enabled: record.enabled,
    embeddingBaseUrl: record.embedding?.baseUrl ?? '',
    embeddingApiKey: record.embedding?.apiKey ?? '',
    embeddingModel: record.embedding?.model ?? '',
    embeddingDimensions: record.embedding?.dimensions ? String(record.embedding.dimensions) : '',
    rerankerEnabled: record.reranker?.enabled ?? false,
    rerankerBaseUrl: record.reranker?.baseUrl ?? '',
    rerankerApiKey: record.reranker?.apiKey ?? '',
    rerankerModel: record.reranker?.model ?? '',
    externalProvider: record.external?.provider ?? '',
    externalEndpoint: record.external?.endpoint ?? '',
    externalApiKey: record.external?.apiKey ?? ''
  }
}

function draftToPayload(draft: KnowledgeBaseDraft): Record<string, unknown> {
  const dimensions = Number(draft.embeddingDimensions)
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || undefined,
    providerKind: draft.providerKind,
    enabled: draft.enabled,
    embedding: {
      baseUrl: draft.embeddingBaseUrl.trim() || undefined,
      apiKey: draft.embeddingApiKey.trim() || undefined,
      model: draft.embeddingModel.trim() || undefined,
      dimensions: Number.isFinite(dimensions) && dimensions > 0 ? Math.floor(dimensions) : undefined
    },
    reranker: {
      enabled: draft.rerankerEnabled,
      baseUrl: draft.rerankerBaseUrl.trim() || undefined,
      apiKey: draft.rerankerApiKey.trim() || undefined,
      model: draft.rerankerModel.trim() || undefined
    },
    external: draft.providerKind === 'external'
      ? {
          provider: draft.externalProvider.trim() || undefined,
          endpoint: draft.externalEndpoint.trim() || undefined,
          apiKey: draft.externalApiKey.trim() || undefined,
          metadata: {}
        }
      : undefined
  }
}
