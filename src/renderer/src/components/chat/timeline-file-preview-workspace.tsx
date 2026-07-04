import { createContext, useContext, type ReactNode } from 'react'

export function timelineFilePreviewWorkspaceRoot(
  activeThread: { workspace?: string | null } | null | undefined,
  workspaceRoot: string
): string {
  return activeThread?.workspace?.trim() || workspaceRoot
}

const TimelineFilePreviewWorkspaceContext = createContext('')

export function TimelineFilePreviewWorkspaceProvider({
  workspaceRoot,
  children
}: {
  workspaceRoot: string
  children: ReactNode
}) {
  return (
    <TimelineFilePreviewWorkspaceContext.Provider value={workspaceRoot}>
      {children}
    </TimelineFilePreviewWorkspaceContext.Provider>
  )
}

export function useTimelineFilePreviewWorkspaceRoot(): string {
  return useContext(TimelineFilePreviewWorkspaceContext)
}
