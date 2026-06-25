import { describe, expect, it } from 'vitest'
import { isChatAttachmentUploadEnabled } from './attachment-upload-availability'

describe('isChatAttachmentUploadEnabled', () => {
  it('enables composer attachments in chat when the runtime is ready', () => {
    expect(isChatAttachmentUploadEnabled({
      runtimeConnection: 'ready',
      route: 'chat',
      mode: 'agent',
      attachmentStoreAvailable: true,
      modelSupportsImageInput: true
    })).toBe(true)
    expect(isChatAttachmentUploadEnabled({
      runtimeConnection: 'ready',
      route: 'chat',
      mode: 'plan',
      attachmentStoreAvailable: true,
      modelSupportsImageInput: true
    })).toBe(true)
  })

  it('enables composer attachments in Write mode assistants', () => {
    expect(isChatAttachmentUploadEnabled({
      runtimeConnection: 'ready',
      route: 'write',
      mode: 'agent',
      attachmentStoreAvailable: true,
      modelSupportsImageInput: true
    })).toBe(true)
  })

  it('disables composer attachments outside ready supported modes', () => {
    expect(isChatAttachmentUploadEnabled({
      runtimeConnection: 'connecting',
      route: 'chat',
      mode: 'agent',
      attachmentStoreAvailable: true,
      modelSupportsImageInput: true
    })).toBe(false)
    expect(isChatAttachmentUploadEnabled({
      runtimeConnection: 'ready',
      route: 'settings',
      mode: 'agent',
      attachmentStoreAvailable: true,
      modelSupportsImageInput: true
    })).toBe(false)
  })

  it('keeps the attachment picker reachable for non-image documents', () => {
    expect(isChatAttachmentUploadEnabled({
      runtimeConnection: 'ready',
      route: 'chat',
      mode: 'agent',
      attachmentStoreAvailable: false,
      modelSupportsImageInput: false
    })).toBe(true)
  })
})
