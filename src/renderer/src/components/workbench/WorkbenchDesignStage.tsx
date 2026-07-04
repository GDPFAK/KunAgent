import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { DesignWorkspaceView } from '../design/DesignWorkspaceView'

type DesignWorkspaceViewProps = ComponentProps<typeof DesignWorkspaceView>

type WorkbenchDesignStageProps = Pick<
  DesignWorkspaceViewProps,
  | 'leftSidebarCollapsed'
  | 'onToggleLeftSidebar'
  | 'busy'
  | 'onOpenAgentSettings'
  | 'onImplementDesign'
  | 'onScreenCreated'
  | 'onUseElementAsContext'
  | 'onRuntimeQualityFindings'
  | 'onRequestQualityRepair'
> & {
  rightPanel: ReactNode
}

export function WorkbenchDesignStage({
  rightPanel,
  ...workspaceProps
}: WorkbenchDesignStageProps): ReactElement {
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <DesignWorkspaceView {...workspaceProps} />
      {rightPanel}
    </div>
  )
}
