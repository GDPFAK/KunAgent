import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isAbsoluteLocalImagePath,
  loadWorkspaceImageDataUrl
} from './canvas-image-source'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('canvas image source loading', () => {
  it('does not permanently cache a failed workspace image read', async () => {
    const dataUrl = 'data:image/png;base64,ok'
    const readWorkspaceImage = vi.fn()
      .mockResolvedValueOnce({ ok: false, message: 'File not found' })
      .mockResolvedValueOnce({ ok: true, dataUrl, path: '/ws/img/flaky.png', mimeType: 'image/png', size: 2 })
    vi.stubGlobal('window', { kunGui: { readWorkspaceImage } })

    await expect(loadWorkspaceImageDataUrl('/ws', 'img/flaky-retry.png')).resolves.toBeNull()
    await expect(loadWorkspaceImageDataUrl('/ws', 'img/flaky-retry.png')).resolves.toBe(dataUrl)
    expect(readWorkspaceImage).toHaveBeenCalledTimes(2)
  })

  it('reads absolute local image paths without applying the canvas workspace boundary', async () => {
    const absolutePath = '/Users/zxy/.kun/default_workspace/.deepseekgui-images/generated.png'
    const readWorkspaceImage = vi.fn(async () => ({
      ok: true,
      dataUrl: 'data:image/png;base64,ok',
      path: absolutePath,
      mimeType: 'image/png',
      size: 2
    }))
    vi.stubGlobal('window', { kunGui: { readWorkspaceImage } })

    await expect(loadWorkspaceImageDataUrl('/Users/zxy/.kun/design-workspace', absolutePath))
      .resolves.toBe('data:image/png;base64,ok')
    expect(isAbsoluteLocalImagePath(absolutePath)).toBe(true)
    expect(readWorkspaceImage).toHaveBeenCalledWith({ path: absolutePath })
  })
})
