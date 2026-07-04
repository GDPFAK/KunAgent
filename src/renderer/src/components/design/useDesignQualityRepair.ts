import { useCallback, useEffect, useRef } from 'react'
import {
  type DesignRuntimeQualityPayload
} from '../../design/design-html-quality'
import {
  requestDesignQualityRepairDispatch,
  type DesignPromptSource,
  type DesignQualityRepairMode
} from '../../design/design-quality-repair-dispatch'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'

export type DesignQualityRepairHookOptions = {
  route: string
  runtimeConnection: string
  busy: boolean
  sendDesignPrompt: (
    prompt: string,
    options: { displayText?: string; source?: DesignPromptSource; screenShapeId?: string }
  ) => void
}

export type DesignQualityRepairHookState = {
  clearDesignAutoRepairScope: (scopeKey: string) => void
  handleDesignRuntimeQualityFindings: (payload: DesignRuntimeQualityPayload) => void
  handleDesignQualityRepairRequest: (payload: DesignRuntimeQualityPayload) => void
}

export function useDesignQualityRepair({
  route,
  runtimeConnection,
  busy,
  sendDesignPrompt
}: DesignQualityRepairHookOptions): DesignQualityRepairHookState {
  const autoRepairSentRef = useRef<Set<string>>(new Set())
  const pendingTimersRef = useRef<Map<string, number>>(new Map())
  const manualLastSentRef = useRef<Map<string, number>>(new Map())
  const runtimeStateRef = useRef({ route, runtimeConnection, busy })
  runtimeStateRef.current = { route, runtimeConnection, busy }

  useEffect(
    () => () => {
      for (const timer of pendingTimersRef.current.values()) {
        window.clearTimeout(timer)
      }
      pendingTimersRef.current.clear()
    },
    []
  )

  const clearDesignAutoRepairScope = useCallback((scopeKey: string): void => {
    if (!scopeKey) return
    autoRepairSentRef.current.delete(scopeKey)
    const pending = pendingTimersRef.current.get(scopeKey)
    if (pending) {
      window.clearTimeout(pending)
      pendingTimersRef.current.delete(scopeKey)
    }
  }, [])

  const requestDesignQualityRepair = useCallback((
    payload: DesignRuntimeQualityPayload,
    findings: DesignRuntimeQualityPayload['findings'],
    mode: DesignQualityRepairMode
  ): void => {
    requestDesignQualityRepairDispatch({
      payload,
      findings,
      mode,
      autoRepairSentRef,
      pendingTimersRef,
      manualLastSentRef,
      runtimeState: () => ({
        route: runtimeStateRef.current.route,
        runtimeConnection: runtimeStateRef.current.runtimeConnection,
        busy: runtimeStateRef.current.busy,
        pagesRunActive: Boolean(useDesignWorkspaceStore.getState().pagesRun)
      }),
      sendDesignPrompt
    })
  }, [sendDesignPrompt])

  const handleDesignRuntimeQualityFindings = useCallback((payload: DesignRuntimeQualityPayload): void => {
    void payload
    // Runtime quality checks are advisory. Do not send repair prompts without an
    // explicit user click; unexpected design edits are more disruptive than a
    // quality badge waiting for review.
  }, [])

  const handleDesignQualityRepairRequest = useCallback((payload: DesignRuntimeQualityPayload): void => {
    requestDesignQualityRepair(payload, payload.findings, 'manual')
  }, [requestDesignQualityRepair])

  return {
    clearDesignAutoRepairScope,
    handleDesignRuntimeQualityFindings,
    handleDesignQualityRepairRequest
  }
}
