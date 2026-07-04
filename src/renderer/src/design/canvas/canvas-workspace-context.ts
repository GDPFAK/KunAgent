import { createContext, useContext } from 'react'

export type CanvasWorkspaceValue = {
  /** Workspace root used to resolve workspace-relative image paths to data URLs. */
  workspaceRoot: string
}

export const CanvasWorkspaceContext = createContext<CanvasWorkspaceValue>({ workspaceRoot: '' })

export function useCanvasWorkspaceRoot(): string {
  return useContext(CanvasWorkspaceContext).workspaceRoot
}
