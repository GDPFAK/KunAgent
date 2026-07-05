import type { ReactElement } from 'react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { EditorInfo } from '@shared/editor'
import type { GuiUpdateState } from '@shared/gui-update'
import {
  ArrowUpCircle,
  Bot,
  Check,
  Code2,
  ClipboardList,
  Download,
  ExternalLink,
  FileEdit,
  Folders,
  FolderOpen,
  Globe2,
  ListTodo,
  Loader2,
  MessageCircleMore,
  RefreshCw,
  Shapes,
  Terminal
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { readPreferredEditorId, writePreferredEditorId } from '../../lib/editor-preferences'

export type RightPanelMode =
  | 'todo'
  | 'changes'
  | 'browser'
  | 'file'
  | 'plan'
  | 'sdd-ai'
  | 'canvas'
  | 'subagents'
  | null

type Props = {
  rightPanelMode: RightPanelMode
  onToggleRightPanelMode: (mode: Exclude<RightPanelMode, null>) => void
  planPanelEnabled?: boolean
  canvasEnabled?: boolean
  terminalOpen?: boolean
  onToggleTerminal?: () => void
  sideChatCount?: number
  sideChatRunningCount?: number
  sideChatOpen?: boolean
  sideChatEnabled?: boolean
  fileTreeOpen?: boolean
  fileTreeEnabled?: boolean
  onToggleFileTree?: () => void
  onOpenSideChat?: () => void
}

const TOPBAR_ICON_CLASS = 'h-4 w-4'
const SIDE_RAIL_BUTTON_BASE =
  'ds-side-rail-button inline-flex h-8 w-8 items-center justify-center rounded-[0.9rem] border shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
const SIDE_RAIL_BUTTON_ACTIVE = 'border-ds-border-strong bg-white/70 text-ds-ink dark:bg-white/10'
const SIDE_RAIL_BUTTON_IDLE =
  'border-transparent bg-white/38 text-ds-faint opacity-90 hover:border-ds-border-muted hover:bg-white/55 hover:text-ds-ink hover:opacity-100 dark:bg-white/4 dark:hover:bg-white/8'

function sideRailButtonClass(active: boolean, extra?: string): string {
  return `${SIDE_RAIL_BUTTON_BASE} ${active ? SIDE_RAIL_BUTTON_ACTIVE : SIDE_RAIL_BUTTON_IDLE}${extra ? ` ${extra}` : ''}`
}

export function WorkbenchSideRail({
  rightPanelMode,
  onToggleRightPanelMode,
  planPanelEnabled = false,
  canvasEnabled = false,
  terminalOpen = false,
  onToggleTerminal,
  sideChatCount = 0,
  sideChatRunningCount = 0,
  sideChatOpen = false,
  sideChatEnabled = true,
  fileTreeOpen = false,
  fileTreeEnabled = true,
  onToggleFileTree,
  onOpenSideChat
}: Props): ReactElement {
  const { t } = useTranslation(['common', 'settings'])
  const [editors, setEditors] = useState<EditorInfo[]>([])
  const [selectedEditorId, setSelectedEditorId] = useState(() => readPreferredEditorId() ?? '')
  const [editorMenuOpen, setEditorMenuOpen] = useState(false)
  const [failedIconIds, setFailedIconIds] = useState<Set<string>>(() => new Set())
  const [guiUpdateState, setGuiUpdateState] = useState<GuiUpdateState>({ status: 'idle' })
  const [applyingGuiUpdate, setApplyingGuiUpdate] = useState(false)
  const editorMenuRef = useRef<HTMLDivElement>(null)
  const items = [
    { mode: 'todo' as const, label: t('rightPanelTodo'), icon: ListTodo },
    ...(planPanelEnabled ? [{ mode: 'plan' as const, label: t('rightPanelPlan'), icon: ClipboardList }] : []),
    { mode: 'changes' as const, label: t('rightPanelChanges'), icon: FileEdit },
    { mode: 'browser' as const, label: t('rightPanelBrowser'), icon: Globe2 },
    ...(canvasEnabled ? [{ mode: 'canvas' as const, label: t('rightPanelWhiteboard'), icon: Shapes }] : []),
    { mode: 'subagents' as const, label: t('rightPanelSubagents'), icon: Bot }
  ]
  const selectedEditor = useMemo(
    () => editors.find((editor) => editor.id === selectedEditorId) ?? editors[0],
    [editors, selectedEditorId]
  )
  const editorButtonTitle = selectedEditor
    ? t('editorPickerTitleWithEditor', { editor: selectedEditor.label })
    : t('editorPickerTitle')

  useEffect(() => {
    let cancelled = false
    if (typeof window.kunGui?.listEditors !== 'function') return

    void window.kunGui.listEditors()
      .then((result) => {
        if (cancelled) return
        const available = result.editors.filter((editor) => editor.available)
        const stored = readPreferredEditorId()
        const nextId =
          stored && available.some((editor) => editor.id === stored)
            ? stored
            : result.defaultEditorId
        setEditors(available)
        setSelectedEditorId(nextId)
        writePreferredEditorId(nextId)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!editorMenuOpen) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (target instanceof Node && editorMenuRef.current?.contains(target)) return
      setEditorMenuOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [editorMenuOpen])

  useEffect(() => {
    if (typeof window.kunGui?.onGuiUpdateState !== 'function') return
    const applyState = (state: GuiUpdateState): void => {
      setGuiUpdateState(state)
    }
    const unsubscribe = window.kunGui.onGuiUpdateState(applyState)
    if (typeof window.kunGui?.getGuiUpdateState === 'function') {
      void window.kunGui.getGuiUpdateState().then(applyState).catch(() => undefined)
    }
    return unsubscribe
  }, [])

  const guiUpdateAction = useMemo(() => {
    if (guiUpdateState.status === 'available' || guiUpdateState.status === 'downloaded') {
      return guiUpdateState.info.hasUpdate ? guiUpdateState.info : null
    }
    if (guiUpdateState.status === 'downloading' || guiUpdateState.status === 'installing') {
      return guiUpdateState.info?.hasUpdate ? guiUpdateState.info : null
    }
    if (guiUpdateState.status === 'error' && guiUpdateState.info?.ok && guiUpdateState.info.hasUpdate) {
      return guiUpdateState.info
    }
    return null
  }, [guiUpdateState])
  const guiUpdateBusy =
    applyingGuiUpdate || guiUpdateState.status === 'downloading' || guiUpdateState.status === 'installing'
  const guiUpdateLabel = useMemo(() => {
    if (!guiUpdateAction) return ''
    if (guiUpdateState.status === 'downloading') {
      return t('guiUpdateTopbarDownloading', {
        percent: Math.max(0, Math.round(guiUpdateState.progress.percent))
      })
    }
    if (guiUpdateState.status === 'installing') {
      return t('guiUpdateTopbarInstalling')
    }
    if (guiUpdateAction.downloaded || guiUpdateState.status === 'downloaded') {
      return t('settings:guiUpdateInstall')
    }
    if (guiUpdateAction.manualOnly) {
      return t('guiUpdateTopbarManual', { version: guiUpdateAction.latestVersion })
    }
    return t('guiUpdateTopbarAvailable', { version: guiUpdateAction.latestVersion })
  }, [guiUpdateAction, guiUpdateState, t])
  const guiUpdateTitle = useMemo(() => {
    if (!guiUpdateAction) return ''
    return guiUpdateAction.manualOnly
      ? t('settings:guiUpdateAvailableManual', {
          current: guiUpdateAction.currentVersion,
          latest: guiUpdateAction.latestVersion
        })
      : t('settings:guiUpdateAvailable', {
          current: guiUpdateAction.currentVersion,
          latest: guiUpdateAction.latestVersion
        })
  }, [guiUpdateAction, t])

  const chooseEditor = (editor: EditorInfo): void => {
    setSelectedEditorId(editor.id)
    writePreferredEditorId(editor.id)
    setEditorMenuOpen(false)
  }

  const markEditorIconFailed = (editorId: string): void => {
    setFailedIconIds((prev) => {
      if (prev.has(editorId)) return prev
      const next = new Set(prev)
      next.add(editorId)
      return next
    })
  }

  const renderEditorIcon = (editor: EditorInfo | null | undefined, className: string): ReactElement => {
    const Icon =
      editor?.kind === 'terminal' ? Terminal : editor?.kind === 'viewer' ? FolderOpen : Code2

    if (editor?.iconDataUrl && !failedIconIds.has(editor.id)) {
      return (
        <img
          src={editor.iconDataUrl}
          alt=""
          aria-hidden="true"
          className={`${className} shrink-0 rounded-[4px] object-contain`}
          onError={() => markEditorIconFailed(editor.id)}
        />
      )
    }

    return <Icon className={`${className} shrink-0`} strokeWidth={1.8} />
  }

  const runGuiUpdateAction = async (): Promise<void> => {
    if (!guiUpdateAction || guiUpdateBusy) return
    if (guiUpdateAction.manualOnly) {
      if (typeof window.kunGui?.openExternal === 'function') {
        await window.kunGui.openExternal(guiUpdateAction.releaseUrl)
      }
      return
    }
    if (
      typeof window.kunGui?.downloadGuiUpdate !== 'function' ||
      typeof window.kunGui?.installGuiUpdate !== 'function'
    ) {
      return
    }

    setApplyingGuiUpdate(true)
    try {
      if (!guiUpdateAction.downloaded && guiUpdateState.status !== 'downloaded') {
        const downloadResult = await window.kunGui.downloadGuiUpdate(guiUpdateAction.channel)
        if (!downloadResult.ok) return
      }
      const installResult = await window.kunGui.installGuiUpdate()
      if (!installResult.ok && typeof window.kunGui?.logError === 'function') {
        await window.kunGui.logError('gui-update', 'Failed to install GUI update from workbench top bar', {
          version: guiUpdateAction.latestVersion,
          message: installResult.message
        })
      }
    } catch (error) {
      if (typeof window.kunGui?.logError === 'function') {
        await window.kunGui.logError('gui-update', 'Failed to apply GUI update from workbench top bar', {
          version: guiUpdateAction.latestVersion,
          message: error instanceof Error ? error.message : String(error)
        })
      }
    } finally {
      setApplyingGuiUpdate(false)
    }
  }

  const renderGuiUpdateIcon = (): ReactElement => {
    if (guiUpdateState.status === 'downloading' || guiUpdateState.status === 'installing' || applyingGuiUpdate) {
      return <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
    }
    if (guiUpdateAction?.downloaded || guiUpdateState.status === 'downloaded') {
      return <RefreshCw className="h-4 w-4" strokeWidth={1.85} />
    }
    if (guiUpdateAction?.manualOnly) {
      return <ExternalLink className="h-4 w-4" strokeWidth={1.85} />
    }
    if (guiUpdateAction) {
      return <ArrowUpCircle className="h-4 w-4" strokeWidth={1.85} />
    }
    return <Download className="h-4 w-4" strokeWidth={1.85} />
  }

  return (
    <div className="ds-no-drag flex h-full w-12 shrink-0 flex-col items-center gap-1.5 border-l border-ds-border-muted bg-white/80 py-3 backdrop-blur-xl dark:bg-ds-canvas">
      {guiUpdateAction ? (
        <button
          type="button"
          onClick={() => void runGuiUpdateAction()}
          disabled={guiUpdateBusy}
          className="ds-side-rail-button relative inline-flex h-8 w-8 items-center justify-center rounded-[0.9rem] border border-amber-300/75 bg-amber-50/92 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-700/70 dark:bg-amber-950/35 dark:text-amber-100 dark:hover:bg-amber-900/45"
          data-tooltip={guiUpdateBusy ? guiUpdateLabel : guiUpdateTitle}
          aria-label={guiUpdateBusy ? guiUpdateLabel : guiUpdateTitle}
          title={guiUpdateBusy ? guiUpdateLabel : guiUpdateTitle}
        >
          {renderGuiUpdateIcon()}
          {!guiUpdateBusy ? (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_0_2px_rgba(245,158,11,0.18)]" />
          ) : null}
        </button>
      ) : null}

      <div ref={editorMenuRef} className="relative">
        <button
          type="button"
          onClick={() => setEditorMenuOpen((value) => !value)}
          className={sideRailButtonClass(false)}
          data-tooltip={editorButtonTitle}
          aria-label={t('editorPickerTitle')}
          aria-expanded={editorMenuOpen}
          title={editorButtonTitle}
        >
          {renderEditorIcon(selectedEditor, 'h-4 w-4')}
        </button>

        {editorMenuOpen ? (
          <div className="ds-card-strong absolute right-full top-0 z-50 mr-2 w-64 overflow-hidden rounded-[18px] border border-ds-border py-1.5 shadow-[0_18px_52px_rgba(20,47,95,0.18)] backdrop-blur-xl dark:shadow-[0_22px_58px_rgba(0,0,0,0.38)]">
            <div className="border-b border-ds-border-muted px-3 pb-2 pt-1.5 text-[11px] font-semibold text-ds-faint">
              {t('editorPickerMenuTitle')}
            </div>
            {editors.map((editor) => {
              const active = editor.id === selectedEditor?.id
              return (
                <button
                  key={editor.id}
                  type="button"
                  onClick={() => chooseEditor(editor)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-[14px] transition ${
                    active
                      ? 'bg-ds-hover text-ds-ink'
                      : 'text-ds-muted hover:bg-ds-hover/70 hover:text-ds-ink'
                  }`}
                >
                  {renderEditorIcon(editor, 'h-4 w-4')}
                  <span className="min-w-0 flex-1 truncate">{editor.label}</span>
                  {editor.supportsLine ? (
                    <span className="shrink-0 rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                      {t('editorLineBadge')}
                    </span>
                  ) : null}
                  {active ? <Check className="h-4 w-4 shrink-0 text-accent" strokeWidth={2} /> : null}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      {onOpenSideChat ? (
        <button
          type="button"
          onClick={onOpenSideChat}
          disabled={!sideChatEnabled}
          className={sideRailButtonClass(sideChatOpen, 'relative disabled:cursor-not-allowed disabled:opacity-45')}
          data-tooltip={t('sidePanelOpen')}
          aria-label={t('sidePanelOpen')}
          aria-pressed={sideChatOpen}
          title={t('sidePanelOpen')}
        >
          <MessageCircleMore className={TOPBAR_ICON_CLASS} strokeWidth={1.75} />
          {sideChatCount > 0 ? (
            <span className="absolute -left-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-white">
              {Math.min(sideChatCount, 9)}
            </span>
          ) : null}
          {sideChatRunningCount > 0 ? (
            <span className="absolute -bottom-0.5 -left-0.5 h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.18)]" />
          ) : null}
        </button>
      ) : null}

      {items.map((item) => {
        const active = rightPanelMode === item.mode
        const Icon = item.icon
        const isChanges = item.mode === 'changes'
        return (
          <Fragment key={item.mode}>
            <button
              type="button"
              onClick={() => onToggleRightPanelMode(item.mode)}
              className={sideRailButtonClass(active)}
              data-tooltip={item.label}
              aria-label={item.label}
              aria-pressed={active}
              title={item.label}
            >
              <Icon className={TOPBAR_ICON_CLASS} strokeWidth={1.75} />
            </button>
            {isChanges && onToggleTerminal ? (
              <button
                type="button"
                onClick={onToggleTerminal}
                className={sideRailButtonClass(terminalOpen)}
                data-tooltip={t('rightPanelTerminal')}
                aria-label={t('rightPanelTerminal')}
                aria-pressed={terminalOpen}
                title={t('rightPanelTerminal')}
              >
                <Terminal className={TOPBAR_ICON_CLASS} strokeWidth={1.75} />
              </button>
            ) : null}
          </Fragment>
        )
      })}

      {onToggleFileTree ? (
        <button
          type="button"
          onClick={onToggleFileTree}
          disabled={!fileTreeEnabled}
          className={sideRailButtonClass(fileTreeOpen, 'disabled:cursor-not-allowed disabled:opacity-45')}
          data-tooltip={t('rightPanelFiles')}
          aria-label={t('rightPanelFiles')}
          aria-pressed={fileTreeOpen}
          title={t('rightPanelFiles')}
        >
          <Folders className={TOPBAR_ICON_CLASS} strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  )
}
