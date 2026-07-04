import type { AttachmentReference } from '../../agent/types'
import type { PreparedImageAttachmentUpload } from '../../lib/image-attachment-upload'
import type { CanvasDocument, CanvasShape } from './canvas-types'

export type CanvasImageAutoAttachmentCandidate = {
  shapeId: string
  imageUrl: string
  shapeName: string
}

export type CanvasImageDataPayload = {
  mimeType: string
  dataBase64: string
}

export type CanvasUploadedAttachmentMetadata = {
  id: string
  name: string
  mimeType: string
  width?: number
  height?: number
}

export function selectedCanvasImageAttachmentCandidate(input: {
  route: string
  selectedIds: ReadonlySet<string>
  document: CanvasDocument
}): CanvasImageAutoAttachmentCandidate | null {
  if (input.route !== 'design') return null
  if (input.selectedIds.size !== 1) return null
  const shapeId = [...input.selectedIds][0]
  const shape: CanvasShape | undefined = input.document.objects[shapeId]
  if (!shape || shape.type !== 'image' || !shape.imageUrl) return null
  return {
    shapeId,
    imageUrl: shape.imageUrl,
    shapeName: shape.name || 'Canvas Image'
  }
}

export function parseCanvasImageDataUrl(dataUrl: string): CanvasImageDataPayload | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return {
    mimeType: match[1],
    dataBase64: match[2]
  }
}

export function canvasAutoAttachmentReference(input: {
  uploaded: CanvasUploadedAttachmentMetadata
  prepared: PreparedImageAttachmentUpload
}): AttachmentReference {
  return {
    id: input.uploaded.id,
    name: input.uploaded.name,
    mimeType: input.uploaded.mimeType,
    width: input.uploaded.width,
    height: input.uploaded.height,
    previewUrl: `data:${input.prepared.mimeType};base64,${input.prepared.dataBase64}`
  }
}

export function removeCanvasAutoAttachmentById(
  current: readonly AttachmentReference[],
  id: string | null | undefined
): AttachmentReference[] {
  return id ? current.filter((attachment) => attachment.id !== id) : [...current]
}
