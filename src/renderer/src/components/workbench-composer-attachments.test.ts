import { describe, expect, it } from 'vitest'
import type { AttachmentReference } from '../agent/types'
import {
  composerAttachmentScopeForSurface,
  createEmptyComposerAttachmentsByScope,
  updateComposerAttachmentsByScope
} from './workbench-composer-attachments'

function image(id: string): AttachmentReference {
  return { id, kind: 'image', name: `${id}.png`, mimeType: 'image/png' }
}

describe('workbench composer attachment scopes', () => {
  it('maps assistant surfaces to isolated attachment scopes', () => {
    expect(composerAttachmentScopeForSurface('chat', null)).toBe('chat')
    expect(composerAttachmentScopeForSurface('write', null)).toBe('write')
    expect(composerAttachmentScopeForSurface('design', null)).toBe('design')
    expect(composerAttachmentScopeForSurface('chat', 'sdd-ai')).toBe('sdd')
    expect(composerAttachmentScopeForSurface('claw', null)).toBe('inactive')
  })

  it('updates only the target scope', () => {
    const initial = createEmptyComposerAttachmentsByScope()
    const withChatImage = updateComposerAttachmentsByScope(initial, 'chat', [image('code-drawing')])
    const withDesignImage = updateComposerAttachmentsByScope(withChatImage, 'design', (current) => [
      ...current,
      image('design-canvas')
    ])

    expect(withDesignImage.chat.map((attachment) => attachment.id)).toEqual(['code-drawing'])
    expect(withDesignImage.design.map((attachment) => attachment.id)).toEqual(['design-canvas'])
    expect(withDesignImage.write).toEqual([])
    expect(withDesignImage.sdd).toEqual([])
  })
})
