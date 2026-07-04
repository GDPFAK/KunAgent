import { useMemo, type ReactElement } from 'react'
import { CheckCircle2, LocateFixed, MessageSquareText, TriangleAlert, Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCanvasSelectionStore } from '../../design/canvas/canvas-selection-store'
import { useCanvasShapeStore } from '../../design/canvas/canvas-shape-store'
import { shapeBounds, type CanvasDocument } from '../../design/canvas/canvas-types'
import { useCanvasViewportStore } from '../../design/canvas/canvas-viewport-store'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'
import {
  buildDesignAgentNotesPanelModel,
  type DesignAgentNotePanelItem
} from '../../design/agent-notes/design-agent-notes-panel'
import { SidebarIconButton, SidebarSectionHeader, SidebarTreeRow } from '../sidebar/SidebarPrimitives'

type Props = {
  onSeedPrompt?: (prompt: string) => void
  canvasDocument?: CanvasDocument
}

const KIND_LABEL_KEYS: Record<DesignAgentNotePanelItem['kind'], string> = {
  critique: 'designAgentNoteKindCritique',
  decision: 'designAgentNoteKindDecision',
  todo: 'designAgentNoteKindTodo',
  question: 'designAgentNoteKindQuestion',
  rationale: 'designAgentNoteKindRationale'
}

function severityClass(item: DesignAgentNotePanelItem): string {
  if (item.resolved) return 'text-[#2e9e6b]'
  if (item.severity === 'error') return 'text-[#c0392b]'
  if (item.severity === 'warning' || item.kind === 'critique') return 'text-[#c98a3a]'
  if (item.kind === 'decision') return 'text-[#2e9e6b]'
  return 'text-[#3b82d8]'
}

function focusShapes(ids: string[]): void {
  const store = useCanvasShapeStore.getState()
  const shapes = ids.map((id) => store.document.objects[id]).filter(Boolean)
  if (shapes.length === 0) return
  const first = shapes[0]
  useCanvasSelectionStore.getState().select(shapes.map((shape) => shape.id))
  useCanvasViewportStore.getState().setActiveTool('select')
  useCanvasViewportStore.getState().zoomToFit(shapeBounds(first), 72, { maxZoom: 1, minZoom: 0.18 })
}

function submitRepairPrompt(item: DesignAgentNotePanelItem, onSeedPrompt?: (prompt: string) => void): void {
  useDesignWorkspaceStore.getState().setDesignIntentMode(item.toolAction.intentMode)
  useDesignWorkspaceStore.getState().setCanvasAssistantOpen(true)
  onSeedPrompt?.(item.toolAction.prompt)
}

function NoteRow({ item, onSeedPrompt }: { item: DesignAgentNotePanelItem; onSeedPrompt?: Props['onSeedPrompt'] }): ReactElement {
  const { t } = useTranslation('common')
  const hasTargets = item.targetIds.length > 0
  const kindLabel = t(KIND_LABEL_KEYS[item.kind])
  const meta = [
    item.resolved ? t('designAgentNotesResolved') : t('designAgentNotesUnresolved'),
    item.targetNames.length > 0 ? item.targetNames.join(', ') : ''
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <li>
      <SidebarTreeRow
        active={item.active}
        title={item.body}
        onClick={() => focusShapes([item.id])}
        className="min-h-[42px]"
        buttonClassName="items-start gap-2 px-2.5 py-2"
        trailing={
          item.resolved ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-[#2e9e6b]" strokeWidth={1.9} />
          ) : (
            <TriangleAlert className={`h-3.5 w-3.5 ${severityClass(item)}`} strokeWidth={1.9} />
          )
        }
        actions={
          <>
            <SidebarIconButton
              onClick={() => focusShapes(hasTargets ? item.targetIds : [item.id])}
              title={hasTargets ? t('designAgentNotesFocusTarget') : t('designAgentNotesFocus')}
              ariaLabel={hasTargets ? t('designAgentNotesFocusTarget') : t('designAgentNotesFocus')}
              stopPropagation
            >
              <LocateFixed className="h-3.5 w-3.5" strokeWidth={1.9} />
            </SidebarIconButton>
            <SidebarIconButton
              onClick={() => submitRepairPrompt(item, onSeedPrompt)}
              title={t(item.toolAction.labelKey)}
              ariaLabel={t(item.toolAction.labelKey)}
              stopPropagation
            >
              <Wrench className="h-3.5 w-3.5" strokeWidth={1.9} />
            </SidebarIconButton>
          </>
        }
      >
        <MessageSquareText className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${severityClass(item)}`} strokeWidth={1.9} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 text-[10.5px] uppercase tracking-[0.02em] text-ds-faint">{kindLabel}</span>
            <span className="truncate text-[12.5px]">{item.body}</span>
          </span>
          <span className="mt-0.5 block truncate text-[10.5px] text-ds-faint">{meta}</span>
          <span className="mt-0.5 block truncate text-[10.5px] text-ds-faint">
            {item.toolAction.toolId}
          </span>
        </span>
      </SidebarTreeRow>
    </li>
  )
}

export function DesignAgentNotesPanel({ onSeedPrompt, canvasDocument }: Props): ReactElement | null {
  const { t } = useTranslation('common')
  const storeDoc = useCanvasShapeStore((s) => s.document)
  const doc = canvasDocument ?? storeDoc
  const selectedIds = useCanvasSelectionStore((s) => s.selectedIds)
  const model = useMemo(() => buildDesignAgentNotesPanelModel({ doc, selectedIds }), [doc, selectedIds])
  if (model.totalCount === 0) return null

  return (
    <section>
      <SidebarSectionHeader label={t('designAgentNotesTitle')} />
      <ul className="space-y-1">
        {model.items.map((item) => (
          <NoteRow key={item.id} item={item} onSeedPrompt={onSeedPrompt} />
        ))}
      </ul>
      <div className="px-2.5 pt-1 text-[11.5px] leading-5 text-ds-faint">
        {t('designAgentNotesSummary', {
          unresolved: model.unresolvedCount,
          total: model.totalCount
        })}
      </div>
    </section>
  )
}
