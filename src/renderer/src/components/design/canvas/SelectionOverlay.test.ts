import { describe, expect, it } from 'vitest'
import { createHtmlFrameShape } from '../../../design/canvas/canvas-types'
import type { DesignArtifact } from '../../../design/design-types'
import { applyPendingHtmlFrameAspectResize } from './SelectionOverlay'

function artifact(patch: Partial<DesignArtifact> = {}): DesignArtifact {
  const createdAt = '2026-06-20T00:00:00.000Z'
  return {
    id: 'screen',
    kind: 'html',
    title: 'Screen',
    relativePath: '.kun-design/screen/v1.html',
    createdAt,
    updatedAt: createdAt,
    versions: [{ id: 'screen-v1', relativePath: '.kun-design/screen/v1.html', createdAt, summary: '' }],
    ...patch
  }
}

describe('SelectionOverlay HTML frame resize helpers', () => {
  it('uses target aspect height for a pending screen during horizontal resize', () => {
    const shape = createHtmlFrameShape('Screen', 40, 60, 'screen', 'desktop')
    shape.width = 900
    shape.height = 180

    expect(
      applyPendingHtmlFrameAspectResize({
        handle: 'e',
        bounds: { x: 40, y: 60, width: 960, height: 180 },
        shape,
        artifact: artifact({ previewStatus: 'pending' }),
        designTarget: 'web',
        singleSelection: true
      })
    ).toEqual({ x: 40, y: 60, width: 960, height: 600 })
  })

  it('leaves settled screens content-sized during horizontal resize', () => {
    const shape = createHtmlFrameShape('Screen', 40, 60, 'screen', 'desktop')
    shape.width = 900
    shape.height = 260

    expect(
      applyPendingHtmlFrameAspectResize({
        handle: 'e',
        bounds: { x: 40, y: 60, width: 960, height: 260 },
        shape,
        artifact: artifact({ previewStatus: 'ready' }),
        designTarget: 'web',
        singleSelection: true
      })
    ).toEqual({ x: 40, y: 60, width: 960, height: 260 })
  })
})
