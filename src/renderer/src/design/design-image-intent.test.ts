import { describe, expect, it } from 'vitest'
import { looksLikeStandaloneImageAssetPrompt } from './design-image-intent'

describe('looksLikeStandaloneImageAssetPrompt', () => {
  it('keeps logo/icon/illustration requests on the image asset lane', () => {
    expect(looksLikeStandaloneImageAssetPrompt('设计一个 IKUN 品牌 logo，金色金属质感')).toBe(true)
    expect(looksLikeStandaloneImageAssetPrompt('Generate a mascot sticker for the app')).toBe(true)
    expect(looksLikeStandaloneImageAssetPrompt('做一个天气应用图标')).toBe(true)
  })

  it('does not hijack page and screen design briefs', () => {
    expect(looksLikeStandaloneImageAssetPrompt('设计一个带 logo 的 landing page')).toBe(false)
    expect(looksLikeStandaloneImageAssetPrompt('做一个商品详情页面，里面需要图片')).toBe(false)
    expect(looksLikeStandaloneImageAssetPrompt('Create a dashboard mockup with product photos')).toBe(false)
  })

  it('treats plain image generation as an asset when no screen is requested', () => {
    expect(looksLikeStandaloneImageAssetPrompt('生成一张科技感背景图片')).toBe(true)
    expect(looksLikeStandaloneImageAssetPrompt('create a poster for the launch')).toBe(true)
  })
})
