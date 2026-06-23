import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, Check, ChevronDown, GitBranch, Loader2, Plus, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { GitBranchesResult } from '@shared/git-branches'
import { getProvider } from '../../agent/registry'
import { middleEllipsize } from '../../lib/middle-ellipsize'
import { markThreadWorktree, saveThreadWorktreeRegistry } from '../../lib/thread-worktree-registry'
import { useChatStore } from '../../store/chat-store'
import { rememberCodeWorkspaceRoots } from '../../store/chat-store-helpers'

const BRANCH_ROW_LABEL_MAX_LENGTH = 42
const BRANCH_TRIGGER_LABEL_MAX_LENGTH = 32
const BRANCH_FOOTER_LABEL_MAX_LENGTH = 34

type Props = {
  workspaceRoot: string
}

type BranchTooltip = {
  text: string
  x: number
  y: number
}

function branchTooltipPosition(clientX: number, clientY: number): { x: number; y: number } {
  const width = Math.min(544, Math.max(0, window.innerWidth - 32))
  const x = Math.max(16, Math.min(clientX + 12, window.innerWidth - width - 16))
  const y = Math.max(16, Math.min(clientY + 14, window.innerHeight - 96))
  return { x, y }
}

export function GitBranchPicker({ workspaceRoot }: Props): ReactElement | null {
  const { t } = useTranslation('common')
  const root = workspaceRoot.trim()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<GitBranchesResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [actingBranch, setActingBranch] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<BranchTooltip | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const load = useCallback(async (): Promise<void> => {
    if (!root || typeof window.kunGui?.getGitBranches !== 'function') return
    setLoading(true)
    setError(null)
    try {
      const next = await window.kunGui.getGitBranches(root)
      setResult(next)
      if (!next.ok) setError(next.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [root])

  useEffect(() => {
    setOpen(false)
    setQuery('')
    setResult(null)
    setError(null)
    setActingBranch(null)
  }, [root])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!open) return
    void load()
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [load, open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (target instanceof Node && wrapRef.current?.contains(target)) return
      setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (!open) setTooltip(null)
  }, [open])

  const branches = useMemo(() => (result?.ok ? result.branches : []), [result])
  const filteredBranches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return branches
    return branches.filter((branch) => branch.name.toLowerCase().includes(q))
  }, [branches, query])

  const trimmedQuery = query.trim()
  const exactBranchExists = branches.some((branch) => branch.name === trimmedQuery)
  const selectedWorktreeBranch = trimmedQuery
    ? exactBranchExists
      ? trimmedQuery
      : ''
    : result?.ok
      ? result.currentBranch ?? ''
      : ''
  const canCreate = trimmedQuery.length > 0 && !exactBranchExists
  const canCheckoutWorktree = selectedWorktreeBranch.length > 0
  const canRunFooterAction = canCreate || canCheckoutWorktree
  const currentBranch = result?.ok ? result.currentBranch : null
  const label = currentBranch || (result?.ok ? t('gitDetached') : t('gitBranchUnavailable'))
  const footerBranch = canCreate ? trimmedQuery : selectedWorktreeBranch
  const footerBranchLabel = middleEllipsize(footerBranch, BRANCH_FOOTER_LABEL_MAX_LENGTH)
  const footerActionLabel = canCreate
    ? t('gitCreateNamedBranch', { branch: footerBranchLabel })
    : selectedWorktreeBranch
      ? t('gitCheckoutNamedBranchWorktree', { branch: footerBranchLabel })
      : t('gitCreateBranch')
  const footerActionTitle = canCreate
    ? t('gitCreateNamedBranch', { branch: trimmedQuery })
    : selectedWorktreeBranch
      ? t('gitCheckoutNamedBranchWorktree', { branch: selectedWorktreeBranch })
      : t('gitCreateBranch')
  const showTooltip = useCallback((text: string, clientX: number, clientY: number): void => {
    if (!text.trim()) return
    setTooltip({ text, ...branchTooltipPosition(clientX, clientY) })
  }, [])
  const moveTooltip = useCallback((clientX: number, clientY: number): void => {
    setTooltip((current) => current ? { ...current, ...branchTooltipPosition(clientX, clientY) } : current)
  }, [])
  const hideTooltip = useCallback((): void => {
    setTooltip(null)
  }, [])

  const moveActiveThreadToWorktree = async (record: {
    projectPath: string
    worktreePath: string
    branch: string
  }): Promise<void> => {
    const activeThreadId = useChatStore.getState().activeThreadId
    if (!activeThreadId) return
    const provider = getProvider()
    if (typeof provider.updateThreadWorkspace === 'function') {
      await provider.updateThreadWorkspace(activeThreadId, record.worktreePath)
    }
    saveThreadWorktreeRegistry(
      markThreadWorktree(activeThreadId, {
        projectPath: record.projectPath,
        worktreePath: record.worktreePath,
        branch: record.branch,
        createdAt: new Date().toISOString()
      })
    )
    useChatStore.setState((state) => ({
      codeWorkspaceRoots: rememberCodeWorkspaceRoots(state.codeWorkspaceRoots, [record.worktreePath]),
      threads: state.threads.map((thread) =>
        thread.id === activeThreadId ? { ...thread, workspace: record.worktreePath } : thread
      )
    }))
  }

  const checkoutBranchWorktree = async (branch: string): Promise<void> => {
    if (!root || !branch) return
    setActingBranch(branch)
    setError(null)
    try {
      const next = await window.kunGui.checkoutGitBranchWorktree(root, branch)
      setResult(next)
      if (!next.ok) {
        setError(next.message)
        return
      }
      await moveActiveThreadToWorktree({
        projectPath: next.sourceRepositoryRoot,
        worktreePath: next.worktreePath,
        branch: next.currentBranch ?? branch
      })
      setOpen(false)
      setQuery('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActingBranch(null)
    }
  }

  const createBranch = async (): Promise<void> => {
    const branch = query.trim()
    if (!root || !branch) return
    setActingBranch(branch)
    setError(null)
    try {
      const next = await window.kunGui.createGitBranchWorktree(root, branch)
      setResult(next)
      if (!next.ok) {
        setError(next.message)
        return
      }
      await moveActiveThreadToWorktree({
        projectPath: next.sourceRepositoryRoot,
        worktreePath: next.worktreePath,
        branch: next.currentBranch ?? branch
      })
      setOpen(false)
      setQuery('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActingBranch(null)
    }
  }

  if (!root) return null

  return (
    <div ref={wrapRef} className="ds-git-branch-picker ds-no-drag relative min-w-0">
      <button
        type="button"
        className="flex h-8 max-w-[320px] min-w-0 items-center gap-2 rounded-lg px-2 text-[14px] font-medium text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
      >
        <GitBranch className="h-4 w-4 shrink-0" strokeWidth={1.8} />
        <span className="min-w-0 truncate">{middleEllipsize(label, BRANCH_TRIGGER_LABEL_MAX_LENGTH)}</span>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-ds-faint" strokeWidth={2} />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ds-faint" strokeWidth={2} />
        )}
      </button>

      {open ? (
        <div className="absolute bottom-[calc(100%+8px)] left-0 z-50 w-[min(420px,calc(100vw-48px))] overflow-hidden rounded-xl border border-ds-border bg-ds-elevated shadow-[0_24px_70px_rgba(44,55,78,0.18)] backdrop-blur-xl dark:shadow-[0_30px_80px_rgba(0,0,0,0.42)]">
          <div className="flex items-center gap-2 border-b border-ds-border-muted px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-ds-faint" strokeWidth={1.8} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setOpen(false)
                }
                if (e.key === 'Enter' && canRunFooterAction) {
                  e.preventDefault()
                  if (canCreate) {
                    void createBranch()
                  } else {
                    void checkoutBranchWorktree(selectedWorktreeBranch)
                  }
                }
              }}
              placeholder={t('gitSearchBranches')}
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ds-ink outline-none placeholder:text-ds-faint"
            />
          </div>

          <div className="max-h-[320px] overflow-y-auto px-3 py-3">
            <div className="mb-2 px-1 text-[13px] font-medium text-ds-faint">
              {t('gitBranches')}
            </div>

            {loading && !result ? (
              <div className="flex items-center gap-2 px-1 py-3 text-[13px] text-ds-muted">
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                {t('gitBranchLoading')}
              </div>
            ) : null}

            {error ? (
              <div className="mb-2 flex gap-2 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/35 dark:text-amber-100">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                <span className="min-w-0 break-words">{error}</span>
              </div>
            ) : null}

            {filteredBranches.map((branch) => (
              <button
                key={branch.name}
                type="button"
                className="flex w-full items-start gap-3 rounded-lg px-1 py-2.5 text-left text-ds-ink transition hover:bg-ds-hover"
                onClick={() => void checkoutBranchWorktree(branch.name)}
                disabled={actingBranch != null}
                aria-label={branch.name}
                onPointerEnter={(event) => showTooltip(branch.name, event.clientX, event.clientY)}
                onPointerMove={(event) => moveTooltip(event.clientX, event.clientY)}
                onPointerLeave={hideTooltip}
                onPointerCancel={hideTooltip}
              >
                <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-ds-faint" strokeWidth={1.8} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">
                    {middleEllipsize(branch.name, BRANCH_ROW_LABEL_MAX_LENGTH)}
                  </span>
                  {branch.current && result?.ok && result.dirtyCount > 0 ? (
                    <span className="mt-0.5 block text-[12px] text-ds-faint">
                      {t('gitDirtyFiles', { count: result.dirtyCount })}
                    </span>
                  ) : null}
                </span>
                {actingBranch === branch.name ? (
                  <Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin text-ds-muted" strokeWidth={2} />
                ) : branch.current ? (
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-ds-muted" strokeWidth={2} />
                ) : null}
              </button>
            ))}

            {!loading && result?.ok && filteredBranches.length === 0 ? (
              <div className="px-1 py-3 text-[13px] text-ds-faint">{t('gitNoBranches')}</div>
            ) : null}
          </div>

          <div className="border-t border-ds-border-muted px-3 py-3">
            <button
              type="button"
              disabled={!canRunFooterAction || actingBranch != null}
              className="flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left text-[14px] font-medium text-ds-ink transition hover:bg-ds-hover disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
              aria-label={footerActionTitle}
              onPointerEnter={(event) => showTooltip(footerActionTitle, event.clientX, event.clientY)}
              onPointerMove={(event) => moveTooltip(event.clientX, event.clientY)}
              onPointerLeave={hideTooltip}
              onPointerCancel={hideTooltip}
              onClick={() => {
                hideTooltip()
                if (canCreate) {
                  void createBranch()
                } else {
                  void checkoutBranchWorktree(selectedWorktreeBranch)
                }
              }}
            >
              {actingBranch === (canCreate ? trimmedQuery : selectedWorktreeBranch) ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ds-muted" strokeWidth={2} />
              ) : (
                <Plus className="h-4 w-4 shrink-0 text-ds-muted" strokeWidth={1.9} />
              )}
              <span className="min-w-0 truncate">
                {footerActionLabel}
              </span>
            </button>
          </div>
        </div>
      ) : null}
      {tooltip ? createPortal(
        <div
          className="pointer-events-none fixed z-[9999] max-w-[min(34rem,calc(100vw-2rem))] break-all rounded-lg border border-ds-border bg-ds-elevated px-2.5 py-1.5 text-[12px] font-medium leading-5 text-ds-ink shadow-[0_14px_36px_rgba(15,23,42,0.22)]"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>,
        document.body
      ) : null}
    </div>
  )
}
