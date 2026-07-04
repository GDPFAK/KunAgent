import { useEffect, useMemo, useState } from 'react'
import type { WorkspaceFileTarget } from '@shared/workspace-file'
import type { NormalizedThread } from '../../agent/types'
import {
  composerFileReferenceFromPath,
  mergeComposerFileReferences,
  type ComposerFileReference
} from '../../lib/composer-file-references'
import { normalizeWorkspaceRoot } from '../../lib/workspace-path'
import type { ChatFileTreeReference } from '../chat/ChatFileTreePanel'
import type { RightPanelMode } from '../chat/WorkbenchTopBar'
import { CODE_PANEL_PREFERRED } from '../workbench-layout'

export type WorkbenchFileTreeSidePanelView = 'workspace' | 'design'

export type WorkbenchFileTreeControllerOptions = {
  route: string
  threads: NormalizedThread[]
  activeThreadId: string | null
  workspaceRoot: string
  activeSkillWorkspace: string
  rightPanelMode: RightPanelMode | null
  filePreviewTarget: WorkspaceFileTarget | null
  setFilePreviewTarget: (target: WorkspaceFileTarget | null) => void
  setRightPanelMode: (mode: RightPanelMode | null) => void
  setRightSidebarWidth: (updater: (width: number) => number) => void
}

function workspaceFileTargetKey(target: WorkspaceFileTarget | null | undefined): string {
  if (!target?.path) return ''
  return `${target.workspaceRoot ?? ''}\n${target.path}`.replaceAll('\\', '/').toLowerCase()
}

export function useWorkbenchFileTreeController({
  route,
  threads,
  activeThreadId,
  workspaceRoot,
  activeSkillWorkspace,
  rightPanelMode,
  filePreviewTarget,
  setFilePreviewTarget,
  setRightPanelMode,
  setRightSidebarWidth
}: WorkbenchFileTreeControllerOptions) {
  const [composerFileReferences, setComposerFileReferences] = useState<ComposerFileReference[]>([])
  const [fileTreeSidePanelOpen, setFileTreeSidePanelOpen] = useState(false)
  const [fileTreeSidePanelView, setFileTreeSidePanelView] =
    useState<WorkbenchFileTreeSidePanelView>('workspace')
  const [openFilePreviewTargets, setOpenFilePreviewTargets] = useState<WorkspaceFileTarget[]>([])
  const fileTreeWorkspaceRoot = useMemo(
    () => normalizeWorkspaceRoot(threads.find((thread) => thread.id === activeThreadId)?.workspace || workspaceRoot),
    [activeThreadId, threads, workspaceRoot]
  )

  function clearComposerFileReferences(): void {
    setComposerFileReferences([])
  }

  function addComposerFileReference(reference: ComposerFileReference): void {
    setComposerFileReferences((current) => mergeComposerFileReferences(current, reference))
  }

  async function pickComposerFileReferences(): Promise<void> {
    const result = await window.kunGui.pickLocalFiles(activeSkillWorkspace || undefined)
    if (result.canceled) return
    for (const path of result.paths) {
      addComposerFileReference(composerFileReferenceFromPath(path, activeSkillWorkspace))
    }
  }

  function removeComposerFileReference(relativePath: string): void {
    const key = relativePath.trim().replaceAll('\\', '/').replace(/\/+/g, '/').toLowerCase()
    setComposerFileReferences((current) =>
      current.filter((reference) =>
        reference.relativePath.trim().replaceAll('\\', '/').replace(/\/+/g, '/').toLowerCase() !== key
      )
    )
  }

  function openWorkspaceFilePreviewTarget(target: WorkspaceFileTarget): void {
    const nextTarget = {
      ...target,
      workspaceRoot: target.workspaceRoot ?? fileTreeWorkspaceRoot
    }
    if (!nextTarget.workspaceRoot) return
    setOpenFilePreviewTargets((current) => {
      const key = workspaceFileTargetKey(nextTarget)
      if (current.some((item) => workspaceFileTargetKey(item) === key)) return current
      return [...current, nextTarget]
    })
    setFilePreviewTarget(nextTarget)
    setRightSidebarWidth((width) => Math.max(width, CODE_PANEL_PREFERRED))
    setRightPanelMode('file')
  }

  function previewWorkspaceFileFromSidebar(path: string): void {
    const workspace = fileTreeWorkspaceRoot
    if (!workspace) return
    openWorkspaceFilePreviewTarget({ path, workspaceRoot: workspace })
  }

  function closeWorkspaceFilePreviewTarget(target: WorkspaceFileTarget): void {
    const closingKey = workspaceFileTargetKey(target)
    setOpenFilePreviewTargets((current) => {
      const index = current.findIndex((item) => workspaceFileTargetKey(item) === closingKey)
      if (index < 0) return current
      const next = current.filter((_, itemIndex) => itemIndex !== index)
      if (workspaceFileTargetKey(filePreviewTarget) === closingKey) {
        const fallback = next[Math.max(0, index - 1)] ?? next[0] ?? null
        setFilePreviewTarget(fallback)
        if (!fallback) setRightPanelMode(null)
      }
      return next
    })
  }

  function addWorkspaceReferenceFromSidebar(reference: ChatFileTreeReference): void {
    addComposerFileReference(reference)
  }

  function toggleFileTreeSidePanel(): void {
    setFileTreeSidePanelOpen((open) => !open)
  }

  function openFileTreeSidePanel(): void {
    setFileTreeSidePanelView('workspace')
    setFileTreeSidePanelOpen(true)
  }

  function openDesignFileTreeSidePanel(): void {
    setFileTreeSidePanelView('design')
    setFileTreeSidePanelOpen(true)
  }

  function clearFilePreviewTargets(): void {
    setOpenFilePreviewTargets([])
    setFilePreviewTarget(null)
  }

  useEffect(() => {
    if (rightPanelMode !== 'file' || !filePreviewTarget) return
    setOpenFilePreviewTargets((current) => {
      const key = workspaceFileTargetKey(filePreviewTarget)
      if (current.some((item) => workspaceFileTargetKey(item) === key)) return current
      return [...current, filePreviewTarget]
    })
  }, [filePreviewTarget, rightPanelMode])

  useEffect(() => {
    if (route !== 'chat') setComposerFileReferences([])
  }, [route])

  return {
    composerFileReferences,
    fileTreeSidePanelOpen,
    fileTreeSidePanelView,
    openFilePreviewTargets,
    fileTreeWorkspaceRoot,
    clearComposerFileReferences,
    addComposerFileReference,
    pickComposerFileReferences,
    removeComposerFileReference,
    openWorkspaceFilePreviewTarget,
    previewWorkspaceFileFromSidebar,
    closeWorkspaceFilePreviewTarget,
    addWorkspaceReferenceFromSidebar,
    toggleFileTreeSidePanel,
    openFileTreeSidePanel,
    openDesignFileTreeSidePanel,
    setFileTreeSidePanelView,
    clearFilePreviewTargets
  }
}
