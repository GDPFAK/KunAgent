import { useMemo, useState, type ReactElement } from 'react'
import { Cable, CheckCircle2, Code2, Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCanvasShapeStore } from '../../design/canvas/canvas-shape-store'
import type { CanvasDocument } from '../../design/canvas/canvas-types'
import {
  applyLatestDesignCodeChangesToWorkspace,
  type ApplyLatestDesignCodeChangesResult
} from '../../design/code-binding/design-code-sync'
import {
  buildDesignCodeSyncViewModel,
  type DesignCodeSyncDisabledReason
} from '../../design/code-binding/design-code-sync-view-model'
import {
  SidebarCommandRow,
  SidebarIconButton,
  SidebarSectionHeader
} from '../sidebar/SidebarPrimitives'
import { useDesignAgentActionRunner } from './useDesignAgentActionRunner'

type Props = {
  workspaceRoot: string
  onSeedPrompt?: (prompt: string) => void
  canvasDocument?: CanvasDocument
}

type ApplyState =
  | { status: 'idle' }
  | { status: 'applying' }
  | { status: 'applied'; writtenCount: number; skippedCount: number }
  | { status: 'error'; message: string }

function disabledReasonLabel(reason: DesignCodeSyncDisabledReason | undefined, t: (key: string) => string): string {
  switch (reason) {
    case 'no-workspace':
      return t('designCodeSyncNoWorkspace')
    case 'no-journal':
      return t('designCodeSyncNoJournal')
    case 'no-active-bindings':
      return t('designCodeSyncNoActiveBindings')
    case 'no-requests':
      return t('designCodeSyncNoRequests')
    default:
      return ''
  }
}

function statusToneClass(state: ApplyState): string {
  if (state.status === 'applied') return 'text-[#2e9e6b]'
  if (state.status === 'error') return 'text-[#c0392b]'
  return 'text-ds-faint'
}

function statusText(state: ApplyState, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (state.status === 'applying') return t('designCodeSyncApplying')
  if (state.status === 'applied') {
    return t('designCodeSyncApplied', {
      files: state.writtenCount,
      skipped: state.skippedCount
    })
  }
  if (state.status === 'error') return state.message
  return ''
}

export function DesignCodeSyncPanel({ workspaceRoot, onSeedPrompt, canvasDocument }: Props): ReactElement | null {
  const { t } = useTranslation('common')
  const storeDocument = useCanvasShapeStore((s) => s.document)
  const document = canvasDocument ?? storeDocument
  const runAgentAction = useDesignAgentActionRunner(onSeedPrompt)
  const model = useMemo(
    () => buildDesignCodeSyncViewModel({ doc: document, workspaceRoot }),
    [document, workspaceRoot]
  )
  const [applyState, setApplyState] = useState<ApplyState>({ status: 'idle' })

  if (!model.visible) return null

  const applyDisabled = !model.canApply || applyState.status === 'applying'
  const disabledHint = disabledReasonLabel(model.disabledReason, t)
  const status = statusText(applyState, t)

  const applyLatest = async (): Promise<void> => {
    if (!model.canApply || applyState.status === 'applying') return
    if (
      typeof window.kunGui?.readWorkspaceFile !== 'function' ||
      typeof window.kunGui?.writeWorkspaceFile !== 'function'
    ) {
      setApplyState({ status: 'error', message: t('designCodeSyncUnavailable') })
      return
    }
    setApplyState({ status: 'applying' })
    let next: ApplyLatestDesignCodeChangesResult
    try {
      next = await applyLatestDesignCodeChangesToWorkspace({
        workspaceRoot,
        document: useCanvasShapeStore.getState().document,
        adapter: {
          readWorkspaceFile: window.kunGui.readWorkspaceFile,
          writeWorkspaceFile: window.kunGui.writeWorkspaceFile
        }
      })
    } catch (error) {
      setApplyState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
      return
    }
    setApplyState({
      status: 'applied',
      writtenCount: next.result.written.length,
      skippedCount: next.result.skipped.length
    })
  }

  return (
    <section>
      <SidebarSectionHeader
        label={t('designCodeSyncTitle')}
        actions={
          <SidebarIconButton
            onClick={() => void applyLatest()}
            title={applyDisabled && disabledHint ? disabledHint : t('designCodeSyncApply')}
            ariaLabel={t('designCodeSyncApply')}
            disabled={applyDisabled}
            tone="accent"
          >
            {applyState.status === 'applying' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.9} />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.9} />
            )}
          </SidebarIconButton>
        }
      />
      <SidebarCommandRow
        icon={<Code2 className="h-4 w-4" strokeWidth={1.85} />}
        label={model.journalLabel ?? t('designCodeSyncLatest')}
        disabled={applyDisabled}
        disabledHint={disabledHint}
        onClick={() => void applyLatest()}
        trailing={
          <span className="shrink-0 text-[11.5px] text-ds-faint">
            {t('designCodeSyncRequests', { count: model.requestCount })}
          </span>
        }
      />
      <SidebarCommandRow
        icon={<Cable className="h-4 w-4" strokeWidth={1.85} />}
        label={t(model.toolAction.labelKey)}
        disabled={!workspaceRoot}
        disabledHint={!workspaceRoot ? disabledHint : ''}
        onClick={() => runAgentAction({
          intentMode: model.toolAction.intentMode,
          prompt: model.toolAction.prompt
        })}
        trailing={<span className="shrink-0 text-[11.5px] text-ds-faint">{model.toolAction.toolId}</span>}
      />
      <div className="px-2.5 pt-1 text-[11.5px] leading-5 text-ds-faint">
        <span>{t('designCodeSyncBindings', {
          active: model.activeBindingCount,
          total: model.bindingCount
        })}</span>
        {model.runningAppFrameCount > 0 ? (
          <span className="ml-1">
            {t('designCodeSyncRunningApps', { count: model.runningAppFrameCount })}
          </span>
        ) : null}
        {model.liveBindingCandidateCount > 0 ? (
          <span className="ml-1">
            {t('designCodeSyncLiveCandidates', { count: model.liveBindingCandidateCount })}
          </span>
        ) : null}
        {model.staleBindingCount > 0 || model.missingBindingCount > 0 ? (
          <span className="ml-1 text-[#c98a3a]">
            {t('designCodeSyncStale', {
              stale: model.staleBindingCount,
              missing: model.missingBindingCount
            })}
          </span>
        ) : null}
      </div>
      {status || disabledHint ? (
        <div className={`flex items-start gap-1.5 px-2.5 pt-1 text-[11.5px] leading-5 ${statusToneClass(applyState)}`}>
          {applyState.status === 'applied' ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
          ) : applyState.status === 'error' ? (
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
          ) : null}
          <span className="min-w-0 flex-1">{status || disabledHint}</span>
        </div>
      ) : null}
    </section>
  )
}
