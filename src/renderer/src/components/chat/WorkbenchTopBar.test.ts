import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../i18n'
import { WorkbenchSideRail } from './WorkbenchTopBar'

describe('WorkbenchSideRail', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('renders visible tooltip labels for right rail icon buttons', () => {
    const html = renderToStaticMarkup(
      createElement(WorkbenchSideRail, {
        rightPanelMode: null,
        onToggleRightPanelMode: vi.fn(),
        planPanelEnabled: true,
        canvasEnabled: true,
        terminalOpen: false,
        onToggleTerminal: vi.fn(),
        sideChatCount: 0,
        sideChatRunningCount: 0,
        sideChatOpen: false,
        sideChatEnabled: true,
        fileTreeOpen: false,
        fileTreeEnabled: true,
        onToggleFileTree: vi.fn(),
        onOpenSideChat: vi.fn()
      })
    )

    for (const label of [
      'Choose default editor',
      'Open branch conversation',
      'Todo',
      'Plan',
      'Changes',
      'Terminal',
      'Preview',
      'Whiteboard',
      'Subagents',
      'Files'
    ]) {
      expect(html).toContain(`data-tooltip="${label}"`)
      expect(html).toContain(`title="${label}"`)
    }

    expect(html.match(/ds-side-rail-button/g)?.length).toBeGreaterThanOrEqual(10)
  })
})
