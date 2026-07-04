import { useCallback, useEffect, useRef } from 'react'
import type { AttachmentReference } from '../../agent/types'
import { getProvider } from '../../agent/registry'
import {
  canvasAutoAttachmentReference,
  parseCanvasImageDataUrl,
  removeCanvasAutoAttachmentById,
  selectedCanvasImageAttachmentCandidate
} from '../../design/canvas/canvas-image-auto-attachment'
import type { CanvasDocument } from '../../design/canvas/canvas-types'
import {
  prepareImageAttachmentUpload,
  type ImageAttachmentUploadCapabilities
} from '../../lib/image-attachment-upload'
import type { ComposerAttachmentUpdater } from '../workbench-composer-attachments'

export type CanvasImageAutoAttachmentOptions = {
  route: string
  selectedIds: ReadonlySet<string>
  document: CanvasDocument
  workspaceRoot: string
  activeThreadId: string | null
  attachmentCapabilities?: ImageAttachmentUploadCapabilities
  setComposerAttachmentsForScope: (
    scope: 'design',
    updater: ComposerAttachmentUpdater
  ) => void
  getActiveWorkspace: () => string | undefined
  createFile: (dataBase64: string, name: string, mimeType: string) => File
}

export type CanvasImageAutoAttachmentState = {
  clearAutoAttachment: () => void
}

export function useCanvasImageAutoAttachment(
  options: CanvasImageAutoAttachmentOptions
): CanvasImageAutoAttachmentState {
  const autoAttachmentIdRef = useRef<string | null>(null)
  const seqRef = useRef(0)
  const dynamicRef = useRef(options)
  dynamicRef.current = options

  const clearAutoAttachment = useCallback((): void => {
    const id = autoAttachmentIdRef.current
    if (id) {
      dynamicRef.current.setComposerAttachmentsForScope('design', (cur: AttachmentReference[]) =>
        removeCanvasAutoAttachmentById(cur, id)
      )
      autoAttachmentIdRef.current = null
    }
  }, [])

  useEffect(() => {
    const candidate = selectedCanvasImageAttachmentCandidate({
      route: options.route,
      selectedIds: options.selectedIds,
      document: options.document
    })
    if (!candidate) {
      clearAutoAttachment()
      return
    }

    const seq = ++seqRef.current

    void (async () => {
      try {
        let imageData = parseCanvasImageDataUrl(candidate.imageUrl)
        if (!imageData) {
          if (typeof window.kunGui?.readWorkspaceImage !== 'function') return
          const result = await window.kunGui.readWorkspaceImage({
            path: candidate.imageUrl,
            workspaceRoot: dynamicRef.current.workspaceRoot
          })
          if (!result.ok || seqRef.current !== seq) return
          imageData = parseCanvasImageDataUrl(result.dataUrl)
          if (!imageData) return
        } else {
          imageData = { ...imageData }
        }
        if (seqRef.current !== seq) return

        const provider = getProvider()
        if (typeof provider.uploadAttachment !== 'function') return
        const caps = dynamicRef.current.attachmentCapabilities
        if (!caps) return

        const file = dynamicRef.current.createFile(
          imageData.dataBase64,
          candidate.shapeName,
          imageData.mimeType
        )
        const prepared = await prepareImageAttachmentUpload(file, caps)
        if (seqRef.current !== seq) return

        const workspace = dynamicRef.current.getActiveWorkspace()
        const threadId = dynamicRef.current.activeThreadId
        const uploaded = await provider.uploadAttachment({
          name: file.name,
          mimeType: prepared.mimeType,
          dataBase64: prepared.dataBase64,
          textFallback: prepared.textFallback,
          ...(threadId ? { threadId } : {}),
          ...(workspace ? { workspace } : {})
        })
        if (seqRef.current !== seq) return

        clearAutoAttachment()
        const ref = canvasAutoAttachmentReference({ uploaded, prepared })
        dynamicRef.current.setComposerAttachmentsForScope('design', (cur) => [...cur, ref])
        autoAttachmentIdRef.current = uploaded.id
      } catch {
        // Keep canvas selection interactions quiet if an image cannot be uploaded.
      }
    })()

    return () => {
      seqRef.current += 1
    }
  }, [clearAutoAttachment, options.document, options.route, options.selectedIds])

  return { clearAutoAttachment }
}
