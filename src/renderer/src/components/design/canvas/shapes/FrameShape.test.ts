import { describe, expect, it } from 'vitest'
import { isHtmlFramePreviewGenerating } from './FrameShape'

describe('FrameShape HTML placeholder state', () => {
  it('treats pending previews as generating', () => {
    expect(isHtmlFramePreviewGenerating('pending', undefined)).toBe(true)
  })

  it('treats queued and running parallel pages as generating', () => {
    expect(isHtmlFramePreviewGenerating('ready', 'queued')).toBe(true)
    expect(isHtmlFramePreviewGenerating('ready', 'running')).toBe(true)
  })

  it('allows the normal frame surface after previews finish', () => {
    expect(isHtmlFramePreviewGenerating('ready', undefined)).toBe(false)
    expect(isHtmlFramePreviewGenerating('ready', 'done')).toBe(false)
    expect(isHtmlFramePreviewGenerating(undefined, undefined)).toBe(false)
  })
})
