import { useMemo, type ReactElement } from 'react'
import { FileCode2, Image as ImageIcon, LocateFixed, Play, StickyNote } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCanvasSelectionStore } from '../../design/canvas/canvas-selection-store'
import { useCanvasShapeStore } from '../../design/canvas/canvas-shape-store'
import { shapeBounds, type CanvasDocument } from '../../design/canvas/canvas-types'
import { useCanvasViewportStore } from '../../design/canvas/canvas-viewport-store'
import type { DesignArtifact } from '../../design/design-types'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'
import {
  buildDesignReferencePanelModel,
  type DesignReferenceImageItem,
  type DesignReferenceScreenItem
} from '../../design/references/design-reference-panel'
import { SidebarIconButton, SidebarSectionHeader, SidebarTreeRow } from '../sidebar/SidebarPrimitives'
import { useDesignAgentActionRunner } from './useDesignAgentActionRunner'

type Props = {
  artifacts?: readonly DesignArtifact[]
  canvasDocument?: CanvasDocument
  selectedIds?: ReadonlySet<string>
  onSeedPrompt?: (prompt: string) => void
}

function focusShapes(ids: readonly string[]): void {
  const doc = useCanvasShapeStore.getState().document
  const shapes = ids.map((id) => doc.objects[id]).filter(Boolean)
  if (shapes.length === 0) return
  useCanvasSelectionStore.getState().select(shapes.map((shape) => shape.id))
  useCanvasViewportStore.getState().setActiveTool('select')
  useCanvasViewportStore.getState().zoomToFit(shapeBounds(shapes[0]), 72, { maxZoom: 1, minZoom: 0.18 })
}

function imageMeta(item: DesignReferenceImageItem, t: (key: string) => string): string {
  const size = `${Math.round(item.width)}x${Math.round(item.height)}`
  const source = t(`designReferenceSource${item.source.charAt(0).toUpperCase()}${item.source.slice(1)}`)
  return [source, size, item.parentName].filter(Boolean).join(' · ')
}

function screenMeta(item: DesignReferenceScreenItem, t: (key: string, values?: Record<string, number>) => string): string {
  return [
    item.role,
    item.directionName,
    item.designMdPath ? 'DESIGN.md' : '',
    item.prototypeLinkCount ? t('designReferencesLinks', { count: item.prototypeLinkCount }) : ''
  ].filter(Boolean).join(' · ')
}

function ImageRow({ item }: { item: DesignReferenceImageItem }): ReactElement {
  const { t } = useTranslation('common')
  return (
    <li>
      <SidebarTreeRow
        active={item.active}
        title={`${item.name} · ${item.imageUrl}`}
        onClick={() => focusShapes([item.id])}
        className="min-h-[40px]"
        buttonClassName="items-start gap-2 px-2.5 py-2"
        actions={
          <SidebarIconButton
            title={t('designReferencesFocus')}
            ariaLabel={t('designReferencesFocus')}
            onClick={() => focusShapes([item.id])}
            stopPropagation
          >
            <LocateFixed className="h-3.5 w-3.5" strokeWidth={1.9} />
          </SidebarIconButton>
        }
      >
        <ImageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ds-muted" strokeWidth={1.9} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px]">{item.name}</span>
          <span className="mt-0.5 block truncate text-[10.5px] text-ds-faint">
            {imageMeta(item, t)}
          </span>
        </span>
      </SidebarTreeRow>
    </li>
  )
}

function ScreenRow({ item }: { item: DesignReferenceScreenItem }): ReactElement {
  const { t } = useTranslation('common')
  const meta = screenMeta(item, t)
  return (
    <li>
      <SidebarTreeRow
        active={item.active}
        title={`${item.title} · ${item.relativePath}`}
        disabled={!item.frameId}
        onClick={() => item.frameId ? focusShapes([item.frameId]) : undefined}
        className="min-h-[40px]"
        buttonClassName="items-start gap-2 px-2.5 py-2"
        actions={
          <SidebarIconButton
            title={t('designReferencesFocus')}
            ariaLabel={t('designReferencesFocus')}
            disabled={!item.frameId}
            onClick={() => item.frameId ? focusShapes([item.frameId]) : undefined}
            stopPropagation
          >
            <LocateFixed className="h-3.5 w-3.5" strokeWidth={1.9} />
          </SidebarIconButton>
        }
      >
        <FileCode2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ds-muted" strokeWidth={1.9} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px]">{item.title}</span>
          <span className="mt-0.5 block truncate text-[10.5px] text-ds-faint">
            {meta || item.relativePath}
          </span>
        </span>
      </SidebarTreeRow>
    </li>
  )
}

export function DesignReferencePanel({
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
    () => buildDesignReferencePanelModel({ artifacts: artifacts ?? storeArtifacts, doc, selectedIds }),
    [artifacts, doc, selectedIds, storeArtifacts]
  )
  if (model.totalCount === 0) return null

  return (
    <section>
      <SidebarSectionHeader
        label={t('designReferencesTitle')}
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
      {model.images.length > 0 ? (
        <ul className="space-y-1">
          {model.images.slice(0, 4).map((item) => (
            <ImageRow key={item.id} item={item} />
          ))}
        </ul>
      ) : null}
      {model.screens.length > 0 ? (
        <ul className={model.images.length > 0 ? 'mt-1 space-y-1' : 'space-y-1'}>
          {model.screens.slice(0, 4).map((item) => (
            <ScreenRow key={item.id} item={item} />
          ))}
        </ul>
      ) : model.noteCount > 0 ? (
        <div className="flex items-start gap-1.5 px-2.5 py-1.5 text-[12px] leading-5 text-ds-faint">
          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
          <span className="min-w-0 flex-1">{t('designReferencesNotesOnly')}</span>
        </div>
      ) : null}
      <div className="px-2.5 pt-1 text-[11.5px] leading-5 text-ds-faint">
        {t('designReferencesSummary', {
          images: model.imageCount,
          screens: model.screenCount,
          notes: model.noteCount,
          selected: model.selectedCount
        })}
      </div>
    </section>
  )
}
