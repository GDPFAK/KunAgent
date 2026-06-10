import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { useChatStore } from '../store/chat-store'
import { SessionHeader } from './SessionHeader'

const initialChatState = useChatStore.getState()

describe('SessionHeader', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useChatStore.setState({
      ...initialChatState,
      workspaceLabel: 'Working directory',
      activeThreadId: 'thread-1',
      threads: [{
        id: 'thread-1',
        title: 'Fix drag region',
        updatedAt: '2026-06-10T10:00:00.000Z',
        model: 'deepseek-chat',
        mode: 'chat',
        workspace: '/workspace/deepseek-gui'
      }]
    })
  })

  afterEach(() => {
    useChatStore.setState(initialChatState)
  })

  it('keeps the compact session title area draggable in desktop shells', () => {
    const html = renderToStaticMarkup(createElement(SessionHeader, { compact: true }))

    expect(html).toContain('session-header-compact flex')
    expect(html).not.toContain('session-header-compact ds-no-drag')
    expect(html).toContain('Working directory')
  })
})
