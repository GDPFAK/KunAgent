import { useMemo, useState, type ComponentType, type ReactElement } from 'react'
import { ClipboardList, FileArchive, Play, ShieldCheck, TriangleAlert, Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCanvasSelectionStore } from '../../design/canvas/canvas-selection-store'
import { useCanvasShapeStore } from '../../design/canvas/canvas-shape-store'
import type { CanvasDocument } from '../../design/canvas/canvas-types'
import { useDesignSystemStore } from '../../design/canvas/design-system-store'
import type { DesignSystem } from '../../design/canvas/design-system-types'
import {
  buildDesignToolRunPanelModel,
  runDesignToolPanelAction,
  type DesignToolRunAction
} from '../../design/design-tools/design-tool-run-panel'
import type { DesignToolInvocationResult } from '../../design/tool-protocol/design-tool-protocol'
import { SidebarIconButton, SidebarSectionHeader, SidebarTreeRow } from '../sidebar/SidebarPrimitives'

type Props = {
  title?: string
  canvasDocument?: CanvasDocument
  designSystem?: DesignSystem
  selectedIds?: ReadonlySet<string>
}

const ACTION_ICONS: Record<
  DesignToolRunAction['id'],
  ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  'plan-next': ClipboardList,
  'critique-current': TriangleAlert,
  'repair-current': Wrench,
  'validate-system': ShieldCheck,
  'export-package': FileArchive
}

function resultTone(result: DesignToolInvocationResult | null): string {
  if (!result) return 'text-ds-faint'
  if (result.ok) return 'text-[#2e9e6b]'
  if (result.status === 'partial') return 'text-[#c98a3a]'
  return 'text-[#c0392b]'
}

function DesignToolActionRow({
  action,
  onRun
}: {
  action: DesignToolRunAction
  onRun: (action: DesignToolRunAction) => void
}): ReactElement {
  const { t } = useTranslation('common')
  const Icon = ACTION_ICONS[action.id]
  const disabled = Boolean(action.disabledReasonKey)
  const detail = disabled ? t(action.disabledReasonKey ?? '') : t(action.detailKey)
  return (
    <li>
      <SidebarTreeRow
        disabled={disabled}
        title={disabled ? detail : t(action.labelKey)}
        onClick={() => onRun(action)}
        className={`min-h-[38px] ${disabled ? 'opacity-55' : ''}`}
        buttonClassName="items-start gap-2 px-2.5 py-2"
        actions={
          <SidebarIconButton
            title={t('designToolsRun')}
            ariaLabel={t('designToolsRun')}
            disabled={disabled}
            onClick={() => onRun(action)}
            stopPropagation
          >
            <Play className="h-3.5 w-3.5" strokeWidth={1.9} />
          </SidebarIconButton>
        }
      >
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ds-muted" strokeWidth={1.9} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px]">{t(action.labelKey)}</span>
          <span className="mt-0.5 block truncate text-[10.5px] text-ds-faint">{detail}</span>
          <span className="mt-0.5 block truncate text-[10.5px] text-ds-faint">{action.toolId}</span>
        </span>
      </SidebarTreeRow>
    </li>
  )
}

function resultText(result: DesignToolInvocationResult | null): string[] {
  if (!result) return []
  const error = result.errors[0]
  return [
    ...result.summaryLines.slice(0, 4),
    ...(error ? [`${error.code}: ${error.message}`] : [])
  ]
}

export function DesignToolRunsPanel({
  title,
  canvasDocument,
  designSystem,
  selectedIds: providedSelectedIds
}: Props): ReactElement {
  const { t } = useTranslation('common')
  const storeDoc = useCanvasShapeStore((s) => s.document)
  const storeSystem = useDesignSystemStore((s) => s.system)
  const storeSelectedIds = useCanvasSelectionStore((s) => s.selectedIds)
  const [lastResult, setLastResult] = useState<DesignToolInvocationResult | null>(null)
  const doc = canvasDocument ?? storeDoc
  const system = designSystem ?? storeSystem
  const selectedIds = providedSelectedIds ?? storeSelectedIds
  const model = useMemo(
    () => buildDesignToolRunPanelModel({ doc, designSystem: system, selectedIds, title }),
    [doc, selectedIds, system, title]
  )

  const runAction = (action: DesignToolRunAction): void => {
    if (action.disabledReasonKey) return
    setLastResult(runDesignToolPanelAction(action))
  }
  const lines = resultText(lastResult)

  return (
    <section>
      <SidebarSectionHeader label={t('designToolsTitle')} />
      <ul className="space-y-1">
        {model.actions.map((action) => (
          <DesignToolActionRow key={action.id} action={action} onRun={runAction} />
        ))}
      </ul>
      <div className="px-2.5 pt-1 text-[11.5px] leading-5 text-ds-faint">
        {t('designToolsSummary', {
          objects: model.objectCount,
          selected: model.selectedCount,
          findings: model.lintFindingCount,
          notes: model.unresolvedNoteCount,
          ops: model.journalEntryCount
        })}
      </div>
      {lastResult ? (
        <div className={`px-2.5 pt-1 text-[11.5px] leading-5 ${resultTone(lastResult)}`}>
          <div className="truncate font-medium">
            {t('designToolsLastRun', { tool: lastResult.toolId, status: lastResult.status })}
          </div>
          {lines.map((line) => (
            <div key={line} className="truncate">{line}</div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
