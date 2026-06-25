import { describe, expect, it } from 'vitest'
import { chatBlocksContainImageAttachments, isChatAttachmentUploadEnabled } from './attachment-upload-availability'
import type { ChatBlock } from '../agent/types'

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

describe('chatBlocksContainImageAttachments', () => {
  it('does not lock model switching for pure text user turns', () => {
    expect(chatBlocksContainImageAttachments([
      { kind: 'user', id: 'u1', text: 'hello' }
    ] as ChatBlock[])).toBe(false)
  })

  it('does not treat document attachments as image context', () => {
    expect(chatBlocksContainImageAttachments([
      {
        kind: 'user',
        id: 'u1',
        text: 'read this',
        meta: {
          attachments: [{
            id: 'doc1',
            kind: 'document',
            name: 'paper.pdf',
            mimeType: 'application/pdf'
          }]
        }
      }
    ] as ChatBlock[])).toBe(false)
  })

  it('detects image attachments from kind, mime type, or preview metadata', () => {
    expect(chatBlocksContainImageAttachments([
      {
        kind: 'user',
        id: 'u1',
        text: 'look',
        meta: { attachments: [{ id: 'img1', kind: 'image' }] }
      }
    ] as ChatBlock[])).toBe(true)

    expect(chatBlocksContainImageAttachments([
      {
        kind: 'user',
        id: 'u2',
        text: 'look',
        meta: { attachments: [{ id: 'img2', mimeType: 'image/png' }] }
      }
    ] as ChatBlock[])).toBe(true)

    expect(chatBlocksContainImageAttachments([
      {
        kind: 'user',
        id: 'u3',
        text: 'look',
        meta: { attachments: [{ id: 'img3', previewUrl: 'data:image/png;base64,abc' }] }
      }
    ] as ChatBlock[])).toBe(true)
  })
})
