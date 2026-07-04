import { useMemo, type ReactElement } from 'react'
import { CheckCircle2, History, LocateFixed, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCanvasSelectionStore } from '../../design/canvas/canvas-selection-store'
import { useCanvasShapeStore } from '../../design/canvas/canvas-shape-store'
import { shapeBounds, type CanvasDocument } from '../../design/canvas/canvas-types'
import { useCanvasViewportStore } from '../../design/canvas/canvas-viewport-store'
import {
  buildDesignOperationJournalPanelModel,
  type DesignOperationJournalPanelItem
} from '../../design/operation-journal/design-operation-journal-panel'
import { SidebarIconButton, SidebarSectionHeader, SidebarTreeRow } from '../sidebar/SidebarPrimitives'

type Props = {
  canvasDocument?: CanvasDocument
  selectedIds?: ReadonlySet<string>
}

function statusClass(item: DesignOperationJournalPanelItem): string {
  if (item.status === 'applied' && item.errorCount === 0) return 'text-[#2e9e6b]'
  return 'text-[#c98a3a]'
}

function focusAffected(ids: readonly string[]): void {
  const doc = useCanvasShapeStore.getState().document
  const shapes = ids.map((id) => doc.objects[id]).filter(Boolean)
  if (shapes.length === 0) return
  useCanvasSelectionStore.getState().select(shapes.map((shape) => shape.id))
  useCanvasViewportStore.getState().setActiveTool('select')
  useCanvasViewportStore.getState().zoomToFit(shapeBounds(shapes[0]), 72, { maxZoom: 1, minZoom: 0.18 })
}

function operationSummary(item: DesignOperationJournalPanelItem): string {
  const types = item.operationTypes.slice(0, 3).join(', ')
  return types || `${item.operationCount} operation(s)`
}

function affectedSummary(item: DesignOperationJournalPanelItem, t: (key: string, values?: Record<string, unknown>) => string): string {
  if (item.affectedNames.length > 0) return item.affectedNames.join(', ')
  if (item.affectedIds.length > 0) return t('designOperationJournalAffected', { count: item.affectedIds.length })
  return t('designOperationJournalNoAffected')
}

function JournalRow({ item }: { item: DesignOperationJournalPanelItem }): ReactElement {
  const { t } = useTranslation('common')
  const hasAffected = item.affectedIds.length > 0
  const StatusIcon = item.status === 'applied' && item.errorCount === 0 ? CheckCircle2 : TriangleAlert
  return (
    <li>
      <SidebarTreeRow
        active={item.active}
        title={item.label}
        onClick={() => focusAffected(item.affectedIds)}
        disabled={!hasAffected}
        className="min-h-[42px]"
        buttonClassName="items-start gap-2 px-2.5 py-2"
        trailing={<StatusIcon className={`h-3.5 w-3.5 ${statusClass(item)}`} strokeWidth={1.9} />}
        actions={
          <SidebarIconButton
            title={t('designOperationJournalFocus')}
            ariaLabel={t('designOperationJournalFocus')}
            disabled={!hasAffected}
            onClick={() => focusAffected(item.affectedIds)}
            stopPropagation
          >
            <LocateFixed className="h-3.5 w-3.5" strokeWidth={1.9} />
          </SidebarIconButton>
        }
      >
        <History className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${statusClass(item)}`} strokeWidth={1.9} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px]">{item.label}</span>
          <span className="mt-0.5 block truncate text-[10.5px] text-ds-faint">
            {operationSummary(item)}
          </span>
          <span className="mt-0.5 block truncate text-[10.5px] text-ds-faint">
            {affectedSummary(item, t)}
          </span>
        </span>
      </SidebarTreeRow>
    </li>
  )
}

export function DesignOperationJournalPanel({ canvasDocument, selectedIds: providedSelectedIds }: Props): ReactElement | null {
  const { t } = useTranslation('common')
  const storeDoc = useCanvasShapeStore((s) => s.document)
  const storeSelectedIds = useCanvasSelectionStore((s) => s.selectedIds)
  const doc = canvasDocument ?? storeDoc
  const selectedIds = providedSelectedIds ?? storeSelectedIds
  const model = useMemo(
    () => buildDesignOperationJournalPanelModel({ doc, selectedIds }),
    [doc, selectedIds]
  )
  if (model.totalCount === 0) return null

  return (
    <section>
      <SidebarSectionHeader label={t('designOperationJournalTitle')} />
      <ul className="space-y-1">
        {model.items.map((item) => (
          <JournalRow key={item.id} item={item} />
        ))}
      </ul>
      <div className="px-2.5 pt-1 text-[11.5px] leading-5 text-ds-faint">
        {t('designOperationJournalSummary', {
          total: model.totalCount,
          applied: model.appliedCount,
          partial: model.partialCount
        })}
      </div>
    </section>
  )
}
