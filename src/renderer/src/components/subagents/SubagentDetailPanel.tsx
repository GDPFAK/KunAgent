import type { Dispatch, ReactElement, ReactNode, SetStateAction } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Bot, Check, ChevronDown, ChevronLeft, ChevronRight, Pencil, Plug, Plus, Power, Search, Sparkles, Trash2, Wrench, X } from 'lucide-react'
import type { KunSubagentProfileV1, KunSubagentsSettingsV1, ModelReasoningEffort, ModelProviderModelProfileV1 } from '@shared/app-settings'
import type { ModelProviderModelGroup } from '@shared/kun-gui-api'
import { KUN_RUNTIME_TOOLS_PATH } from '@shared/kun-endpoints'
import type { CoreRuntimeToolDiagnosticsJson } from '../../agent/kun-contract'
import { rendererRuntimeClient } from '../../agent/runtime-client'
import { confirmDialog } from '../../lib/confirm-dialog'
import { useChatStore } from '../../store/chat-store'
import { AgentKun } from './AgentKun'

type Props = { className?: string; onCollapse: () => void }

const EMPTY_SUBAGENTS: KunSubagentsSettingsV1 = { enabled: true, profiles: [] }
const PRESET_COLORS = ['#3b82d8', '#1d9e75', '#e8943a', '#7f77dd', '#d4537e', '#d85a30']

/** kun's built-in tool names (mirror kun/src/adapters/tool/builtin-tool-types.ts). Small,
 *  stable set — a static catalog gives nicer labels than parsing the loose diagnostics shape. */
const BUILTIN_TOOL_NAMES = ['read', 'grep', 'find', 'ls', 'edit', 'write', 'bash', 'lsp'] as const

type CapabilityCatalog = {
  mcpServers: Array<{ id: string; toolCount: number; status?: string }>
  skills: Array<{ id: string; name: string; description?: string }>
}

/** Fetch the live MCP-server + skill catalog from kun for the permission picker.
 *  Built-in tools come from the static list above; this only needs the dynamic bits.
 *  Returns empty lists on any failure so the dialog still renders. */
async function loadCapabilityCatalog(): Promise<CapabilityCatalog> {
  const empty: CapabilityCatalog = { mcpServers: [], skills: [] }
  try {
    const res = await rendererRuntimeClient.runtimeRequest(KUN_RUNTIME_TOOLS_PATH, 'GET')
    if (!res.ok) return empty
    const data = JSON.parse(res.body) as CoreRuntimeToolDiagnosticsJson
    const str = (v: unknown): string => (typeof v === 'string' ? v : '')
    const mcpServers = (data.mcpServers ?? [])
      .map((raw) => {
        const rec = raw as Record<string, unknown>
        return { id: str(rec.id), toolCount: Number(rec.toolCount ?? 0) || 0, status: str(rec.status) || undefined }
      })
      .filter((server) => server.id)
    const skills = (data.skills?.skills ?? [])
      .map((raw) => {
        const rec = raw as Record<string, unknown>
        const id = str(rec.id)
        return { id, name: str(rec.name) || id, description: str(rec.description) || undefined }
      })
      .filter((skill) => skill.id)
    return { mcpServers, skills }
  } catch {
    return empty
  }
}

/** kun's REAL built-in delegatable subagents (mirror kun/src/delegation/builtin-profiles.ts). */
const BUILTIN_IDS = new Set(['general', 'explore', 'design-reviewer', 'over-engineering-reviewer'])
const BUILTIN_AGENTS: KunSubagentProfileV1[] = [
  { id: 'general', enabled: true, name: '', mode: 'subagent', toolPolicy: 'inherit', color: '#3b82d8' },
  { id: 'explore', enabled: true, name: '', mode: 'subagent', toolPolicy: 'readOnly', color: '#1d9e75' },
  { id: 'design-reviewer', enabled: true, name: '', mode: 'subagent', toolPolicy: 'readOnly', color: '#7f77dd' },
  { id: 'over-engineering-reviewer', enabled: true, name: '', mode: 'subagent', toolPolicy: 'readOnly', color: '#e8943a' }
]

function newProfile(): KunSubagentProfileV1 {
  return { id: crypto.randomUUID(), enabled: true, name: '', mode: 'subagent', toolPolicy: 'readOnly' }
}

// Reasoning-effort segment (mirrors the composer's reasoning picker). Labels
// reuse the composer i18n keys (composerReasoning*). 'off' is always offered;
// the remaining levels are gated by the selected model's reasoning capability.
const REASONING_OPTIONS: Array<{ id: ModelReasoningEffort; labelKey: string }> = [
  { id: 'auto', labelKey: 'composerReasoningAuto' },
  { id: 'off', labelKey: 'composerReasoningOff' },
  { id: 'low', labelKey: 'composerReasoningLow' },
  { id: 'medium', labelKey: 'composerReasoningMedium' },
  { id: 'high', labelKey: 'composerReasoningHigh' },
  { id: 'max', labelKey: 'composerReasoningMax' }
]

function normalizeModelCapabilityKey(modelId: string): string {
  return modelId.trim().toLowerCase()
}

/** Resolve the model profile for (group, model), matching by id or alias. */
function modelProfileForModel(
  group: ModelProviderModelGroup | undefined,
  modelId: string
): ModelProviderModelProfileV1 | undefined {
  if (!group || !modelId) return undefined
  const key = normalizeModelCapabilityKey(modelId)
  if (!key) return undefined
  const profiles = group.modelProfiles ?? {}
  const direct = profiles[key] ?? profiles[modelId.trim()]
  if (direct) return direct
  return Object.values(profiles).find((p) =>
    p.aliases?.some((alias) => normalizeModelCapabilityKey(alias) === key)
  )
}

/**
 * Supported reasoning options for a concrete model. Returns [] when the model
 * has no reasoning capability — the segment is then hidden entirely.
 */
function reasoningOptionsForModel(
  profile: ModelProviderModelProfileV1 | undefined
): Array<{ id: ModelReasoningEffort; labelKey: string }> {
  const supported = profile?.reasoning?.supportedEfforts
  if (!supported || supported.length === 0) return []
  return supported
    .map((effort) => REASONING_OPTIONS.find((o) => o.id === effort))
    .filter((o): o is { id: ModelReasoningEffort; labelKey: string } => Boolean(o))
}

type RoleSlot = {
  model: string
  providerId: string
}

export function SubagentDetailPanel({ className, onCollapse }: Props): ReactElement {
  const { t } = useTranslation('common')
  const composerModelGroups = useChatStore((s) => s.composerModelGroups)
  const loadComposerModels = useChatStore((s) => s.loadComposerModels)
  const [subagents, setSubagents] = useState<KunSubagentsSettingsV1>(EMPTY_SUBAGENTS)
  // Compaction always runs in model mode (the heuristic fold is only a silent
  // fallback when the model call fails), so there is no user-facing mode toggle.
  // The model lives under contextCompaction.summaryModel (distinct from the
  // top-level kun.summaryModel, which drives the session-summary role).
  const [compactionSlot, setCompactionSlot] = useState<RoleSlot>({ model: '', providerId: '' })
  const [smallModel, setSmallModel] = useState<RoleSlot>({ model: '', providerId: '' })
  const [titleSlot, setTitleSlot] = useState<RoleSlot>({ model: '', providerId: '' })
  const [summarySlot, setSummarySlot] = useState<RoleSlot>({ model: '', providerId: '' })
  const [codeReviewSlot, setCodeReviewSlot] = useState<RoleSlot>({ model: '', providerId: '' })
  // Per-role reasoning effort. Default 'off' = omitted server-side.
  const [titleReasoning, setTitleReasoning] = useState<ModelReasoningEffort>('off')
  const [summaryReasoning, setSummaryReasoning] = useState<ModelReasoningEffort>('off')
  const [codeReviewReasoning, setCodeReviewReasoning] = useState<ModelReasoningEffort>('off')
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<{ profile: KunSubagentProfileV1; isNew: boolean } | null>(null)

  const load = useCallback(async (): Promise<void> => {
    try {
      const settings = await rendererRuntimeClient.getSettings({ forceRefresh: true })
      const kun = settings.agents?.kun
      setSubagents(kun?.subagents ?? EMPTY_SUBAGENTS)
      setCompactionSlot({
        model: kun?.contextCompaction?.summaryModel ?? '',
        providerId: kun?.contextCompaction?.summaryProviderId ?? ''
      })
      setSmallModel({ model: kun?.smallModel ?? '', providerId: kun?.smallModelProviderId ?? '' })
      setTitleSlot({ model: kun?.titleModel ?? '', providerId: kun?.titleProviderId ?? '' })
      setSummarySlot({ model: kun?.summaryModel ?? '', providerId: kun?.summaryProviderId ?? '' })
      setCodeReviewSlot({ model: kun?.codeReviewModel ?? '', providerId: kun?.codeReviewProviderId ?? '' })
      setTitleReasoning(kun?.titleReasoningEffort ?? 'off')
      setSummaryReasoning(kun?.summaryReasoningEffort ?? 'off')
      setCodeReviewReasoning(kun?.codeReviewReasoningEffort ?? 'off')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => { void loadComposerModels() }, [loadComposerModels])

  const persistProfiles = useCallback(async (profiles: KunSubagentProfileV1[]): Promise<void> => {
    const next = { ...subagents, profiles }
    setSubagents(next)
    const saved = await rendererRuntimeClient.setSettings({ agents: { kun: { subagents: next } } })
    if (saved.agents?.kun?.subagents) setSubagents(saved.agents.kun.subagents)
  }, [subagents])

  // Built-ins may not be in settings yet — upsert so configuring one persists it for the first time.
  const upsertProfile = useCallback((id: string, patch: Partial<KunSubagentProfileV1>): void => {
    const baseline = subagents.profiles.find((p) => p.id === id) ?? BUILTIN_AGENTS.find((p) => p.id === id)
    if (!baseline) return
    const next = { ...baseline, ...patch }
    const exists = subagents.profiles.some((p) => p.id === id)
    void persistProfiles(exists ? subagents.profiles.map((p) => (p.id === id ? next : p)) : [...subagents.profiles, next])
  }, [subagents.profiles, persistProfiles])

  const setProfileModel = useCallback((id: string, model: string, providerId: string): void => {
    upsertProfile(id, {
      ...(model ? { model } : { model: undefined }),
      ...(providerId ? { providerId } : { providerId: undefined })
    })
  }, [upsertProfile])

  // Per-profile reasoning depth. 'off' is the default → store undefined so the
  // round-trip omits it (mergeKunRuntimeSettings strips 'off'/invalid).
  const setProfileReasoning = useCallback((id: string, effort: ModelReasoningEffort): void => {
    upsertProfile(id, { reasoningEffort: effort === 'off' ? undefined : effort })
  }, [upsertProfile])

  const toggleEnabled = useCallback((id: string): void => {
    const cur = subagents.profiles.find((p) => p.id === id) ?? BUILTIN_AGENTS.find((p) => p.id === id)
    upsertProfile(id, { enabled: !(cur?.enabled ?? true) })
  }, [subagents.profiles, upsertProfile])

  const removeProfile = useCallback(async (id: string): Promise<void> => {
    const p = subagents.profiles.find((x) => x.id === id)
    if (!(await confirmDialog(t('agentsView.deleteConfirm', 'Delete this agent?'), p?.name ?? id))) return
    void persistProfiles(subagents.profiles.filter((x) => x.id !== id))
  }, [subagents.profiles, persistProfiles, t])

  const saveDialog = useCallback((profile: KunSubagentProfileV1): void => {
    const exists = subagents.profiles.some((p) => p.id === profile.id)
    void persistProfiles(exists
      ? subagents.profiles.map((p) => (p.id === profile.id ? profile : p))
      : [...subagents.profiles, profile])
    setDialog(null)
  }, [subagents.profiles, persistProfiles])

  // Compaction model override is nested under contextCompaction (not a flat
  // kun.* key), so it needs its own patch. Empty string clears it → compaction
  // falls back to the main conversation model.
  const persistCompactionSlot = useCallback(async (model: string, providerId: string): Promise<void> => {
    setCompactionSlot({ model, providerId })
    await rendererRuntimeClient.setSettings({
      agents: { kun: { contextCompaction: { summaryModel: model, summaryProviderId: providerId } } }
    })
  }, [])

  // Each role slot patches its own agents.kun.* override fields. The model/
  // provider keys are typed pairs on KunRuntimeSettingsV1; empty string clears
  // them server-side (mergeKunRuntimeSettings omits blank slots).
  const persistRoleSlot = useCallback(
    async (
      apply: (s: RoleSlot) => void,
      modelKey: 'smallModel' | 'titleModel' | 'summaryModel' | 'codeReviewModel',
      providerKey: 'smallModelProviderId' | 'titleProviderId' | 'summaryProviderId' | 'codeReviewProviderId',
      model: string,
      providerId: string
    ): Promise<void> => {
      apply({ model, providerId })
      await rendererRuntimeClient.setSettings({
        agents: { kun: { [modelKey]: model, [providerKey]: providerId } }
      })
    },
    []
  )

  // Persist a role-level reasoning slot to agents.kun.*. 'off' is the default;
  // mergeKunRuntimeSettings strips 'off'/invalid, so the field round-trips clean.
  const persistRoleReasoning = useCallback(
    async (
      apply: (effort: ModelReasoningEffort) => void,
      key: 'titleReasoningEffort' | 'summaryReasoningEffort' | 'codeReviewReasoningEffort',
      effort: ModelReasoningEffort
    ): Promise<void> => {
      apply(effort)
      await rendererRuntimeClient.setSettings({ agents: { kun: { [key]: effort } } })
    },
    []
  )

  const isBuiltin = (id: string): boolean => BUILTIN_IDS.has(id)
  const delegatable = useMemo(() => {
    const builtins = BUILTIN_AGENTS.map((b) => subagents.profiles.find((p) => p.id === b.id) ?? b)
    const custom = subagents.profiles.filter((p) => !BUILTIN_IDS.has(p.id))
    return [...builtins, ...custom]
  }, [subagents.profiles])

  if (loading) {
    return (
      <div className={`flex flex-col bg-ds-sidebar ${className ?? ''}`}>
        <PanelHeader t={t} onCollapse={onCollapse} />
        <div className="flex flex-1 items-center justify-center text-sm text-ds-muted">{t('loading', 'Loading')}</div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col bg-ds-sidebar ${className ?? ''}`}>
      <PanelHeader t={t} onCollapse={onCollapse} />

      <div className="min-h-0 flex-1 overflow-y-auto py-1.5">
        <GroupLabel>{t('subagentsPanel.delegatable', 'Delegatable · usable in chat')}</GroupLabel>
        {delegatable.map((p) => {
          const builtin = isBuiltin(p.id)
          const name = builtin ? t(`subagentsPanel.role.${p.id}.name`, p.name || p.id) : p.name || p.id
          const desc = builtin
            ? t(`subagentsPanel.role.${p.id}.desc`, p.description ?? '')
            : (p.description ?? '')
          return (
            <Row key={p.id} roleId={p.id} disabled={!p.enabled} builtin={builtin} name={name} desc={desc}>
              <ModelSelect
                value={p.model ?? ''}
                providerId={p.providerId ?? ''}
                groups={composerModelGroups}
                onChange={(m, pid) => setProfileModel(p.id, m, pid)}
                reasoning={p.reasoningEffort ?? 'off'}
                onReasoningChange={(effort) => setProfileReasoning(p.id, effort)}
              />
              <RowActions
                enabled={p.enabled}
                builtin={builtin}
                t={t}
                onToggle={() => toggleEnabled(p.id)}
                onEdit={() => setDialog({ profile: { ...p }, isNew: false })}
                onDelete={() => void removeProfile(p.id)}
              />
            </Row>
          )
        })}

        <GroupLabel>{t('subagentsPanel.system', 'System · internal')}</GroupLabel>

        {/* Compaction: configurable model, defaults to the main conversation
            model when left on "follow default". No mode toggle — compaction
            always runs the model (heuristic fold is a silent fallback). */}
        <Row
          roleId="compaction"
          name={t('subagentsPanel.role.compaction.name', 'Compaction')}
          desc={t('subagentsPanel.role.compaction.desc', 'Configurable · defaults to main model')}
        >
          <ModelSelect
            value={compactionSlot.model}
            providerId={compactionSlot.providerId}
            groups={composerModelGroups}
            small
            onChange={(m, pid) => void persistCompactionSlot(m, pid)}
          />
        </Row>

        {/* Code review: configurable model. */}
        <Row
          roleId="code-review"
          name={t('subagentsPanel.role.codeReview.name', 'Code review')}
          desc={t('subagentsPanel.role.codeReview.desc', 'Isolated read-only run · configurable')}
        >
          <ModelSelect
            value={codeReviewSlot.model}
            providerId={codeReviewSlot.providerId}
            groups={composerModelGroups}
            onChange={(m, pid) => void persistRoleSlot(setCodeReviewSlot, 'codeReviewModel', 'codeReviewProviderId', m, pid)}
            reasoning={codeReviewReasoning}
            onReasoningChange={(effort) => void persistRoleReasoning(setCodeReviewReasoning, 'codeReviewReasoningEffort', effort)}
          />
        </Row>

        {/* Title: configurable model, defaults to small model. */}
        <Row
          roleId="title"
          name={t('subagentsPanel.role.title.name', 'Title')}
          desc={t('subagentsPanel.role.title.desc', 'LLM · defaults to small model')}
        >
          <ModelSelect
            value={titleSlot.model}
            providerId={titleSlot.providerId}
            groups={composerModelGroups}
            small
            onChange={(m, pid) => void persistRoleSlot(setTitleSlot, 'titleModel', 'titleProviderId', m, pid)}
            reasoning={titleReasoning}
            onReasoningChange={(effort) => void persistRoleReasoning(setTitleReasoning, 'titleReasoningEffort', effort)}
          />
        </Row>

        {/* Summary: configurable model, defaults to small model. */}
        <Row
          roleId="summary"
          name={t('subagentsPanel.role.summary.name', 'Summary')}
          desc={t('subagentsPanel.role.summary.desc', 'LLM · defaults to small model')}
        >
          <ModelSelect
            value={summarySlot.model}
            providerId={summarySlot.providerId}
            groups={composerModelGroups}
            small
            onChange={(m, pid) => void persistRoleSlot(setSummarySlot, 'summaryModel', 'summaryProviderId', m, pid)}
            reasoning={summaryReasoning}
            onReasoningChange={(effort) => void persistRoleReasoning(setSummaryReasoning, 'summaryReasoningEffort', effort)}
          />
        </Row>

        <GroupLabel>{t('subagentsPanel.global', 'Global · shared')}</GroupLabel>

        {/* Small model slot: Title & Summary default to this. */}
        <Row
          roleId="small-model"
          name={t('subagentsPanel.smallModel.name', 'Small model')}
          desc={t('subagentsPanel.smallModel.desc', 'Default for Title & Summary')}
        >
          <ModelSelect
            value={smallModel.model}
            providerId={smallModel.providerId}
            groups={composerModelGroups}
            small
            onChange={(m, pid) => void persistRoleSlot(setSmallModel, 'smallModel', 'smallModelProviderId', m, pid)}
          />
        </Row>
      </div>

      <div className="shrink-0 border-t border-ds-border px-3 py-3">
        <button
          type="button"
          onClick={() => setDialog({ profile: newProfile(), isNew: true })}
          className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-accent px-3 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-accent/90"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
          {t('subagentsPanel.newSubagent', 'New subagent')}
        </button>
      </div>

      {dialog ? (
        <ProfileDialog
          profile={dialog.profile}
          isNew={dialog.isNew}
          builtin={isBuiltin(dialog.profile.id)}
          groups={composerModelGroups}
          onSave={saveDialog}
          onCancel={() => setDialog(null)}
        />
      ) : null}
    </div>
  )
}

function PanelHeader({ t, onCollapse }: { t: TFunction<'common'>; onCollapse: () => void }): ReactElement {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-ds-border px-4 py-3.5">
      <Bot className="h-[17px] w-[17px] text-accent" strokeWidth={2} />
      <b className="text-[14px] font-semibold text-ds-heading">{t('subagents', 'Subagents')}</b>
      <span className="text-[11px] text-ds-faint">· {t('subagentsPanel.configModel', 'configure model')}</span>
      <button
        type="button"
        onClick={onCollapse}
        title={t('agentsView.cancel', 'Close')}
        aria-label={t('agentsView.cancel', 'Close')}
        className="ml-auto rounded-md p-1 text-ds-faint transition hover:bg-ds-subtle hover:text-ds-heading"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  )
}

function GroupLabel({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="px-[18px] pb-1.5 pt-3 text-[10.5px] font-semibold uppercase tracking-wide text-ds-faint">
      {children}
    </div>
  )
}

function Row({
  roleId,
  disabled = false,
  builtin = false,
  name,
  desc,
  children
}: {
  roleId: string
  disabled?: boolean
  builtin?: boolean
  name: string
  desc: string
  children: ReactNode
}): ReactElement {
  const { t } = useTranslation('common')
  return (
    <div className={`mx-2 flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition hover:bg-ds-hover/60 ${disabled ? 'opacity-60' : ''}`}>
      <span
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full"
        style={{ background: 'radial-gradient(circle at 50% 36%, #fff 0%, rgba(238,244,251,0.9) 78%)', boxShadow: 'inset 0 0 0 1px rgba(188,214,245,0.7)' }}
      >
        <AgentKun id={roleId} disabled={disabled} className="h-9 w-9" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[13.5px] font-semibold text-ds-heading">{name}</span>
          {builtin ? (
            <span
              className="shrink-0 rounded-full px-1.5 py-px text-[9.5px] font-semibold"
              style={{ backgroundColor: 'rgba(59,130,216,0.14)', color: '#3b82d8' }}
            >
              {t('subagentsPanel.builtin', '内置')}
            </span>
          ) : null}
        </div>
        {desc ? <div className="truncate text-[11px] text-ds-muted">{desc}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">{children}</div>
    </div>
  )
}

function RowActions({
  enabled,
  builtin,
  t,
  onToggle,
  onEdit,
  onDelete
}: {
  enabled: boolean
  builtin: boolean
  t: TFunction<'common'>
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}): ReactElement {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        onClick={onToggle}
        title={enabled ? t('disable', 'Disable') : t('enable', 'Enable')}
        className={`rounded p-1.5 hover:bg-ds-subtle ${enabled ? 'text-accent' : 'text-ds-faint'}`}
      >
        <Power className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onEdit}
        title={t('agentsView.edit', 'Edit')}
        className="rounded p-1.5 text-ds-muted hover:bg-ds-subtle hover:text-ds-heading"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      {builtin ? null : (
        <button
          type="button"
          onClick={onDelete}
          title={t('agentsView.delete', 'Delete')}
          className="rounded p-1.5 text-ds-muted hover:bg-ds-subtle hover:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

/**
 * Two-step model picker (mirrors the composer): trigger → pick provider → pick
 * model, with a "follow default" option. `stretch` = full-width dialog variant.
 */
function ModelSelect({
  value,
  providerId,
  groups,
  onChange,
  reasoning,
  onReasoningChange,
  disabled,
  small,
  stretch
}: {
  value: string
  providerId: string
  groups: ModelProviderModelGroup[]
  onChange: (model: string, providerId: string) => void
  reasoning?: string
  onReasoningChange?: (effort: ModelReasoningEffort) => void
  disabled?: boolean
  small?: boolean
  stretch?: boolean
}): ReactElement {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  useEffect(() => {
    if (open) setPicked(providerId || null)
  }, [open, providerId])

  const label = value || t('agentsView.followDefault', '跟随默认')
  const activeGroup = groups.find((g) => g.providerId === picked)

  // Reasoning is offered only when a concrete model is selected AND that model
  // declares a reasoning capability. Resolve the profile from the persisted
  // (value, providerId) pair — falling back to any group that lists the model.
  const reasoningEnabled = Boolean(onReasoningChange) && Boolean(value)
  const selectedGroup = providerId ? groups.find((g) => g.providerId === providerId) : undefined
  const selectedProfile = reasoningEnabled
    ? (modelProfileForModel(selectedGroup, value) ??
        groups.map((g) => modelProfileForModel(g, value)).find(Boolean))
    : undefined
  const reasoningOptions = reasoningEnabled ? reasoningOptionsForModel(selectedProfile) : []
  const currentReasoning: ModelReasoningEffort =
    reasoning && REASONING_OPTIONS.some((o) => o.id === reasoning)
      ? (reasoning as ModelReasoningEffort)
      : 'off'

  const triggerCls = stretch
    ? 'flex h-9 w-full items-center justify-between rounded-md border border-ds-border bg-[var(--ds-surface-elevated)] pl-3 pr-2.5 text-sm text-ds-heading disabled:opacity-50'
    : `flex h-8 w-[132px] items-center justify-between gap-1 rounded-[9px] border bg-[var(--ds-surface-elevated)] pl-3 pr-2 text-[12px] font-semibold disabled:opacity-50 ${
        small ? 'border-emerald-200 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-300' : 'border-ds-border text-accent'
      }`

  return (
    <div className={`relative ${stretch ? '' : 'shrink-0'}`} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={triggerCls}
        style={{ backgroundColor: 'var(--ds-surface-elevated)' }}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ds-faint" />
      </button>
      {open ? (
        <div
          style={{ backgroundColor: 'var(--ds-surface-elevated)' }}
          className={`absolute z-50 mt-1 max-h-[300px] overflow-auto rounded-xl border border-ds-border p-1 shadow-[0_12px_32px_rgba(31,45,64,0.16)] ${
            stretch ? 'left-0 w-full' : 'right-0 w-[230px]'
          }`}
        >
          {picked === null ? (
            <>
              <PickerItem active={!value} onClick={() => { onChange('', ''); setOpen(false) }}>
                {t('agentsView.followDefault', '跟随默认')}
              </PickerItem>
              {groups.map((g) => (
                <button
                  key={g.providerId}
                  type="button"
                  onClick={() => setPicked(g.providerId)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] text-ds-ink hover:bg-accent-soft"
                >
                  <span className="truncate">{g.label}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ds-faint" />
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="mb-0.5 flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium text-ds-muted hover:bg-ds-card-muted"
              >
                <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{activeGroup?.label ?? picked}</span>
              </button>
              {(activeGroup?.modelIds ?? []).map((id) => (
                <PickerItem
                  key={id}
                  active={value === id && providerId === picked}
                  onClick={() => { onChange(id, picked); setOpen(false) }}
                >
                  {id}
                </PickerItem>
              ))}
            </>
          )}
          {reasoningEnabled && reasoningOptions.length > 0 ? (
            <div className="mt-1 border-t border-ds-border px-2 pb-1 pt-2">
              <div className="mb-1.5 px-1 text-[10.5px] font-semibold uppercase tracking-wide text-ds-faint">
                {t('composerReasoning', 'Reasoning')}
              </div>
              <div className="flex flex-wrap gap-1">
                {reasoningOptions.map((opt) => {
                  const on = opt.id === currentReasoning
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onReasoningChange?.(opt.id)}
                      className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                        on
                          ? 'bg-accent-soft text-accent shadow-[inset_0_0_0_1px_var(--ds-accent)]'
                          : 'text-ds-muted hover:bg-ds-card-muted'
                      }`}
                    >
                      {t(opt.labelKey, opt.id)}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function PickerItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] hover:bg-accent-soft ${
        active ? 'font-semibold text-accent' : 'text-ds-ink'
      }`}
    >
      <Check className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-accent opacity-100' : 'opacity-0'}`} />
      <span className="truncate">{children}</span>
    </button>
  )
}

function ProfileDialog({
  profile: initial,
  isNew,
  builtin,
  groups,
  onSave,
  onCancel
}: {
  profile: KunSubagentProfileV1
  isNew: boolean
  builtin: boolean
  groups: ModelProviderModelGroup[]
  onSave: (p: KunSubagentProfileV1) => void
  onCancel: () => void
}): ReactElement {
  const { t } = useTranslation('common')
  const [d, setD] = useState<KunSubagentProfileV1>(initial)
  const [tab, setTab] = useState<'basic' | 'permissions'>('basic')
  const [catalog, setCatalog] = useState<CapabilityCatalog | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const set = <K extends keyof KunSubagentProfileV1>(k: K, v: KunSubagentProfileV1[K]): void =>
    setD((p) => ({ ...p, [k]: v }))

  // Lazily fetch the MCP/skill catalog the first time the Permissions tab opens —
  // avoids a runtime round-trip for users who only edit the basic fields.
  useEffect(() => {
    if (tab !== 'permissions' || catalog || catalogLoading) return
    setCatalogLoading(true)
    void loadCapabilityCatalog().then(setCatalog).finally(() => setCatalogLoading(false))
  }, [tab, catalog, catalogLoading])

  // Drives the "Custom" chip on the Permissions tab: readOnly, or any deny-list set.
  const customized = d.toolPolicy === 'readOnly'
    || Boolean(d.blockedTools?.length || d.blockedMcpServers?.length || d.blockedSkills?.length)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-ds-border bg-ds-main shadow-2xl">
        <div className="flex items-center gap-2 border-b border-ds-border px-4 py-3">
          <Bot className="h-4 w-4 text-ds-muted" />
          <span className="text-sm font-semibold text-ds-heading">
            {isNew ? t('subagentsPanel.newSubagent', 'New subagent') : t('agentsView.editAgent', 'Edit agent')}
          </span>
        </div>
        <div className="flex shrink-0 gap-1 border-b border-ds-border px-3 pt-2">
          <TabButton active={tab === 'basic'} onClick={() => setTab('basic')}>
            {t('agentsView.tabBasic', 'Basic')}
          </TabButton>
          <TabButton
            active={tab === 'permissions'}
            onClick={() => setTab('permissions')}
            badge={customized ? t('agentsView.permScopeCustom', 'Custom') : undefined}
          >
            {t('agentsView.tabPermissions', 'Permissions')}
          </TabButton>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {tab === 'basic' ? (
            <>
          <Field label={t('agentsView.fName', 'Name')}>
            <input
              autoFocus
              value={d.name}
              disabled={builtin}
              onChange={(e) => set('name', e.target.value)}
              className="w-full rounded-md border border-ds-border bg-[var(--ds-surface-elevated)] px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label={t('agentsView.fDesc', 'Description')}>
            <input
              value={d.description ?? ''}
              onChange={(e) => set('description', e.target.value || undefined)}
              className="w-full rounded-md border border-ds-border bg-[var(--ds-surface-elevated)] px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label={t('agentsView.fColor', 'Color')}>
            <div className="flex gap-2.5">
              {PRESET_COLORS.map((c) => {
                const selected = d.color === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set('color', c)}
                    aria-pressed={selected}
                    className="relative h-8 w-8 rounded-full transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      boxShadow: selected
                        ? `0 0 0 2px var(--ds-surface-card), 0 0 0 4px ${c}, 0 2px 6px ${c}66`
                        : `inset 0 0 0 1px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.15)`
                    }}
                  >
                    {selected && (
                      <span className="absolute inset-0 flex items-center justify-center text-white text-sm font-semibold drop-shadow">
                        ✓
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </Field>
          <Field label={t('agentsView.fMode', 'Mode')}>
            <select
              value={d.mode}
              onChange={(e) => set('mode', e.target.value as KunSubagentProfileV1['mode'])}
              className="w-full rounded-md border border-ds-border bg-[var(--ds-surface-elevated)] px-3 py-1.5 text-sm"
            >
              <option value="subagent">{t('agentsView.modeDelegate', 'delegate')}</option>
              <option value="primary">{t('agentsView.modePersona', 'persona')}</option>
              <option value="all">{t('agentsView.modeBoth', 'both')}</option>
            </select>
          </Field>
          <Field label={t('agentsView.fModel', 'Model')}>
            <ModelSelectFull
              value={d.model ?? ''}
              providerId={d.providerId ?? ''}
              groups={groups}
              onChange={(m, pid) => setD((p) => ({ ...p, model: m || undefined, providerId: pid || undefined }))}
              reasoning={d.reasoningEffort ?? 'off'}
              onReasoningChange={(effort) =>
                setD((p) => ({ ...p, reasoningEffort: effort === 'off' ? undefined : effort }))
              }
            />
          </Field>
          <Field label={t('agentsView.fSystemPrompt', 'System prompt')}>
            <textarea
              value={d.systemPrompt ?? ''}
              rows={3}
              onChange={(e) => set('systemPrompt', e.target.value || undefined)}
              className="w-full resize-none rounded-md border border-ds-border bg-[var(--ds-surface-elevated)] px-3 py-1.5 text-sm"
            />
          </Field>
            </>
          ) : (
            <PermissionsTab d={d} setD={setD} catalog={catalog} loading={catalogLoading} t={t} />
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-ds-border px-4 py-3">
          <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-ds-muted hover:text-ds-heading">
            {t('agentsView.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={() => onSave({ ...d, name: d.name.trim() || d.id })}
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90"
          >
            {isNew ? t('agentsView.create', 'Create') : t('agentsView.save', 'Save')}
          </button>
        </div>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, badge, children }: {
  active: boolean
  onClick: () => void
  badge?: string
  children: ReactNode
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] transition ${
        active ? 'border-accent text-ds-heading' : 'border-transparent text-ds-muted hover:text-ds-heading'
      }`}
    >
      {children}
      {badge ? (
        <span
          className="rounded-full px-1.5 py-px text-[9.5px] font-semibold"
          style={{ backgroundColor: 'rgba(59,130,216,0.14)', color: '#3b82d8' }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  )
}

/**
 * Permission scope editor. The preset segmented control maps to the profile's
 * deny-list fields: readOnly → toolPolicy:'readOnly'; All → inherit + cleared
 * deny-lists; Custom → inherit + per-section block-lists. Everything here only
 * REMOVES capabilities, so the child can never exceed the main agent.
 */
function PermissionsTab({ d, setD, catalog, loading, t }: {
  d: KunSubagentProfileV1
  setD: Dispatch<SetStateAction<KunSubagentProfileV1>>
  catalog: CapabilityCatalog | null
  loading: boolean
  t: TFunction<'common'>
}): ReactElement {
  const [query, setQuery] = useState('')
  const readOnly = d.toolPolicy === 'readOnly'
  const hasDeny = Boolean(d.blockedTools?.length || d.blockedMcpServers?.length || d.blockedSkills?.length)
  const scope: 'readOnly' | 'all' | 'custom' = readOnly ? 'readOnly' : hasDeny ? 'custom' : 'all'

  const setScope = (next: 'readOnly' | 'all' | 'custom'): void => {
    if (next === 'readOnly') { setD((p) => ({ ...p, toolPolicy: 'readOnly' })); return }
    if (next === 'all') {
      setD((p) => ({ ...p, toolPolicy: 'inherit', blockedTools: undefined, blockedMcpServers: undefined, blockedSkills: undefined }))
      return
    }
    setD((p) => ({ ...p, toolPolicy: 'inherit' }))
  }

  const toggle = (key: 'blockedTools' | 'blockedMcpServers' | 'blockedSkills', id: string): void => {
    setD((p) => {
      const cur = new Set(p[key] ?? [])
      if (cur.has(id)) cur.delete(id)
      else cur.add(id)
      const next = [...cur]
      return { ...p, [key]: next.length ? next : undefined }
    })
  }

  const q = query.trim().toLowerCase()
  const tools = BUILTIN_TOOL_NAMES.filter((name) => !q || name.includes(q))
  const servers = (catalog?.mcpServers ?? []).filter((s) => !q || s.id.toLowerCase().includes(q))
  const skills = (catalog?.skills ?? []).filter((s) => !q || s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))

  const toolsOn = BUILTIN_TOOL_NAMES.length - (d.blockedTools?.length ?? 0)
  const serversTotal = catalog?.mcpServers.length ?? 0
  const serversOn = serversTotal - (d.blockedMcpServers?.length ?? 0)
  const skillsTotal = catalog?.skills.length ?? 0
  const skillsBlocked = d.blockedSkills?.length ?? 0

  const SEG: Array<{ id: 'readOnly' | 'all' | 'custom'; label: string }> = [
    { id: 'readOnly', label: t('agentsView.permScopeReadOnly', 'Read-only') },
    { id: 'all', label: t('agentsView.permScopeAll', 'All') },
    { id: 'custom', label: t('agentsView.permScopeCustom', 'Custom') }
  ]

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-ds-muted">{t('agentsView.permScope', 'Capability scope')}</label>
        <div className="flex gap-1 rounded-lg bg-ds-subtle p-1">
          {SEG.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScope(s.id)}
              className={`flex-1 rounded-md px-2 py-1.5 text-[12.5px] font-medium transition ${
                scope === s.id
                  ? 'bg-[var(--ds-surface-elevated)] text-ds-heading shadow-[inset_0_0_0_1px_var(--ds-border)]'
                  : 'text-ds-muted hover:text-ds-heading'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-ds-faint">
          {scope === 'readOnly'
            ? t('agentsView.permScopeReadOnlyNote', 'Investigation only: read / grep / find / ls. No MCP or skills.')
            : scope === 'all'
              ? t('agentsView.permScopeAllNote', 'Inherits every capability the main agent has.')
              : t('agentsView.permScopeHint', 'Pick the capabilities this agent may use — never exceeds the main agent.')}
        </p>
      </div>

      {readOnly ? null : (
        <>
          <div className="flex items-center gap-2 rounded-md border border-ds-border bg-[var(--ds-surface-elevated)] px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-ds-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('agentsView.permSearch', 'Search tools / MCP / skills…')}
              className="w-full bg-transparent text-[12.5px] text-ds-heading outline-none placeholder:text-ds-faint"
            />
          </div>

          <Section
            icon={<Wrench className="h-3.5 w-3.5" />}
            title={t('agentsView.permSecTools', 'Built-in tools')}
            badge={`${toolsOn} / ${BUILTIN_TOOL_NAMES.length}`}
          >
            <div className="flex flex-wrap gap-1.5">
              {tools.map((name) => {
                const on = !d.blockedTools?.includes(name)
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggle('blockedTools', name)}
                    className={`rounded-md px-2 py-1 text-[11.5px] font-medium transition ${
                      on
                        ? 'bg-accent-soft text-accent shadow-[inset_0_0_0_1px_var(--ds-accent)]'
                        : 'text-ds-faint line-through hover:text-ds-muted'
                    }`}
                  >
                    {name}
                  </button>
                )
              })}
            </div>
          </Section>

          <Section
            icon={<Plug className="h-3.5 w-3.5" />}
            title={t('agentsView.permSecMcp', 'MCP servers')}
            badge={serversTotal ? `${serversOn} / ${serversTotal}` : undefined}
          >
            {loading ? (
              <Hint>{t('agentsView.permLoading', 'Loading capabilities…')}</Hint>
            ) : serversTotal === 0 ? (
              <Hint>{t('agentsView.permNoMcp', 'No MCP servers configured.')}</Hint>
            ) : (
              <div className="space-y-0.5">
                {servers.map((s) => (
                  <CapRow
                    key={s.id}
                    on={!d.blockedMcpServers?.includes(s.id)}
                    onToggle={() => toggle('blockedMcpServers', s.id)}
                    label={s.id}
                    meta={`${s.toolCount} ${t('agentsView.permToolsWord', 'tools')}`}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section
            icon={<Sparkles className="h-3.5 w-3.5" />}
            title={t('agentsView.permSecSkills', 'Skills')}
            badge={skillsTotal
              ? (skillsBlocked
                  ? `${t('agentsView.permScopeAll', 'All')} · ${skillsBlocked} ${t('agentsView.permBlocked', 'blocked')}`
                  : t('agentsView.permScopeAll', 'All'))
              : undefined}
          >
            {loading ? (
              <Hint>{t('agentsView.permLoading', 'Loading capabilities…')}</Hint>
            ) : skillsTotal === 0 ? (
              <Hint>{t('agentsView.permNoSkills', 'No skills discovered.')}</Hint>
            ) : (
              <>
                <p className="mb-1.5 text-[11px] text-ds-faint">{t('agentsView.permSkillsInheritNote', 'Inherits all available skills by default; block individually.')}</p>
                <div className="max-h-44 space-y-0.5 overflow-y-auto">
                  {skills.map((s) => (
                    <CapRow
                      key={s.id}
                      on={!d.blockedSkills?.includes(s.id)}
                      onToggle={() => toggle('blockedSkills', s.id)}
                      label={s.name || s.id}
                      meta={s.description}
                    />
                  ))}
                </div>
              </>
            )}
          </Section>
        </>
      )}
    </div>
  )
}

function Section({ icon, title, badge, children }: {
  icon: ReactNode
  title: string
  badge?: string
  children: ReactNode
}): ReactElement {
  return (
    <div className="rounded-lg border border-ds-border">
      <div className="flex items-center gap-2 border-b border-ds-border px-3 py-2">
        <span className="text-ds-muted">{icon}</span>
        <span className="text-[12.5px] font-medium text-ds-heading">{title}</span>
        {badge ? <span className="ml-auto rounded-full bg-ds-subtle px-2 py-px text-[10.5px] text-ds-muted">{badge}</span> : null}
      </div>
      <div className="px-3 py-2.5">{children}</div>
    </div>
  )
}

function CapRow({ on, onToggle, label, meta }: {
  on: boolean
  onToggle: () => void
  label: string
  meta?: string
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left hover:bg-ds-hover/60"
    >
      <span className={`flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition ${on ? 'justify-end bg-accent' : 'justify-start bg-ds-border'}`}>
        <span className="h-3 w-3 rounded-full bg-white" />
      </span>
      <span className={`min-w-0 flex-1 truncate text-[12.5px] ${on ? 'text-ds-heading' : 'text-ds-faint'}`}>{label}</span>
      {meta ? <span className="max-w-[45%] shrink-0 truncate pl-2 text-[10.5px] text-ds-faint">{meta}</span> : null}
    </button>
  )
}

function Hint({ children }: { children: ReactNode }): ReactElement {
  return <p className="text-[11.5px] text-ds-faint">{children}</p>
}

/** Full-width model picker for the dialog (reuses ModelSelect, stretched). */
function ModelSelectFull(props: {
  value: string
  providerId: string
  groups: ModelProviderModelGroup[]
  onChange: (model: string, providerId: string) => void
  reasoning?: string
  onReasoningChange?: (effort: ModelReasoningEffort) => void
}): ReactElement {
  return <ModelSelect {...props} stretch />
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactElement }): ReactElement {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ds-muted">{label}</label>
      {children}
      {hint ? <p className="mt-1 text-xs text-ds-faint">{hint}</p> : null}
    </div>
  )
}
