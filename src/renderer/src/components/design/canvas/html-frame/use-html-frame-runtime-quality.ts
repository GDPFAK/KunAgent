import { useEffect, useRef, useState } from 'react'
import type {
  DesignHtmlPreviewHostRenderProps,
  DesignHtmlPreviewWebviewElement
} from '../../DesignHtmlPreviewHost'
import {
  buildDesignRuntimeQualityAuditScript,
  getDesignRuntimeQualityFindings,
  normalizeRuntimeQualityFindings,
  setDesignRuntimeQualityFindings,
  type DesignHtmlQualityFinding,
  type DesignRuntimeQualityPayload
} from '../../../../design/design-html-quality'
import {
  htmlFramePreviewAsyncEpochMatches,
  type HtmlFramePreviewAsyncEpoch
} from './html-frame-helpers'

type HtmlFrameRuntimeQualityOptions = {
  active: boolean
  artifactId?: string
  artifactKind?: string
  artifactRelativePath?: string
  executeScript: DesignHtmlPreviewHostRenderProps['executeScript']
  interactive: boolean
  previewAsyncEpochRef: React.MutableRefObject<HtmlFramePreviewAsyncEpoch | null>
  previewRevision: number
  previewWebviewUrl: string
  shapeId: string
  webview: DesignHtmlPreviewWebviewElement | null
  webviewMountNonce: number
  onRuntimeQualityFindings?: (payload: DesignRuntimeQualityPayload) => void
}

export function useHtmlFrameRuntimeQuality({
  active,
  artifactId,
  artifactKind,
  artifactRelativePath,
  executeScript,
  interactive,
  previewAsyncEpochRef,
  previewRevision,
  previewWebviewUrl,
  shapeId,
  webview,
  webviewMountNonce,
  onRuntimeQualityFindings
}: HtmlFrameRuntimeQualityOptions) {
  const qualitySignatureRef = useRef('')
  const [qualityChecked, setQualityChecked] = useState(false)
  const [qualityFindings, setQualityFindings] = useState<DesignHtmlQualityFinding[]>([])
  const [qualityDetailsOpen, setQualityDetailsOpen] = useState(false)

  useEffect(() => {
    qualitySignatureRef.current = ''
    setQualityChecked(false)
    setQualityFindings(getDesignRuntimeQualityFindings(artifactRelativePath))
    setQualityDetailsOpen(false)
  }, [artifactId, artifactRelativePath, shapeId])

  useEffect(() => {
    if (!active || interactive) setQualityDetailsOpen(false)
  }, [active, interactive])

  useEffect(() => {
    if (!previewWebviewUrl || artifactKind !== 'html' || !artifactId || !artifactRelativePath) return
    const wv = webview
    if (!wv) return
    let cancelled = false
    let timer = 0
    const queueAudit = (): void => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (cancelled) return
        const epoch = previewAsyncEpochRef.current
        if (!epoch) return
        const audit = executeScript(buildDesignRuntimeQualityAuditScript())
        if (!audit) return
        void audit
          .then((value) => {
            if (cancelled) return
            if (!htmlFramePreviewAsyncEpochMatches(epoch, previewAsyncEpochRef.current)) return
            const findings = normalizeRuntimeQualityFindings(value)
            setQualityChecked(true)
            setQualityFindings(findings)
            setDesignRuntimeQualityFindings(artifactRelativePath, findings)
            const signature = JSON.stringify(findings.map((finding) => [
              finding.code,
              finding.severity,
              finding.message
            ]))
            if (signature === qualitySignatureRef.current) return
            qualitySignatureRef.current = signature
            onRuntimeQualityFindings?.({
              artifactId,
              artifactRelativePath,
              shapeId,
              findings
            })
          })
          .catch(() => undefined)
      }, 750)
    }
    wv.addEventListener('dom-ready', queueAudit)
    wv.addEventListener('did-finish-load', queueAudit)
    queueAudit()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      wv.removeEventListener('dom-ready', queueAudit)
      wv.removeEventListener('did-finish-load', queueAudit)
    }
  }, [
    artifactId,
    artifactKind,
    artifactRelativePath,
    executeScript,
    onRuntimeQualityFindings,
    previewAsyncEpochRef,
    previewRevision,
    previewWebviewUrl,
    shapeId,
    webview,
    webviewMountNonce
  ])

  return {
    qualityChecked,
    qualityDetailsOpen,
    qualityFindings,
    setQualityDetailsOpen
  }
}
