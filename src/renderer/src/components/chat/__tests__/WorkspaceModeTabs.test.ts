import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n'
import { WorkspaceModeTabs } from '../WorkspaceModeTabs'

describe('WorkspaceModeTabs', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  function props(activeView: 'chat' | 'write' | 'design' = 'chat') {
    return {
      activeView,
      onCodeOpen: vi.fn(),
      onWriteOpen: vi.fn(),
      onDesignOpen: vi.fn()
    }
  }

  it('renders three tab buttons', () => {
    const html = renderToStaticMarkup(createElement(WorkspaceModeTabs, props()))

    expect(html).toContain('Code')
    expect(html).toContain('Write')
    expect(html).toContain('Design')
    expect(html.match(/role="tab"/g)?.length).toBe(3)
  })

  it('uses horizontal row layout not vertical column', () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceModeTabs, props())
    )

    // Container should have flex-row, not flex-col
    expect(html).toContain('flex-row')
    expect(html).not.toContain('flex-col')
  })

  it('buttons use flex-1 for equal width instead of w-full', () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceModeTabs, props())
    )

    const flex1Matches = html.match(/flex-1/g)
    expect(flex1Matches?.length).toBe(3)
  })

  it('marks active button with aria-selected true', () => {
    for (const activeView of ['chat', 'write', 'design'] as const) {
      const html = renderToStaticMarkup(createElement(WorkspaceModeTabs, props(activeView)))
      expect(html.match(/aria-selected="true"/g)?.length).toBe(1)
      expect(html.match(/aria-selected="false"/g)?.length).toBe(2)
    }
  })

  it('preserves truncate class on button text for narrow sidebars', () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceModeTabs, props())
    )

    const truncateMatches = html.match(/truncate/g)
    expect(truncateMatches?.length).toBe(3)
  })

  it('preserves min-w-0 on buttons for flex truncation', () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceModeTabs, props())
    )

    // min-w-0 must be present to allow truncate to work in flex children
    expect(html).toContain('min-w-0')
  })

  it('renders role="tablist" container with descriptive aria-label', () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceModeTabs, props())
    )

    expect(html).toContain('role="tablist"')
    expect(html).toContain('Code / Write / Design')
  })

  it('does not render secondary switches in the sidebar mode tabs', () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceModeTabs, props())
    )

    expect(html).not.toContain('role="switch"')
    expect(html.match(/role="tab"/g)?.length).toBe(3)
  })
})
