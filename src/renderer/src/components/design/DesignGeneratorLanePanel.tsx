import { useMemo, type ComponentType, type ReactElement } from 'react'
import { ImagePlus, Layers3, MessageSquareText, WandSparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCanvasSelectionStore } from '../../design/canvas/canvas-selection-store'
import { useCanvasShapeStore } from '../../design/canvas/canvas-shape-store'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'
import {
  buildOpenUiGeneratorLaneModel,
  type OpenUiGeneratorLaneAction,
  type OpenUiGeneratorLaneActionId
} from '../../design/generator-lane/openui-generator-lane'
import { SidebarSectionHeader, SidebarTreeRow } from '../sidebar/SidebarPrimitives'

type Props = {
  onSeedPrompt?: (prompt: string) => void
}

const ACTION_ICONS: Record<OpenUiGeneratorLaneActionId, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  'quick-screen': WandSparkles,
  'three-directions': Layers3,
  'annotate-refine': MessageSquareText,
  'normalize-system': ImagePlus
}

function GeneratorActionRow({
  action,
  onSeedPrompt
}: {
  action: OpenUiGeneratorLaneAction
  onSeedPrompt?: (prompt: string) => void
}): ReactElement {
  const { t } = useTranslation('common')
  const Icon = ACTION_ICONS[action.id]
  const disabled = Boolean(action.disabledReasonKey)
  return (
    <li>
      <SidebarTreeRow
        disabled={disabled}
        title={disabled ? t(action.disabledReasonKey ?? '') : t(action.labelKey)}
        onClick={() => {
          if (disabled) return
          useDesignWorkspaceStore.getState().setDesignIntentMode(action.intentMode)
          useDesignWorkspaceStore.getState().setCanvasAssistantOpen(true)
          onSeedPrompt?.(action.prompt)
        }}
        className="min-h-[38px]"
        buttonClassName="items-start gap-2 px-2.5 py-2"
      >
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ds-muted" strokeWidth={1.9} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px]">{t(action.labelKey)}</span>
          <span className="mt-0.5 block truncate text-[10.5px] text-ds-faint">
            {disabled ? t(action.disabledReasonKey ?? '') : t(action.detailKey)}
          </span>
          <span className="mt-0.5 block truncate text-[10.5px] text-ds-faint">
            {action.toolInputSeed.toolId}
          </span>
        </span>
      </SidebarTreeRow>
    </li>
  )
}

export function DesignGeneratorLanePanel({ onSeedPrompt }: Props): ReactElement {
  const { t } = useTranslation('common')
  const doc = useCanvasShapeStore((s) => s.document)
  const selectedIds = useCanvasSelectionStore((s) => s.selectedIds)
  const designTarget = useDesignWorkspaceStore((s) => s.designContext.designTarget ?? 'web')
  const model = useMemo(
    () => buildOpenUiGeneratorLaneModel({ doc, selectedIds, designTarget }),
    [designTarget, doc, selectedIds]
  )

  return (
    <section>
      <SidebarSectionHeader label={t('designGeneratorLaneTitle')} />
      <ul className="space-y-1">
        {model.actions.map((action) => (
          <GeneratorActionRow key={action.id} action={action} onSeedPrompt={onSeedPrompt} />
        ))}
      </ul>
      <div className="px-2.5 pt-1 text-[11.5px] leading-5 text-ds-faint">
        {t('designGeneratorLaneSummary', {
          screens: model.screenCount,
          selected: model.selectedCount,
          bindings: model.hasCodeBindings ? 1 : 0
        })}
      </div>
    </section>
  )
}
