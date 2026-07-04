import { useCallback } from 'react'
import type { DesignIntentMode } from '../../design/design-types'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'

type RunnableDesignAgentAction = {
  intentMode: DesignIntentMode
  prompt: string
  disabledReasonKey?: string
}

export function useDesignAgentActionRunner(
  onSeedPrompt?: (prompt: string) => void
): (action: RunnableDesignAgentAction | null) => void {
  const setDesignIntentMode = useDesignWorkspaceStore((s) => s.setDesignIntentMode)
  const setCanvasAssistantOpen = useDesignWorkspaceStore((s) => s.setCanvasAssistantOpen)
  return useCallback((action: RunnableDesignAgentAction | null): void => {
    if (!action || action.disabledReasonKey) return
    setDesignIntentMode(action.intentMode)
    setCanvasAssistantOpen(true)
    onSeedPrompt?.(action.prompt)
  }, [onSeedPrompt, setCanvasAssistantOpen, setDesignIntentMode])
}
