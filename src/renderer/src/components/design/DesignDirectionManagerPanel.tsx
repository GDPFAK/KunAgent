import { useMemo, useState, type ReactElement } from 'react'
import { Archive, Check, GitCompareArrows, Play, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { DesignDirectionGroup } from '../../design/design-artifact-actions'
import type { CanvasDocument } from '../../design/canvas/canvas-types'
import {
  buildDesignDirectionManagerModel,
  type DesignDirectionManagerDirection,
  type DesignDirectionManagerModel
} from '../../design/directions/direction-manager'
import type { DesignArtifact, DesignDirectionStatus } from '../../design/design-types'
import {
  SidebarIconButton,
  SidebarSectionHeader,
  SidebarTreeRow
} from '../sidebar/SidebarPrimitives'
import { DirectionCompareOverlay } from './DirectionCompareOverlay'
import { useDesignAgentActionRunner } from './useDesignAgentActionRunner'

type Props = {
  workspaceRoot: string
  canvasDocument?: CanvasDocument
  directions: readonly DesignDirectionGroup[]
  archivedDirections: readonly DesignDirectionGroup[]
  activeArtifactId: string | null
  onSelectArtifact: (artifact: DesignArtifact) => void
  onSetDirectionStatus: (directionId: string, status: DesignDirectionStatus) => void
  onSeedPrompt?: (prompt: string) => void
}

function readinessLabel(
  readiness: NonNullable<DesignDirectionManagerDirection['scorecard']>['readiness'],
  t: TFunction<'common'>
): string {
  if (readiness === 'ready') return t('designDirectionReadinessReady')
  if (readiness === 'blocked') return t('designDirectionReadinessBlocked')
  return t('designDirectionReadinessNeedsReview')
}

function costLabel(
  cost: NonNullable<DesignDirectionManagerDirection['scorecard']>['implementationCost'],
  t: TFunction<'common'>
): string {
  if (cost === 'low') return t('designDirectionCostLow')
  if (cost === 'high') return t('designDirectionCostHigh')
  return t('designDirectionCostMedium')
}

function formatDirectionMeta(direction: DesignDirectionManagerDirection, t: TFunction<'common'>): string {
  const scorecard = direction.scorecard
  return [
    t('designDirectionCompareScreens', { count: direction.screenCount }),
    t('designDirectionCompareFlows', { count: direction.prototypeLinkCount }),
    direction.implementedCount > 0
      ? t('designDirectionCompareImplemented', { count: direction.implementedCount })
      : '',
    scorecard
      ? t('designDirectionScoreMeta', {
          score: scorecard.score,
          readiness: readinessLabel(scorecard.readiness, t),
          cost: costLabel(scorecard.implementationCost, t)
        })
      : ''
  ]
    .filter(Boolean)
    .join(' · ')
}

function statusLabel(status: DesignDirectionStatus, t: (key: string) => string): string | null {
  if (status === 'accepted') return t('designDirectionAccepted')
  if (status === 'archived') return t('designDirectionArchived')
  return null
}

function DirectionStatusPill({
  direction
}: {
  direction: DesignDirectionManagerDirection
}): ReactElement | null {
  const { t } = useTranslation('common')
  const label = statusLabel(direction.status, t)
  if (!label) return null
  return (
    <span className="shrink-0 rounded-full bg-[#2e9e6b]/10 px-1.5 py-0.5 text-[10.5px] leading-none text-[#2e9e6b]">
      {label}
    </span>
  )
}

function DirectionActions({
  direction,
  onSetDirectionStatus,
  onSeedPrompt
}: {
  direction: DesignDirectionManagerDirection
  onSetDirectionStatus: Props['onSetDirectionStatus']
  onSeedPrompt?: Props['onSeedPrompt']
}): ReactElement {
  const { t } = useTranslation('common')
  const runAgentAction = useDesignAgentActionRunner(onSeedPrompt)
  const runToolAction = (): void => {
    runAgentAction({
      intentMode: direction.toolAction.intentMode,
      prompt: direction.toolAction.prompt
    })
  }
  if (direction.status === 'archived') {
    return (
      <>
        <SidebarIconButton
          onClick={runToolAction}
          title={direction.toolAction.label}
          ariaLabel={direction.toolAction.label}
          stopPropagation
        >
          <Play className="h-3.5 w-3.5" strokeWidth={1.9} />
        </SidebarIconButton>
        <SidebarIconButton
          onClick={() => onSetDirectionStatus(direction.id, 'active')}
          title={t('designDirectionRestore')}
          ariaLabel={t('designDirectionRestore')}
          stopPropagation
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.9} />
        </SidebarIconButton>
      </>
    )
  }
  return (
    <>
      <SidebarIconButton
        onClick={runToolAction}
        title={direction.toolAction.label}
        ariaLabel={direction.toolAction.label}
        stopPropagation
      >
        <Play className="h-3.5 w-3.5" strokeWidth={1.9} />
      </SidebarIconButton>
      <SidebarIconButton
        onClick={() => onSetDirectionStatus(direction.id, 'accepted')}
        title={t('designDirectionAccept')}
        ariaLabel={t('designDirectionAccept')}
        stopPropagation
      >
        <Check className="h-3.5 w-3.5" strokeWidth={1.9} />
      </SidebarIconButton>
      <SidebarIconButton
        onClick={() => onSetDirectionStatus(direction.id, 'archived')}
        title={t('designDirectionArchive')}
        ariaLabel={t('designDirectionArchive')}
        tone="danger"
        stopPropagation
      >
        <Archive className="h-3.5 w-3.5" strokeWidth={1.9} />
      </SidebarIconButton>
    </>
  )
}

function DirectionRow({
  direction,
  activeArtifactId,
  onSelectArtifact,
  onSetDirectionStatus,
  onSeedPrompt
}: {
  direction: DesignDirectionManagerDirection
  activeArtifactId: string | null
  onSelectArtifact: Props['onSelectArtifact']
  onSetDirectionStatus: Props['onSetDirectionStatus']
  onSeedPrompt?: Props['onSeedPrompt']
}): ReactElement {
  const { t } = useTranslation('common')
  const active = direction.artifacts.some((artifact) => artifact.id === activeArtifactId)
  return (
    <li>
      <SidebarTreeRow
        active={active}
        onClick={() => {
          const first = direction.artifacts[0]
          if (first) onSelectArtifact(first)
        }}
        title={direction.name}
        className="min-h-[34px]"
        buttonClassName="items-start gap-2 px-2.5 py-2"
        trailing={<DirectionStatusPill direction={direction} />}
        actions={
          <DirectionActions
            direction={direction}
            onSetDirectionStatus={onSetDirectionStatus}
            onSeedPrompt={onSeedPrompt}
          />
        }
      >
        <GitCompareArrows className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ds-muted" strokeWidth={1.9} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px]">{direction.name}</span>
          <span className="mt-0.5 block truncate text-[10.5px] text-ds-faint">
            {formatDirectionMeta(direction, t)}
          </span>
          <span className="mt-0.5 block truncate text-[10.5px] text-ds-faint">
            {direction.toolAction.label} · {direction.toolAction.toolId}
          </span>
        </span>
      </SidebarTreeRow>
      {direction.artifacts.length > 1 ? (
        <div className="ml-6 mt-0.5 flex gap-1 overflow-x-auto pb-1">
          {direction.artifacts.slice(0, 8).map((artifact) => (
            <button
              key={artifact.id}
              type="button"
              onClick={() => onSelectArtifact(artifact)}
              className={`h-6 max-w-[120px] shrink-0 truncate rounded-[8px] px-2 text-[10.5px] transition ${
                artifact.id === activeArtifactId
                  ? 'bg-[#1f2733] text-white'
                  : 'bg-ds-hover/45 text-ds-muted hover:bg-ds-hover hover:text-ds-ink'
              }`}
              title={artifact.title}
            >
              {artifact.title}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  )
}

function renderDirectionList(
  model: DesignDirectionManagerModel,
  props: Pick<Props, 'activeArtifactId' | 'onSelectArtifact' | 'onSetDirectionStatus' | 'onSeedPrompt'>
): ReactElement {
  const items = [...model.directions, ...model.archivedDirections]
  return (
    <ul className="space-y-1">
      {items.map((direction) => (
        <DirectionRow
          key={direction.id}
          direction={direction}
          activeArtifactId={props.activeArtifactId}
          onSelectArtifact={props.onSelectArtifact}
          onSetDirectionStatus={props.onSetDirectionStatus}
          onSeedPrompt={props.onSeedPrompt}
        />
      ))}
    </ul>
  )
}

export function DesignDirectionManagerPanel({
  workspaceRoot,
  canvasDocument,
  directions,
  archivedDirections,
  activeArtifactId,
  onSelectArtifact,
  onSetDirectionStatus,
  onSeedPrompt
}: Props): ReactElement | null {
  const { t } = useTranslation('common')
  const [compareOpen, setCompareOpen] = useState(false)
  const model = useMemo(
    () => buildDesignDirectionManagerModel(directions, archivedDirections, { canvasDocument }),
    [archivedDirections, canvasDocument, directions]
  )
  if (model.activeCount + model.archivedCount === 0) return null

  return (
    <section>
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <SidebarSectionHeader label={t('designDirectionsTitle')} />
        </div>
        {model.canCompare ? (
          <SidebarIconButton
            onClick={() => setCompareOpen(true)}
            title={t('designDirectionCompareOpen')}
            ariaLabel={t('designDirectionCompareOpen')}
          >
            <GitCompareArrows className="h-3.5 w-3.5" strokeWidth={1.9} />
          </SidebarIconButton>
        ) : null}
      </div>
      {renderDirectionList(model, { activeArtifactId, onSelectArtifact, onSetDirectionStatus, onSeedPrompt })}
      <DirectionCompareOverlay
        open={compareOpen}
        workspaceRoot={workspaceRoot}
        directions={directions}
        onClose={() => setCompareOpen(false)}
      />
    </section>
  )
}
