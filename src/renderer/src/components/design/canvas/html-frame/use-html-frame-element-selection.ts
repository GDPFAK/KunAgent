import { useCallback, useEffect, useRef, useState } from 'react'
import type { DesignHtmlPreviewHostRenderProps } from '../../DesignHtmlPreviewHost'
import type { DesignHtmlElementContext } from '../../../../design/design-composer-context'
import type { DesignArtifact } from '../../../../design/design-types'
import { htmlFrameShouldClearElementContextOnEditingChange } from './html-frame-helpers'

type SelectedElementRect = {
  left: number
  top: number
  width: number
  height: number
}

type HtmlFrameElementSelectionOptions = {
  artifact?: DesignArtifact
  canvasWidth: number
  canvasHeight: number
  editing: boolean
  executeScript: DesignHtmlPreviewHostRenderProps['executeScript']
  interactive: boolean
  shapeId: string
  setFileError: (message: string) => void
  setLocalPreviewError: (message: string) => void
  onUseElementAsContext?: (context: DesignHtmlElementContext | null, promptSeed?: string) => void
}

export function useHtmlFrameElementSelection({
  artifact,
  canvasWidth,
  canvasHeight,
  editing,
  executeScript,
  interactive,
  shapeId,
  setFileError,
  setLocalPreviewError,
  onUseElementAsContext
}: HtmlFrameElementSelectionOptions): {
  selectedElementRect: SelectedElementRect | null
  selectedElementContext: DesignHtmlElementContext | null
  selectElementAt: (event: React.PointerEvent<HTMLDivElement>) => void
  updateSelectedElementText: (text: string, html?: string) => void
} {
  const [selectedElementRect, setSelectedElementRect] = useState<SelectedElementRect | null>(null)
  const [selectedElementContext, setSelectedElementContext] =
    useState<DesignHtmlElementContext | null>(null)
  const latestEditingRef = useRef(editing)
  const onUseElementAsContextRef = useRef(onUseElementAsContext)

  useEffect(() => {
    onUseElementAsContextRef.current = onUseElementAsContext
  }, [onUseElementAsContext])

  const selectElementAt = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      if (!editing || interactive || !artifact) return
      event.preventDefault()
      event.stopPropagation()
      const rect = event.currentTarget.getBoundingClientRect()
      const x = rect.width > 0 ? ((event.clientX - rect.left) / rect.width) * canvasWidth : 0
      const y = rect.height > 0 ? ((event.clientY - rect.top) / rect.height) * canvasHeight : 0
      const selectionQuery = executeScript(`(() => {
        try {
          const x = ${JSON.stringify(x)}
          const y = ${JSON.stringify(y)}
          const escapeCss = (value) => {
            if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value)
            return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\\\$&')
          }
          const selectorFor = (element) => {
            if (!element || element.nodeType !== Node.ELEMENT_NODE) return ''
            if (element.id) return '#' + escapeCss(element.id)
            const parts = []
            let current = element
            while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.documentElement) {
              const tag = current.tagName.toLowerCase()
              if (tag === 'body') {
                parts.unshift('body')
                break
              }
              let index = 1
              let sibling = current.previousElementSibling
              while (sibling) {
                if (sibling.tagName === current.tagName) index += 1
                sibling = sibling.previousElementSibling
              }
              parts.unshift(tag + ':nth-of-type(' + index + ')')
              current = current.parentElement
            }
            return parts.join(' > ')
          }
          const element = document.elementFromPoint(x, y)
          if (!element || element === document.documentElement || element === document.body) {
            return { ok: false, message: 'No editable element at this point.' }
          }
          const bounds = element.getBoundingClientRect()
          return {
            ok: true,
            selector: selectorFor(element),
            tagName: element.tagName,
            text: (element.innerText || element.textContent || '').trim().slice(0, 500),
            html: element.outerHTML.slice(0, 1400),
            rect: {
              left: Math.round(bounds.left),
              top: Math.round(bounds.top),
              width: Math.round(bounds.width),
              height: Math.round(bounds.height)
            }
          }
        } catch (error) {
          return {
            ok: false,
            message: error instanceof Error ? error.message : String(error)
          }
        }
        })()`)
      if (!selectionQuery) return
      void selectionQuery
        .then((value) => {
          if (!value || typeof value !== 'object') return
          const result = value as {
            ok?: unknown
            message?: unknown
            selector?: unknown
            tagName?: unknown
            text?: unknown
            html?: unknown
            rect?: unknown
          }
          if (!result.ok) {
            if (typeof result.message === 'string') setLocalPreviewError(result.message)
            setSelectedElementRect(null)
            setSelectedElementContext(null)
            onUseElementAsContext?.(null)
            return
          }
          const resultRect = result.rect as SelectedElementRect | undefined
          if (
            typeof result.selector !== 'string' ||
            typeof result.tagName !== 'string' ||
            typeof result.text !== 'string' ||
            typeof result.html !== 'string' ||
            !resultRect ||
            typeof resultRect.left !== 'number' ||
            typeof resultRect.top !== 'number' ||
            typeof resultRect.width !== 'number' ||
            typeof resultRect.height !== 'number'
          ) {
            return
          }
          setLocalPreviewError('')
          setSelectedElementRect(resultRect)
          const context = {
            artifactId: artifact.id,
            artifactTitle: artifact.title,
            artifactRelativePath: artifact.relativePath,
            selector: result.selector,
            tagName: result.tagName,
            text: result.text,
            html: result.html
          }
          setSelectedElementContext(context)
          onUseElementAsContext?.(context)
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error)
          setLocalPreviewError(message)
          setFileError(message)
        })
    },
    [
      artifact,
      canvasHeight,
      canvasWidth,
      editing,
      executeScript,
      interactive,
      onUseElementAsContext,
      setFileError,
      setLocalPreviewError
    ]
  )

  useEffect(() => {
    setLocalPreviewError('')
    setSelectedElementRect(null)
    setSelectedElementContext(null)
  }, [artifact?.id, artifact?.relativePath, setLocalPreviewError, shapeId])

  useEffect(() => {
    const wasEditing = latestEditingRef.current
    latestEditingRef.current = editing
    if (!htmlFrameShouldClearElementContextOnEditingChange({ wasEditing, editing })) return
    setSelectedElementRect(null)
    setSelectedElementContext(null)
    onUseElementAsContextRef.current?.(null)
  }, [editing])

  const updateSelectedElementText = useCallback((text: string, html?: string): void => {
    setSelectedElementContext((current) => {
      if (!current) return current
      const next = { ...current, text, ...(html !== undefined ? { html } : {}) }
      onUseElementAsContextRef.current?.(next)
      return next
    })
  }, [])

  useEffect(
    () => () => {
      if (latestEditingRef.current) onUseElementAsContextRef.current?.(null)
    },
    []
  )

  return { selectedElementRect, selectedElementContext, selectElementAt, updateSelectedElementText }
}
