export type AttachmentUploadAvailabilityInput = {
  runtimeConnection: string
  route: string
  mode: 'plan' | 'agent'
  attachmentStoreAvailable?: boolean
  /** @deprecated No longer checked — uploads are always allowed. The runtime
   *  auto-dispatches images to a vision model for analysis when the current
   *  model does not support image input. */
  modelSupportsImageInput?: boolean
}

export function isChatAttachmentUploadEnabled(input: AttachmentUploadAvailabilityInput): boolean {
  return (
    input.runtimeConnection === 'ready' &&
    (input.route === 'chat' || input.route === 'write' || input.route === 'design') &&
    (input.mode === 'agent' || input.mode === 'plan') &&
    input.attachmentStoreAvailable === true
    // modelSupportsImageInput is no longer required — images can be uploaded
    // to any model. The runtime auto-dispatches to a vision model for
    // analysis when needed, and falls back to text-only base64 otherwise.
  )
}
