import { useTranslation } from 'react-i18next'
import type { ClipboardImageReadResult } from '@shared/workspace-file'
import type { AttachmentReference } from '../../agent/types'
import { getProvider } from '../../agent/registry'
import {
  prepareImageAttachmentUpload,
  type ImageAttachmentUploadCapabilities
} from '../../lib/image-attachment-upload'
import type {
  ComposerAttachmentScope,
  ComposerAttachmentUpdater
} from '../workbench-composer-attachments'

export type WorkbenchAttachmentControllerOptions = {
  attachmentUploadEnabled: boolean
  selectedModelSupportsImageInput: boolean
  attachmentCapabilities?: ImageAttachmentUploadCapabilities
  activeThreadId: string | null
  setAttachmentUploadBusy: (busy: boolean) => void
  setAttachmentUploadError: (error: string | null) => void
  setComposerAttachmentsForScope: (
    scope: ComposerAttachmentScope,
    updater: ComposerAttachmentUpdater
  ) => void
  setComposerAttachments: (updater: ComposerAttachmentUpdater) => void
  getAttachmentScope: () => ComposerAttachmentScope
  getActiveWorkspace: () => string | undefined
  createFile: (dataBase64: string, name: string, mimeType: string) => File
}

function fileNameFromPath(path: string): string {
  return path.replaceAll('\\', '/').split('/').filter(Boolean).pop() || 'image'
}

function isPdfAttachmentFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

function clipboardImageToFile(
  image: Extract<ClipboardImageReadResult, { ok: true }>,
  createFile: WorkbenchAttachmentControllerOptions['createFile']
): File {
  return createFile(image.dataBase64, image.name, image.mimeType)
}

export function useWorkbenchAttachmentController({
  attachmentUploadEnabled,
  selectedModelSupportsImageInput,
  attachmentCapabilities,
  activeThreadId,
  setAttachmentUploadBusy,
  setAttachmentUploadError,
  setComposerAttachmentsForScope,
  setComposerAttachments,
  getAttachmentScope,
  getActiveWorkspace,
  createFile
}: WorkbenchAttachmentControllerOptions) {
  const { t } = useTranslation()

  async function handlePickAttachments(
    files: File[],
    options: { localFilePaths?: string[] } = {}
  ): Promise<void> {
    if (!files.length || !attachmentUploadEnabled) return
    const provider = getProvider()
    const attachmentScope = getAttachmentScope()
    setAttachmentUploadBusy(true)
    setAttachmentUploadError(null)
    try {
      const workspace = getActiveWorkspace()
      const uploaded: AttachmentReference[] = []
      for (const [index, file] of files.entries()) {
        const localFilePath =
          options.localFilePaths?.[index] ||
          (typeof window.kunGui?.getPathForFile === 'function' ? window.kunGui.getPathForFile(file) : '')
        if (isPdfAttachmentFile(file)) {
          if (!localFilePath || typeof window.kunGui?.readLocalPdfText !== 'function') {
            throw new Error(t('composerPdfAttachmentUnavailable'))
          }
          if (!attachmentCapabilities || typeof provider.uploadAttachment !== 'function') {
            throw new Error(t('composerAttachmentUnavailable'))
          }
          const result = await window.kunGui.readLocalPdfText({ path: localFilePath })
          if (!result.ok) throw new Error(result.message)
          const documentText = result.text.trim()
          if (!documentText) throw new Error(t('composerPdfAttachmentNoText'))
          const attachment = await provider.uploadAttachment({
            name: file.name || fileNameFromPath(result.path),
            mimeType: 'application/pdf',
            dataBase64: arrayBufferToBase64(await file.arrayBuffer()),
            documentText,
            pageCount: result.pageCount,
            localFilePath,
            ...(activeThreadId ? { threadId: activeThreadId } : {}),
            ...(workspace ? { workspace } : {})
          })
          uploaded.push({
            id: attachment.id,
            kind: 'document',
            name: attachment.name,
            mimeType: attachment.mimeType,
            byteSize: attachment.byteSize,
            pageCount: attachment.pageCount,
            truncated: attachment.truncated,
            textPreview: documentText.slice(0, 240)
          })
          continue
        }
        if (!file.type.startsWith('image/')) {
          throw new Error(t('composerAttachmentUnsupportedType'))
        }
        if (!selectedModelSupportsImageInput) {
          throw new Error(t('composerAttachmentModelUnsupported'))
        }
        if (!attachmentCapabilities || typeof provider.uploadAttachment !== 'function') {
          throw new Error(t('composerAttachmentUnavailable'))
        }
        const prepared = await prepareImageAttachmentUpload(file, attachmentCapabilities)
        const attachment = await provider.uploadAttachment({
          name: file.name || 'image',
          mimeType: prepared.mimeType,
          dataBase64: prepared.dataBase64,
          ...(localFilePath ? { localFilePath } : {}),
          textFallback: prepared.textFallback,
          ...(activeThreadId ? { threadId: activeThreadId } : {}),
          ...(workspace ? { workspace } : {})
        })
        uploaded.push({
          id: attachment.id,
          kind: 'image',
          name: attachment.name,
          mimeType: attachment.mimeType,
          width: attachment.width,
          height: attachment.height,
          previewUrl: `data:${prepared.mimeType};base64,${prepared.dataBase64}`
        })
      }
      if (uploaded.length > 0) {
        setComposerAttachmentsForScope(attachmentScope, (current) => {
          const byId = new Map(current.map((attachment) => [attachment.id, attachment]))
          for (const attachment of uploaded) {
            byId.set(attachment.id, attachment)
          }
          return [...byId.values()]
        })
      }
    } catch (error) {
      setAttachmentUploadError(error instanceof Error ? error.message : String(error))
    } finally {
      setAttachmentUploadBusy(false)
    }
  }

  function removeComposerAttachment(id: string): void {
    setComposerAttachments((current) => current.filter((attachment) => attachment.id !== id))
  }

  async function handlePasteClipboardImage(options: { silentNoImage?: boolean } = {}): Promise<void> {
    if (!attachmentUploadEnabled) return
    if (typeof window.kunGui?.readClipboardImage !== 'function') {
      setAttachmentUploadError(t('composerAttachmentUnavailable'))
      return
    }
    const image = await window.kunGui.readClipboardImage()
    if (!image.ok) {
      if (options.silentNoImage) return
      setAttachmentUploadError(image.message)
      return
    }
    await handlePickAttachments([clipboardImageToFile(image, createFile)], {
      localFilePaths: [image.localFilePath]
    })
  }

  return {
    handlePickAttachments,
    handlePasteClipboardImage,
    removeComposerAttachment
  }
}
