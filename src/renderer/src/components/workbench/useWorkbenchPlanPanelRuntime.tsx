import { useEffect, useState, type ReactElement } from 'react'
import type { RightPanelMode } from '../chat/WorkbenchTopBar'
import {
  WorkbenchPlanPanelOverlay,
  type WorkbenchPlanPanelProps
} from './WorkbenchPlanPanelHost'

type WorkbenchPlanPanelRuntimeOptions = {
  route: string
  activeSddDraft: boolean
  rightPanelMode: RightPanelMode | null
  activeSkillWorkspace: string
  activeThreadId: string | null
  runtimeReady: boolean
  busy: boolean
  title: string
  cancelLabel: string
  onClose: () => void
  onBuildPlan: () => void
  onVerifyPlan: () => void
  onReplanChanged: (ids: string[]) => void
  setRightPanelMode: (mode: RightPanelMode | null) => void
}

export function useWorkbenchPlanPanelRuntime({
  route,
  activeSddDraft,
  rightPanelMode,
  activeSkillWorkspace,
  activeThreadId,
  runtimeReady,
  busy,
  title,
  cancelLabel,
  onClose,
  onBuildPlan,
  onVerifyPlan,
  onReplanChanged,
  setRightPanelMode
}: WorkbenchPlanPanelRuntimeOptions): {
  planPanelInOverlay: boolean
  planPanelProps: WorkbenchPlanPanelProps
  planOverlay: ReactElement | null
} {
  const [overlayPreferred, setOverlayPreferred] = useState(false)
  const planPanelInOverlay =
    route === 'chat' && !activeSddDraft && rightPanelMode === 'plan' && overlayPreferred
  const planPanelProps: WorkbenchPlanPanelProps = {
    workspaceRoot: activeSkillWorkspace,
    activeThreadId,
    runtimeReady,
    busy,
    className: 'h-full max-h-full w-full',
    onCollapse: onClose,
    onBuildPlan,
    onVerifyPlan,
    onReplanChanged
  }

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(max-width: 900px), (orientation: portrait)')
    const sync = (): void => setOverlayPreferred(media.matches)
    sync()
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', sync)
      return () => media.removeEventListener('change', sync)
    }
    media.addListener(sync)
    return () => media.removeListener(sync)
  }, [])

  useEffect(() => {
    if (!planPanelInOverlay) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setRightPanelMode(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [planPanelInOverlay, setRightPanelMode])

  return {
    planPanelInOverlay,
    planPanelProps,
    planOverlay: (
      <WorkbenchPlanPanelOverlay
        open={planPanelInOverlay}
        title={title}
        cancelLabel={cancelLabel}
        panelProps={planPanelProps}
        onClose={onClose}
      />
    )
  }
}
