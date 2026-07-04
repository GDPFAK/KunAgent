import { describe, expect, it, vi } from 'vitest'
import {
  buildCodeCanvasSendOverrides,
  buildDesignTurnSendOverrides,
  type DesignTurnPromptState
} from './design-turn-dispatch'
import type { AttachmentReference } from '../agent/types'

const attachment: AttachmentReference = {
  id: 'att_image',
  kind: 'image',
  name: 'wireframe.png'
}

describe('design turn dispatch', () => {
  it('builds canvas send overrides with model, provider, reasoning, and attachments', () => {
    const promptState: DesignTurnPromptState = {
      assistantModel: ' deepseek-chat ',
      assistantProviderId: '  '
    }
    const resolveProviderId = vi.fn(() => 'deepseek')

    const overrides = buildDesignTurnSendOverrides({
      displayText: 'Create a design',
      promptState,
      resolveProviderId,
      reasoningEffort: 'medium',
      target: 'canvas',
      attachmentIds: [attachment.id],
      attachments: [attachment]
    })

    expect(overrides).toEqual({
      displayText: 'Create a design',
      model: 'deepseek-chat',
      providerId: 'deepseek',
      reasoningEffort: 'medium',
      guiDesignCanvas: true,
      attachmentIds: [attachment.id],
      attachments: [attachment]
    })
    expect(resolveProviderId).toHaveBeenCalledWith('deepseek-chat')
  })

  it('prefers an explicit provider and leaves html turns out of canvas mode', () => {
    const resolveProviderId = vi.fn(() => 'fallback')

    const overrides = buildDesignTurnSendOverrides({
      displayText: 'Refine home',
      promptState: {
        assistantModel: ' ',
        assistantProviderId: ' openai '
      },
      resolveProviderId,
      target: 'html'
    })

    expect(overrides).toEqual({
      displayText: 'Refine home',
      providerId: 'openai'
    })
    expect(resolveProviderId).not.toHaveBeenCalled()
  })

  it('builds the code-canvas overrides as a canvas agent turn', () => {
    expect(buildCodeCanvasSendOverrides({
      displayText: 'Apply markup',
      reasoningEffort: 'high'
    })).toEqual({
      displayText: 'Apply markup',
      guiDesignCanvas: true,
      reasoningEffort: 'high'
    })

    expect(buildCodeCanvasSendOverrides({})).toEqual({
      guiDesignCanvas: true
    })
  })
})
