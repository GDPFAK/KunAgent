import { useMemo, type ReactElement } from 'react'
import { GitBranch, LocateFixed, Play, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCanvasSelectionStore } from '../../design/canvas/canvas-selection-store'
import { useCanvasShapeStore } from '../../design/canvas/canvas-shape-store'
import { shapeBounds, type CanvasDocument } from '../../design/canvas/canvas-types'
import { useCanvasViewportStore } from '../../design/canvas/canvas-viewport-store'
import type { DesignArtifact } from '../../design/design-types'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'
import {
  buildPrototypeFlowPanelModel,
  type PrototypeFlowPanelEdge
} from '../../design/prototype-flow/prototype-flow-panel'
import { SidebarIconButton, SidebarSectionHeader, SidebarTreeRow } from '../sidebar/SidebarPrimitives'
import { useDesignAgentActionRunner } from './useDesignAgentActionRunner'

type Props = {
  artifacts?: readonly DesignArtifact[]
  canvasDocument?: CanvasDocument
  selectedIds?: ReadonlySet<string>
  onSeedPrompt?: (prompt: string) => void
}

function focusFrames(ids: readonly string[]): void {
  const doc = useCanvasShapeStore.getState().document
  const shapes = ids.map((id) => doc.objects[id]).filter(Boolean)
  if (shapes.length === 0) return
  useCanvasSelectionStore.getState().select(shapes.map((shape) => shape.id))
  useCanvasViewportStore.getState().setActiveTool('select')
  useCanvasViewportStore.getState().zoomToFit(shapeBounds(shapes[0]), 72, { maxZoom: 1, minZoom: 0.18 })
}

function edgeFrameIds(edge: PrototypeFlowPanelEdge): string[] {
  return [edge.sourceFrameId, edge.targetFrameId].filter((id): id is string => Boolean(id))
}

function edgeActive(edge: PrototypeFlowPanelEdge, selectedIds: ReadonlySet<string>): boolean {
  return edgeFrameIds(edge).some((id) => selectedIds.has(id))
}

function edgeMeta(edge: PrototypeFlowPanelEdge, t: (key: string) => string): string {
  const kind = edge.kind === 'explicit' ? t('designPrototypeFlowExplicit') : t('designPrototypeFlowFallback')
  return [kind, edge.label, edge.href].filter(Boolean).join(' · ')
}

function FlowRow({
  edge,
  selectedIds
}: {
  edge: PrototypeFlowPanelEdge
  selectedIds: ReadonlySet<string>
}): ReactElement {
  const { t } = useTranslation('common')
  const frameIds = edgeFrameIds(edge)
  return (
    <li>
      <SidebarTreeRow
        active={edgeActive(edge, selectedIds)}
        title={`${edge.sourceTitle} -> ${edge.targetTitle}`}
        disabled={frameIds.length === 0}
        onClick={() => focusFrames(frameIds)}
        className="min-h-[40px]"
        buttonClassName="items-start gap-2 px-2.5 py-2"
        actions={
          <SidebarIconButton
            title={t('designPrototypeFlowFocus')}
            ariaLabel={t('designPrototypeFlowFocus')}
            disabled={frameIds.length === 0}
            onClick={() => focusFrames(frameIds)}
            stopPropagation
          >
            <LocateFixed className="h-3.5 w-3.5" strokeWidth={1.9} />
          </SidebarIconButton>
        }
      >
        <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ds-muted" strokeWidth={1.9} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px]">
            {edge.sourceTitle}{' -> '}{edge.targetTitle}
          </span>
          <span className="mt-0.5 block truncate text-[10.5px] text-ds-faint">
            {edgeMeta(edge, t)}
          </span>
        </span>
      </SidebarTreeRow>
    </li>
  )
}

export function DesignPrototypeFlowPanel({
  artifacts,
  canvasDocument,
  selectedIds: providedSelectedIds,
  onSeedPrompt
}: Props): ReactElement | null {
  const { t } = useTranslation('common')
  const storeArtifacts = useDesignWorkspaceStore((s) => s.artifacts)
  const storeDoc = useCanvasShapeStore((s) => s.document)
  const storeSelectedIds = useCanvasSelectionStore((s) => s.selectedIds)
  const runAgentAction = useDesignAgentActionRunner(onSeedPrompt)
  const doc = canvasDocument ?? storeDoc
  const selectedIds = providedSelectedIds ?? storeSelectedIds
  const model = useMemo(
    () => buildPrototypeFlowPanelModel({ artifacts: artifacts ?? storeArtifacts, doc }),
    [artifacts, doc, storeArtifacts]
  )
  if (model.screenCount === 0) return null

  return (
    <section>
      <SidebarSectionHeader
        label={t('designPrototypeFlowTitle')}
        actions={
          <SidebarIconButton
            title={model.action.disabledReasonKey ? t(model.action.disabledReasonKey) : t(model.action.labelKey)}
            ariaLabel={t(model.action.labelKey)}
            disabled={Boolean(model.action.disabledReasonKey)}
            onClick={() => runAgentAction(model.action)}
          >
            <Play className="h-3.5 w-3.5" strokeWidth={1.9} />
          </SidebarIconButton>
        }
      />
      {model.edges.length > 0 ? (
        <ul className="space-y-1">
          {model.edges.slice(0, 6).map((edge) => (
            <FlowRow key={edge.id} edge={edge} selectedIds={selectedIds} />
          ))}
        </ul>
      ) : (
        <div className="px-2.5 py-1.5 text-[12px] leading-5 text-ds-faint">
          {t('designPrototypeFlowEmpty')}
        </div>
      )}
      <div className="px-2.5 pt-1 text-[11.5px] leading-5 text-ds-faint">
        {t('designPrototypeFlowSummary', {
          screens: model.screenCount,
          links: model.explicitLinkCount,
          fallback: model.fallbackEdgeCount,
          missing: model.missingLinks.length
        })}
      </div>
      {model.missingLinks.length > 0 ? (
        <div className="flex items-start gap-1.5 px-2.5 pt-1 text-[11.5px] leading-5 text-[#c98a3a]">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
          <span className="min-w-0 flex-1 truncate">
            {t('designPrototypeFlowMissing', { count: model.missingLinks.length })}
          </span>
        </div>
      ) : null}
    </section>
  )
}
