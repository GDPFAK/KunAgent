import { useMemo, useState, type ReactElement } from 'react'
import { CheckCircle2, FileText, Loader2, PackageCheck, Save, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCanvasShapeStore } from '../../design/canvas/canvas-shape-store'
import { useDesignSystemStore } from '../../design/canvas/design-system-store'
import type { DesignDocument } from '../../design/design-types'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'
import {
  buildDesignContractViewModel,
  type DesignContractDisabledReason
} from '../../design/design-contract/design-contract-view-model'
import { buildDesignProjectContractMarkdown } from '../../design/design-contract/design-project-contract'
import {
  SidebarCommandRow,
  SidebarIconButton,
  SidebarSectionHeader
} from '../sidebar/SidebarPrimitives'
import { useDesignAgentActionRunner } from './useDesignAgentActionRunner'

type Props = {
  workspaceRoot: string
  document: DesignDocument | null
  onSeedPrompt?: (prompt: string) => void
}

type ExportState =
  | { status: 'idle' }
  | { status: 'exporting' }
  | { status: 'exported'; path: string }
  | { status: 'error'; message: string }

function disabledReasonLabel(reason: DesignContractDisabledReason | undefined, t: (key: string) => string): string {
  switch (reason) {
    case 'no-workspace':
      return t('designContractNoWorkspace')
    case 'no-document':
      return t('designContractNoDocument')
    default:
      return ''
  }
}

function statusToneClass(state: ExportState): string {
  if (state.status === 'exported') return 'text-[#2e9e6b]'
  if (state.status === 'error') return 'text-[#c0392b]'
  return 'text-ds-faint'
}

function statusText(state: ExportState, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (state.status === 'exporting') return t('designContractExporting')
  if (state.status === 'exported') return t('designContractExported', { path: state.path })
  if (state.status === 'error') return state.message
  return ''
}

export function DesignContractPanel({ workspaceRoot, document, onSeedPrompt }: Props): ReactElement | null {
  const { t } = useTranslation('common')
  const canvasDocument = useCanvasShapeStore((s) => s.document)
  const designSystem = useDesignSystemStore((s) => s.system)
  const designContext = useDesignWorkspaceStore((s) => s.designContext)
  const runAgentAction = useDesignAgentActionRunner(onSeedPrompt)
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' })
  const model = useMemo(
    () =>
      buildDesignContractViewModel({
        workspaceRoot,
        document,
        canvasDocument,
        designSystem,
        designContext
      }),
    [canvasDocument, designContext, designSystem, document, workspaceRoot]
  )

  if (!model.visible) return null

  const exportDisabled = !model.canExport || exportState.status === 'exporting'
  const disabledHint = disabledReasonLabel(model.disabledReason, t)
  const status = statusText(exportState, t)

  const exportContract = async (): Promise<void> => {
    if (!model.canExport || exportState.status === 'exporting') return
    if (typeof window.kunGui?.writeWorkspaceFile !== 'function') {
      setExportState({ status: 'error', message: t('designContractUnavailable') })
      return
    }
    const workspaceState = useDesignWorkspaceStore.getState()
    const latestDocument =
      workspaceState.documents.find((item) => item.id === document?.id) ?? document
    if (!latestDocument) {
      setExportState({ status: 'error', message: t('designContractNoDocument') })
      return
    }
    setExportState({ status: 'exporting' })
    try {
      const content = buildDesignProjectContractMarkdown({
        document: latestDocument,
        canvasDocument: useCanvasShapeStore.getState().document,
        designSystem: useDesignSystemStore.getState().system,
        designContext: workspaceState.designContext,
        artifacts: latestDocument.artifacts
      })
      await window.kunGui.writeWorkspaceFile({
        path: model.path,
        workspaceRoot,
        content
      })
      setExportState({ status: 'exported', path: model.path })
    } catch (error) {
      setExportState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  return (
    <section>
      <SidebarSectionHeader
        label={t('designContractTitle')}
        actions={
          <SidebarIconButton
            onClick={() => void exportContract()}
            title={exportDisabled && disabledHint ? disabledHint : t('designContractExport')}
            ariaLabel={t('designContractExport')}
            disabled={exportDisabled}
            tone="accent"
          >
            {exportState.status === 'exporting' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.9} />
            ) : (
              <Save className="h-3.5 w-3.5" strokeWidth={1.9} />
            )}
          </SidebarIconButton>
        }
      />
      <SidebarCommandRow
        icon={<FileText className="h-4 w-4" strokeWidth={1.85} />}
        label={t('designContractPath')}
        disabled={exportDisabled}
        disabledHint={disabledHint}
        onClick={() => void exportContract()}
        trailing={<span className="shrink-0 text-[11.5px] text-ds-faint">{model.path}</span>}
      />
      <SidebarCommandRow
        icon={<PackageCheck className="h-4 w-4" strokeWidth={1.85} />}
        label={t(model.toolAction.labelKey)}
        disabled={!model.canExport}
        disabledHint={disabledHint}
        onClick={() => runAgentAction({
          intentMode: model.toolAction.intentMode,
          prompt: model.toolAction.prompt
        })}
        trailing={<span className="shrink-0 text-[11.5px] text-ds-faint">{model.toolAction.toolId}</span>}
      />
      <div className="px-2.5 pt-1 text-[11.5px] leading-5 text-ds-faint">
        {t('designContractSummary', {
          screens: model.screenCount,
          objects: model.objectCount,
          bindings: model.codeBindingCount,
          ops: model.journalEntryCount
        })}
      </div>
      {status || disabledHint ? (
        <div className={`flex items-start gap-1.5 px-2.5 pt-1 text-[11.5px] leading-5 ${statusToneClass(exportState)}`}>
          {exportState.status === 'exported' ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
          ) : exportState.status === 'error' ? (
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
          ) : null}
          <span className="min-w-0 flex-1">{status || disabledHint}</span>
        </div>
      ) : null}
    </section>
  )
}
