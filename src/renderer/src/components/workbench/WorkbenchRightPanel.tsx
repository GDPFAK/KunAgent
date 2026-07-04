import {
  lazy,
  Suspense,
  type ComponentProps,
  type PointerEventHandler,
  type ReactElement
} from 'react'
import {
  DesignRightPanelContent,
  type DesignRightPanelContentProps
} from '../design/DesignRightPanelContent'
import type { RightPanelMode } from '../chat/WorkbenchTopBar'

const ChangeInspector = lazy(() =>
  import('../ChangeInspector').then((module) => ({ default: module.ChangeInspector }))
)
const DevBrowserPanel = lazy(() =>
  import('../DevBrowserPanel').then((module) => ({ default: module.DevBrowserPanel }))
)
const WorkspaceFilePreviewPanel = lazy(() =>
  import('../WorkspaceFilePreviewPanel').then((module) => ({
    default: module.WorkspaceFilePreviewPanel
  }))
)
const TodoPanel = lazy(() =>
  import('../todo/TodoPanel').then((module) => ({ default: module.TodoPanel }))
)
const CodeCanvasPanel = lazy(() =>
  import('../design/canvas/CodeCanvasPanel').then((module) => ({ default: module.CodeCanvasPanel }))
)
const SubagentDetailPanel = lazy(() =>
  import('../subagents/SubagentDetailPanel').then((module) => ({ default: module.SubagentDetailPanel }))
)
const WriteAssistantPanel = lazy(() =>
  import('../write/WriteAssistantPanel').then((module) => ({ default: module.WriteAssistantPanel }))
)
const SddAssistantPanel = lazy(() =>
  import('../sdd/SddAssistantPanel').then((module) => ({ default: module.SddAssistantPanel }))
)

type WriteAssistantPanelProps = ComponentProps<typeof WriteAssistantPanel>
type SddAssistantPanelProps = ComponentProps<typeof SddAssistantPanel>
type ChangeInspectorProps = ComponentProps<typeof ChangeInspector>
type TodoPanelProps = ComponentProps<typeof TodoPanel>
type DevBrowserPanelProps = ComponentProps<typeof DevBrowserPanel>
type CodeCanvasPanelProps = ComponentProps<typeof CodeCanvasPanel>
type WorkspaceFilePreviewPanelProps = ComponentProps<typeof WorkspaceFilePreviewPanel>

export type WorkbenchRightPanelProps = {
  visible: boolean
  width: number
  route: string
  rightPanelMode: RightPanelMode | null
  onBeginResize: PointerEventHandler<HTMLDivElement>
  design: DesignRightPanelContentProps
  writeAssistantOpen: boolean
  write: Omit<WriteAssistantPanelProps, 'className'>
  sdd: Omit<SddAssistantPanelProps, 'draft' | 'className'> & {
    draft: SddAssistantPanelProps['draft'] | null
  }
  changes: Omit<ChangeInspectorProps, 'className'>
  todo: Omit<TodoPanelProps, 'className'>
  browser: Omit<DevBrowserPanelProps, 'className'>
  planPanel: ReactElement
  canvas: Omit<CodeCanvasPanelProps, 'className'>
  file: Omit<WorkspaceFilePreviewPanelProps, 'className'>
  onCollapse: () => void
}

export function WorkbenchRightPanel({
  visible,
  width,
  route,
  rightPanelMode,
  onBeginResize,
  design,
  writeAssistantOpen,
  write,
  sdd,
  changes,
  todo,
  browser,
  planPanel,
  canvas,
  file,
  onCollapse
}: WorkbenchRightPanelProps): ReactElement | null {
  if (!visible) return null
  return (
    <>
      <div
        role="separator"
        aria-orientation="vertical"
        className="ds-workbench-divider ds-no-drag relative z-20 shrink-0 cursor-col-resize"
        onPointerDown={onBeginResize}
      />
      <div className="h-full min-h-0 shrink-0" style={{ width }}>
        <Suspense fallback={<div className="h-full w-full bg-ds-sidebar" />}>
          {design.panelMode !== 'hidden' ? (
            <DesignRightPanelContent {...design} />
          ) : route === 'write' && writeAssistantOpen ? (
            <WriteAssistantPanel {...write} className="h-full max-h-full w-full" />
          ) : rightPanelMode === 'sdd-ai' && sdd.draft ? (
            <SddAssistantPanel {...sdd} draft={sdd.draft} className="h-full max-h-full w-full" />
          ) : rightPanelMode === 'subagents' ? (
            <SubagentDetailPanel className="h-full max-h-full w-full" onCollapse={onCollapse} />
          ) : rightPanelMode === 'changes' ? (
            <ChangeInspector {...changes} className="h-full max-h-full w-full flex-col" />
          ) : rightPanelMode === 'todo' ? (
            <TodoPanel {...todo} className="h-full max-h-full w-full" />
          ) : rightPanelMode === 'browser' ? (
            <DevBrowserPanel {...browser} className="h-full max-h-full w-full flex-col" />
          ) : rightPanelMode === 'plan' ? (
            planPanel
          ) : rightPanelMode === 'canvas' ? (
            <CodeCanvasPanel {...canvas} className="h-full max-h-full w-full" />
          ) : (
            <WorkspaceFilePreviewPanel {...file} className="h-full max-h-full w-full" />
          )}
        </Suspense>
      </div>
    </>
  )
}
