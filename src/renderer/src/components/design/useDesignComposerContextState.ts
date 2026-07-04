import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import type { CanvasDocument } from '../../design/canvas/canvas-types'
import {
  buildDesignTargetContextChip,
  designComposerContextTargetsKey,
  designContextChipsForRoute,
  isHtmlElementContextChipId,
  nextSuppressedDesignContextIds,
  reconcileDesignHtmlElementContext,
  resolveDesignComposerContextViewTargets,
  type DesignHtmlElementContext
} from '../../design/design-composer-context'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'

export type DesignComposerContextStateOptions = {
  route: string
  canvasDocument: CanvasDocument
  selectedIds: ReadonlySet<string>
  setInput: Dispatch<SetStateAction<string>>
}

export type DesignComposerContextState = {
  designContextChips: ReturnType<typeof designContextChipsForRoute>
  designContextSuppressedIds: ReadonlySet<string>
  designHtmlElementContext: DesignHtmlElementContext | null
  removeDesignContextChip: (id: string) => void
  handleDesignHtmlElementAsContext: (
    context: DesignHtmlElementContext | null,
    promptSeed?: string
  ) => void
}

export function useDesignComposerContextState({
  route,
  canvasDocument,
  selectedIds,
  setInput
}: DesignComposerContextStateOptions): DesignComposerContextState {
  const { t } = useTranslation()
  const artifacts = useDesignWorkspaceStore((s) => s.artifacts)
  const activeArtifactId = useDesignWorkspaceStore((s) => s.activeArtifactId)
  const designTarget = useDesignWorkspaceStore((s) => s.designContext.designTarget ?? 'web')
  const [suppressedIds, setSuppressedIds] = useState<Set<string>>(() => new Set())
  const [htmlElementContext, setHtmlElementContext] =
    useState<DesignHtmlElementContext | null>(null)

  const rawTargets = useMemo(
    () => resolveDesignComposerContextViewTargets({
      route,
      artifacts,
      activeArtifactId,
      canvasDocument,
      selectedIds,
      htmlElementContext
    }),
    [activeArtifactId, artifacts, canvasDocument, htmlElementContext, route, selectedIds]
  )
  const rawTargetsKey = useMemo(() => designComposerContextTargetsKey(rawTargets), [rawTargets])

  useEffect(() => {
    setSuppressedIds(new Set())
  }, [rawTargetsKey])

  useEffect(() => {
    setHtmlElementContext((current) => reconcileDesignHtmlElementContext({
      current,
      route,
      artifacts,
      activeArtifactId
    }))
  }, [activeArtifactId, artifacts, route])

  const visibleTargets = useMemo(
    () => resolveDesignComposerContextViewTargets({
      route,
      artifacts,
      activeArtifactId,
      canvasDocument,
      selectedIds,
      suppressedIds,
      htmlElementContext
    }),
    [activeArtifactId, artifacts, canvasDocument, htmlElementContext, route, selectedIds, suppressedIds]
  )
  const targetChip = useMemo(() => {
    return buildDesignTargetContextChip({
      designTarget,
      webLabel: t('designTargetWeb'),
      appLabel: t('designTargetApp'),
      detail: ({ target, width, height }) => t(
        target === 'app' ? 'designTargetContextApp' : 'designTargetContextWeb',
        { width, height }
      )
    })
  }, [designTarget, t])
  const designContextChips = useMemo(
    () => designContextChipsForRoute({
      route,
      targetChip,
      targets: visibleTargets
    }),
    [route, targetChip, visibleTargets]
  )
  const removeDesignContextChip = useCallback((id: string): void => {
    if (isHtmlElementContextChipId(id)) {
      setHtmlElementContext(null)
    }
    setSuppressedIds((current) => nextSuppressedDesignContextIds(current, id))
  }, [])
  const handleDesignHtmlElementAsContext = useCallback(
    (context: DesignHtmlElementContext | null, promptSeed?: string): void => {
      setHtmlElementContext(context)
      if (promptSeed) {
        setInput((current) => (current.trim() ? current : promptSeed))
        requestAnimationFrame(() => {
          document.querySelector<HTMLTextAreaElement>('[data-design-rail-composer] textarea')?.focus()
        })
      }
    },
    [setInput]
  )

  return {
    designContextChips,
    designContextSuppressedIds: suppressedIds,
    designHtmlElementContext: htmlElementContext,
    removeDesignContextChip,
    handleDesignHtmlElementAsContext
  }
}
