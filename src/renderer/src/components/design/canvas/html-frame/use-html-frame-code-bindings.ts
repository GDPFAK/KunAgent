import { useEffect, type RefObject } from 'react'
import { useCanvasShapeStore } from '../../../../design/canvas/canvas-shape-store'
import {
  captureHtmlFrameDomSourceSnapshot,
  htmlFrameDomSourceBindingMatches,
  type HtmlFrameDomSourceScriptExecutor
} from '../../../../design/code-binding/html-frame-dom-source'
import type { DesignHtmlPreviewWebviewElement } from '../../DesignHtmlPreviewHost'
import {
  htmlFramePreviewAsyncEpochMatches,
  type HtmlFramePreviewAsyncEpoch
} from './html-frame-helpers'

type UseHtmlFrameCodeBindingsArgs = {
  shapeId: string
  artifactId: string | undefined
  artifactKind: string | undefined
  artifactRelativePath: string | undefined
  previewWebviewUrl: string
  previewRevision: number
  webview: DesignHtmlPreviewWebviewElement | null
  webviewMountNonce: number
  executeScript: HtmlFrameDomSourceScriptExecutor
  previewAsyncEpochRef: RefObject<HtmlFramePreviewAsyncEpoch | null>
}

export function useHtmlFrameCodeBindings({
  shapeId,
  artifactId,
  artifactKind,
  artifactRelativePath,
  previewWebviewUrl,
  previewRevision,
  webview,
  webviewMountNonce,
  executeScript,
  previewAsyncEpochRef
}: UseHtmlFrameCodeBindingsArgs): void {
  const syncDomSourceBindings = useCanvasShapeStore((s) => s.syncDomSourceBindings)

  useEffect(() => {
    if (!previewWebviewUrl || artifactKind !== 'html' || !artifactId || !artifactRelativePath || !webview) return
    let cancelled = false
    let timer = 0
    const queueCapture = (): void => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (cancelled) return
        const epoch = previewAsyncEpochRef.current
        if (!epoch) return
        void captureHtmlFrameDomSourceSnapshot(executeScript)
          .then((snapshot) => {
            if (cancelled || !snapshot) return
            if (!htmlFramePreviewAsyncEpochMatches(epoch, previewAsyncEpochRef.current)) return
            const matches = htmlFrameDomSourceBindingMatches({
              shapeId,
              artifactRelativePath,
              snapshot
            })
            if (matches.length === 0) return
            syncDomSourceBindings({
              capturedAt: snapshot.capturedAt,
              matches,
              scopeDesignObjectIds: [shapeId]
            })
          })
          .catch(() => undefined)
      }, 900)
    }
    webview.addEventListener('dom-ready', queueCapture)
    webview.addEventListener('did-finish-load', queueCapture)
    queueCapture()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      webview.removeEventListener('dom-ready', queueCapture)
      webview.removeEventListener('did-finish-load', queueCapture)
    }
  }, [
    artifactId,
    artifactKind,
    artifactRelativePath,
    executeScript,
    previewAsyncEpochRef,
    previewRevision,
    previewWebviewUrl,
    shapeId,
    syncDomSourceBindings,
    webview,
    webviewMountNonce
  ])
}
