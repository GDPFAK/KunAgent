import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'
import {
  DesignContextPopover,
  designContextPatchForTargetLock
} from './DesignContextPopover'

beforeEach(() => {
  useDesignWorkspaceStore.setState({
    designContext: { designTarget: 'web' },
    workspaceRoot: ''
  })
})

describe('DesignContextPopover', () => {
  it('renders disabled target buttons while design generation is locked', () => {
    const html = renderToStaticMarkup(
      createElement(DesignContextPopover, {
        open: true,
        onClose: () => {},
        designTargetDisabled: true
      })
    )

    expect(html).toContain('>Web</button>')
    expect(html).toContain('>App</button>')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('Design target switching is locked while the design agent is working')
    expect(html).toContain(
      'aria-label="Web: Default 1280 x 800 web frame. Design target switching is locked while the design agent is working"'
    )
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('keeps target buttons editable when generation is not locked', () => {
    const html = renderToStaticMarkup(
      createElement(DesignContextPopover, {
        open: true,
        onClose: () => {}
      })
    )

    expect(html).toContain('>Web</button>')
    expect(html).toContain('>App</button>')
    expect(html.match(/disabled=""/g) ?? []).toHaveLength(0)
  })

  it('preserves the current target when importing context while target switching is locked', () => {
    expect(
      designContextPatchForTargetLock(
        { designTarget: 'app', brandColor: '#2563eb', designSystemPreset: 'shadcn' },
        true
      )
    ).toEqual({ brandColor: '#2563eb', designSystemPreset: 'shadcn' })
  })

  it('allows imported context to change the target when target switching is editable', () => {
    expect(
      designContextPatchForTargetLock(
        { designTarget: 'app', brandColor: '#2563eb' },
        false
      )
    ).toEqual({ designTarget: 'app', brandColor: '#2563eb' })
  })
})
