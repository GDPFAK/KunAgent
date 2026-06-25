import type { AttachmentReference, ChatBlock } from '../agent/types'

export type AttachmentUploadAvailabilityInput = {
  runtimeConnection: string
  route: string
  mode: 'plan' | 'agent'
  attachmentStoreAvailable?: boolean
  modelSupportsImageInput?: boolean
}

export function isChatAttachmentUploadEnabled(input: AttachmentUploadAvailabilityInput): boolean {
  return (
    input.runtimeConnection === 'ready' &&
    (input.route === 'chat' || input.route === 'write') &&
    (input.mode === 'agent' || input.mode === 'plan')
  )
}

export function chatBlocksContainImageAttachments(blocks: readonly ChatBlock[]): boolean {
  return blocks.some((block) => {
    if (block.kind !== 'user') return false
    const attachments = block.meta?.attachments
    return Array.isArray(attachments) && attachments.some(isImageAttachment)
  })
}

function isImageAttachment(attachment: AttachmentReference): boolean {
  if (attachment.kind === 'image') return true
  if (attachment.kind === 'document') return false
  if (attachment.mimeType?.toLowerCase().startsWith('image/')) return true
  return Boolean(attachment.previewUrl)
}
