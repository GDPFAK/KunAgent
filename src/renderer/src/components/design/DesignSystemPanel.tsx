import { useMemo, type ComponentType, type ReactElement } from 'react'
import { Palette, ShieldCheck, WandSparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCanvasSelectionStore } from '../../design/canvas/canvas-selection-store'
import { useCanvasShapeStore } from '../../design/canvas/canvas-shape-store'
import type { CanvasDocument } from '../../design/canvas/canvas-types'
import { useDesignSystemStore } from '../../design/canvas/design-system-store'
import type { DesignSystem } from '../../design/canvas/design-system-types'
import type { DesignTarget } from '../../design/design-context'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'
import {
  buildDesignSystemPanelModel,
  type DesignSystemPanelModel
} from '../../design/design-system/design-system-panel-model'
import type { DesignSystemPanelAction } from '../../design/design-system/design-system-tool-actions'
import { SidebarSectionHeader, SidebarTreeRow } from '../sidebar/SidebarPrimitives'
import { useDesignAgentActionRunner } from './useDesignAgentActionRunner'

type Props = {
  onSeedPrompt?: (prompt: string) => void
  canvasDocument?: CanvasDocument
  designSystem?: DesignSystem
  selectedIds?: ReadonlySet<string>
  designTarget?: DesignTarget
}

const ACTION_ICONS: Record<
  DesignSystemPanelAction['id'],
  ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  'extract-system': WandSparkles,
  'validate-system': ShieldCheck,
  'apply-system': Palette
}

function disabledReasonLabel(reasonKey: string | undefined, t: (key: string) => string): string {
  return reasonKey ? t(reasonKey) : ''
}

function DesignSystemActionRow({
  action,
  onRun
}: {
  action: DesignSystemPanelAction
  onRun: (action: DesignSystemPanelAction) => void
}): ReactElement {
  const { t } = useTranslation('common')
  const Icon = ACTION_ICONS[action.id]
  const disabled = Boolean(action.disabledReasonKey)
  const detail = disabled ? disabledReasonLabel(action.disabledReasonKey, t) : t(action.detailKey)
  return (
    <li>
      <SidebarTreeRow
        disabled={disabled}
        title={disabled ? detail : t(action.labelKey)}
        onClick={() => onRun(action)}
        className={`min-h-[38px] ${disabled ? 'opacity-55' : ''}`}
        buttonClassName="items-start gap-2 px-2.5 py-2"
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

function summaryText(model: DesignSystemPanelModel, t: (key: string, values?: Record<string, unknown>) => string): string {
  return t('designSystemPanelSummary', {
    tokens: model.tokenCount,
    components: model.componentCount,
    bindings: model.tokenUsageCount + model.componentInstanceCount
  })
}

export function DesignSystemPanel({
  onSeedPrompt,
  canvasDocument,
  designSystem,
  selectedIds: providedSelectedIds,
  designTarget: providedDesignTarget
}: Props): ReactElement {
  const { t } = useTranslation('common')
  const storeDoc = useCanvasShapeStore((s) => s.document)
  const storeSystem = useDesignSystemStore((s) => s.system)
  const storeSelectedIds = useCanvasSelectionStore((s) => s.selectedIds)
  const storeDesignTarget = useDesignWorkspaceStore((s) => s.designContext.designTarget ?? 'web')
  const runAgentAction = useDesignAgentActionRunner(onSeedPrompt)
  const doc = canvasDocument ?? storeDoc
  const system = designSystem ?? storeSystem
  const selectedIds = providedSelectedIds ?? storeSelectedIds
  const designTarget = providedDesignTarget ?? storeDesignTarget
  const model = useMemo(
    () => buildDesignSystemPanelModel({ doc, designSystem: system, selectedIds, designTarget }),
    [designTarget, doc, selectedIds, system]
  )

  return (
    <section>
      <SidebarSectionHeader label={t('designSystemPanelTitle')} />
      <ul className="space-y-1">
        {model.actions.map((action) => (
          <DesignSystemActionRow
            key={action.id}
            action={action}
            onRun={(item) => runAgentAction(item)}
          />
        ))}
      </ul>
      <div className="px-2.5 pt-1 text-[11.5px] leading-5 text-ds-faint">
        {summaryText(model, t)}
      </div>
      <div className="px-2.5 text-[11.5px] leading-5 text-ds-faint">
        {t('designSystemPanelCanvasSummary', {
          screens: model.screenCount,
          objects: model.objectCount,
          selected: model.selectedCount,
          findings: model.lintFindingCount
        })}
      </div>
    </section>
  )
}
