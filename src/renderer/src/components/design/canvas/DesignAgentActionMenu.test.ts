import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { DesignAgentAction } from '../../../design/agent-actions/design-agent-actions'
import { DesignAgentActionMenu } from './DesignAgentActionMenu'

const action: DesignAgentAction = {
  id: 'explore-directions',
  labelKey: 'designAgentActionExploreDirections',
  detailKey: 'designAgentActionExploreDirectionsDetail',
  intentMode: 'generate',
  prompt: 'Explore directions'
}

describe('DesignAgentActionMenu', () => {
  it('opens toward the canvas instead of the right rail', () => {
    const html = renderToStaticMarkup(
      createElement(DesignAgentActionMenu, {
        open: true,
        actions: [action],
        buttonClassName: 'button-base',
        buttonActiveClassName: 'button-active',
        buttonInactiveClassName: 'button-inactive',
        onToggle: () => {},
        onSelect: () => {}
      })
    )

    expect(html).toContain('right-12')
    expect(html).not.toContain('left-12')
    expect(html).toContain('designAgentActionExploreDirections')
  })
})
