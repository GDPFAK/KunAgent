import { useCallback, useEffect, useRef, useState } from 'react'
import type { DesignHtmlPreviewHostRenderProps } from '../../DesignHtmlPreviewHost'
import { HtmlFrameAiCursor, type HtmlFrameAiCursor as HtmlFrameAiCursorState } from './HtmlFrameAiCursorOverlay'
import {
  AI_CURSOR_TTL_MS,
  AI_SECTION_QUERY,
  htmlFramePreviewAsyncEpochMatches,
  type HtmlFramePreviewAsyncEpoch
} from './html-frame-helpers'

type HtmlFrameAiCursorOptions = {
  executeScript: DesignHtmlPreviewHostRenderProps['executeScript']
  previewAsyncEpochRef: React.MutableRefObject<HtmlFramePreviewAsyncEpoch | null>
  previewFileUrl: string
  previewRevision: number
}

export function useHtmlFrameAiCursor({
  executeScript,
  previewAsyncEpochRef,
  previewFileUrl,
  previewRevision
}: HtmlFrameAiCursorOptions): HtmlFrameAiCursorState | null {
  const [aiCursor, setAiCursor] = useState<HtmlFrameAiCursor | null>(null)
  const aiFadeTimerRef = useRef<number>(0)
  const firstRevisionRef = useRef<number | null>(null)
  const aiCursorFileUrlRef = useRef('')

  const queryAiCursor = useCallback(() => {
    const epoch = previewAsyncEpochRef.current
    if (!epoch) return
    const query = executeScript(AI_SECTION_QUERY)
    if (!query) return
    void query
      .then((value) => {
        if (!htmlFramePreviewAsyncEpochMatches(epoch, previewAsyncEpochRef.current)) return
        if (!value || typeof value !== 'object') return
        const v = value as Record<string, unknown>
        if (
          typeof v.left !== 'number' ||
          typeof v.top !== 'number' ||
          typeof v.width !== 'number' ||
          typeof v.height !== 'number'
        ) {
          return
        }
        setAiCursor({
          label: typeof v.label === 'string' ? v.label : '',
          left: v.left,
          top: v.top,
          width: v.width,
          height: v.height
        })
        if (aiFadeTimerRef.current) window.clearTimeout(aiFadeTimerRef.current)
        aiFadeTimerRef.current = window.setTimeout(() => setAiCursor(null), AI_CURSOR_TTL_MS)
      })
      .catch(() => undefined)
  }, [executeScript, previewAsyncEpochRef])

  useEffect(() => {
    if (!previewFileUrl) {
      aiCursorFileUrlRef.current = ''
      firstRevisionRef.current = null
      setAiCursor(null)
      return
    }
    if (aiCursorFileUrlRef.current !== previewFileUrl) {
      aiCursorFileUrlRef.current = previewFileUrl
      firstRevisionRef.current = previewRevision
      setAiCursor(null)
      return
    }
    if (firstRevisionRef.current === null) {
      firstRevisionRef.current = previewRevision
      return
    }
    if (previewRevision <= firstRevisionRef.current) return
    const timer = window.setTimeout(queryAiCursor, 450)
    return () => window.clearTimeout(timer)
  }, [previewRevision, previewFileUrl, queryAiCursor])

  useEffect(
    () => () => {
      if (aiFadeTimerRef.current) window.clearTimeout(aiFadeTimerRef.current)
    },
    []
  )

  return aiCursor
}
