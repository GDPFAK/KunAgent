import {
  lazy,
  Suspense,
  type ComponentProps,
  type ReactElement,
  type ReactNode
} from 'react'
import { SideConversationPanel } from '../chat/SideConversationPanel'
import { WorkbenchSideRail } from '../chat/WorkbenchTopBar'
import { RAIL_WIDTH } from '../workbench-layout'
import { WorkbenchChatStage, type WorkbenchChatStageProps } from './WorkbenchChatStage'
import {
  WorkbenchFileTreeSidePanel,
  type WorkbenchFileTreeSidePanelProps
} from './WorkbenchFileTreeSidePanel'

const SddDraftEditorView = lazy(() =>
  import('../sdd/SddDraftEditorView').then((module) => ({ default: module.SddDraftEditorView }))
)

type SddDraftEditorViewProps = ComponentProps<typeof SddDraftEditorView>

export type WorkbenchConversationStageProps = {
  route: string
  runtimeBanner: ReactNode
  activeSddDraft: boolean
  sdd: Pick<
    SddDraftEditorViewProps,
    | 'leftSidebarCollapsed'
    | 'assistantOpen'
    | 'onToggleLeftSidebar'
    | 'onToggleAssistant'
    | 'onAssistantQuote'
    | 'onPrototypeTurn'
    | 'onExploreInDesign'
    | 'onNext'
    | 'onClose'
    | 'nextDisabled'
  >
  chat: WorkbenchChatStageProps
  sideChat: {
    open: boolean
    count: number
    runningCount: number
    enabled: boolean
    onOpen: () => void
  }
  rightPanel: ReactNode
  rightPanelDockedVisible: boolean
  rightSidebarWidth: number
  fileTree: WorkbenchFileTreeSidePanelProps
  sideRail: {
    rightPanelMode: WorkbenchChatStageProps['devPreviewOpened'] extends boolean
      ? Parameters<typeof WorkbenchSideRail>[0]['rightPanelMode']
      : never
    onToggleRightPanelMode: Parameters<typeof WorkbenchSideRail>[0]['onToggleRightPanelMode']
    planPanelEnabled: boolean
    terminalOpen: boolean
    onToggleTerminal: () => void
    onToggleFileTree: () => void
  }
}

function WorkbenchPaneFallback(): ReactElement {
  return <div className="h-full min-h-0 w-full bg-ds-main" aria-hidden />
}

export function WorkbenchConversationStage({
  route,
  runtimeBanner,
  activeSddDraft,
  sdd,
  chat,
  sideChat,
  rightPanel,
  rightPanelDockedVisible,
  rightSidebarWidth,
  fileTree,
  sideRail
}: WorkbenchConversationStageProps): ReactElement {
  const fileTreeSidePanelOffset = fileTree.open ? fileTree.width + 24 : 0
  return (
    <>
      {runtimeBanner}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1">
          {activeSddDraft ? (
            <Suspense fallback={<WorkbenchPaneFallback />}>
              <SddDraftEditorView {...sdd} />
            </Suspense>
          ) : (
            <WorkbenchChatStage {...chat} />
          )}
        </div>

        {route === 'chat' && !activeSddDraft ? (
          <SideConversationPanel
            rightOffset={
              (rightPanelDockedVisible ? rightSidebarWidth + 24 : 24) +
              fileTreeSidePanelOffset +
              RAIL_WIDTH
            }
          />
        ) : null}

        {rightPanel}
        <WorkbenchFileTreeSidePanel {...fileTree} />
        {!activeSddDraft ? (
          <WorkbenchSideRail
            rightPanelMode={sideRail.rightPanelMode}
            onToggleRightPanelMode={sideRail.onToggleRightPanelMode}
            planPanelEnabled={sideRail.planPanelEnabled}
            canvasEnabled={route === 'chat'}
            terminalOpen={sideRail.terminalOpen}
            onToggleTerminal={sideRail.onToggleTerminal}
            sideChatCount={sideChat.count}
            sideChatRunningCount={sideChat.runningCount}
            sideChatOpen={sideChat.open}
            sideChatEnabled={sideChat.enabled}
            fileTreeOpen={fileTree.open}
            fileTreeEnabled={Boolean(fileTree.workspaceRoot)}
            onToggleFileTree={sideRail.onToggleFileTree}
            onOpenSideChat={sideChat.onOpen}
          />
        ) : null}
      </div>
    </>
  )
}
