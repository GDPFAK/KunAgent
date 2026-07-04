import { useCallback, useMemo, type ComponentType, type ReactElement } from 'react'
import { Bot, Brush, Cable, FileCheck2, Layers, Play, StickyNote, Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { buildRecommendedDesignWorkflowAction } from '../../design/agent-actions/design-agent-actions'
import { useCanvasSelectionStore } from '../../design/canvas/canvas-selection-store'
import { useCanvasShapeStore } from '../../design/canvas/canvas-shape-store'
import { useDesignSystemStore } from '../../design/canvas/design-system-store'
import type { DesignDocument } from '../../design/design-types'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'
import {
  buildDesignModeSurfaceManifest,
  type DesignModeSurface,
  type DesignModeSurfaceId,
  type DesignModeSurfaceStatus
} from '../../design/design-mode/design-mode-surface'
import { SidebarIconButton, SidebarSectionHeader } from '../sidebar/SidebarPrimitives'
import { useDesignAgentActionRunner } from './useDesignAgentActionRunner'
import { DesignModeWorkflowPanel } from './DesignModeWorkflowPanel'

type Props = {
  document: DesignDocument | null
  onSeedPrompt?: (prompt: string) => void
}

const SURFACE_ICONS: Record<DesignModeSurfaceId, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  agent: Bot,
  canvas: Layers,
  'design-tools': Wrench,
  whiteboard: StickyNote,
  'code-bridge': Cable,
  handoff: FileCheck2
}

const SURFACE_LABEL_KEYS: Record<DesignModeSurfaceId, string> = {
  agent: 'designModeSurfaceAgent',
  canvas: 'designModeSurfaceCanvas',
  'design-tools': 'designModeSurfaceTools',
  whiteboard: 'designModeSurfaceWhiteboard',
  'code-bridge': 'designModeSurfaceCodeBridge',
  handoff: 'designModeSurfaceHandoff'
}

function statusLabelKey(status: DesignModeSurfaceStatus): string {
  switch (status) {
    case 'active':
      return 'designModeSurfaceStatusActive'
    case 'ready':
      return 'designModeSurfaceStatusReady'
    case 'needs-setup':
      return 'designModeSurfaceStatusNeedsSetup'
    case 'blocked':
      return 'designModeSurfaceStatusBlocked'
  }
}

function statusToneClass(status: DesignModeSurfaceStatus): string {
  switch (status) {
    case 'active':
      return 'bg-[#3b82d8]/10 text-[#2f73bf]'
    case 'ready':
      return 'bg-[#2e9e6b]/10 text-[#2e9e6b]'
    case 'needs-setup':
      return 'bg-[#c98a3a]/12 text-[#a56d25]'
    case 'blocked':
      return 'bg-[#c0392b]/10 text-[#b7352b]'
  }
}

function SurfaceRow({ surface }: { surface: DesignModeSurface }): ReactElement {
  const { t } = useTranslation('common')
  const Icon = SURFACE_ICONS[surface.id] ?? Brush
  const width = Math.max(4, Math.min(100, surface.healthScore))
  return (
    <li className="flex min-h-[40px] items-start gap-2 rounded-[8px] px-2.5 py-2 text-[12.5px] text-[#343434] transition hover:bg-[var(--ds-sidebar-row-hover)] dark:text-white/75">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ds-muted" strokeWidth={1.9} />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{t(SURFACE_LABEL_KEYS[surface.id])}</span>
        <span className="mt-0.5 block truncate text-[10.5px] leading-4 text-ds-faint">
          {t('designModeSurfaceMeta', {
            score: surface.healthScore,
            tools: surface.toolIds.length,
            resources: surface.resourceKinds.length
          })}
        </span>
        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-[var(--ds-sidebar-row-ring)]">
          <span className="block h-full rounded-full bg-[#3b82d8]" style={{ width: `${width}%` }} />
        </span>
      </span>
      <span
        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] leading-none ${statusToneClass(surface.status)}`}
      >
        {t(statusLabelKey(surface.status))}
      </span>
    </li>
  )
}

export function DesignModeSurfacePanel({ document, onSeedPrompt }: Props): ReactElement | null {
  const { t } = useTranslation('common')
  const canvasDocument = useCanvasShapeStore((s) => s.document)
  const selectedIds = useCanvasSelectionStore((s) => s.selectedIds)
  const designSystem = useDesignSystemStore((s) => s.system)
  const artifacts = useDesignWorkspaceStore((s) => s.artifacts)
  const designTarget = useDesignWorkspaceStore((s) => s.designContext.designTarget ?? 'web')
  const runAgentAction = useDesignAgentActionRunner(onSeedPrompt)
  const manifest = useMemo(
    () => buildDesignModeSurfaceManifest({ document, canvasDocument, designSystem, artifacts }),
    [artifacts, canvasDocument, designSystem, document]
  )
  const recommendedAction = useMemo(
    () => buildRecommendedDesignWorkflowAction({
      document,
      artifacts,
      doc: canvasDocument,
      selectedIds,
      designTarget,
      designSystem
    }),
    [artifacts, canvasDocument, designSystem, designTarget, document, selectedIds]
  )
  const runRecommendedAction = useCallback((): void => {
    runAgentAction(recommendedAction)
  }, [recommendedAction, runAgentAction])

  if (!document) return null

  const active = manifest.surfaces.filter((surface) => surface.status === 'active').length
  const ready = manifest.surfaces.filter((surface) => surface.status === 'ready').length
  const setup = manifest.surfaces.filter((surface) => surface.status === 'needs-setup').length

  return (
    <section>
      <SidebarSectionHeader
        label={t('designModeSurfaceTitle')}
        actions={
          <SidebarIconButton
            title={recommendedAction ? t('designModeWorkflowRunNext') : t('designModeWorkflowNoNext')}
            ariaLabel={recommendedAction ? t('designModeWorkflowRunNext') : t('designModeWorkflowNoNext')}
            disabled={!recommendedAction}
            onClick={runRecommendedAction}
            tone="accent"
          >
            <Play className="h-3.5 w-3.5" strokeWidth={1.9} />
          </SidebarIconButton>
        }
      />
      <ul className="space-y-1">
        {manifest.surfaces.map((surface) => (
          <SurfaceRow key={surface.id} surface={surface} />
        ))}
      </ul>
      <div className="px-2.5 pt-1 text-[11.5px] leading-5 text-ds-faint">
        {t('designModeSurfaceSummary', { active, ready, setup })}
      </div>
      <DesignModeWorkflowPanel workflow={manifest.workflow} />
    </section>
  )
}
