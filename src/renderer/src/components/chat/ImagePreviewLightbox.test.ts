import { describe, expect, it } from 'vitest'
import { imagePreviewSizingStyle } from './ImagePreviewLightbox'

describe('ImagePreviewLightbox', () => {
  it('scales portrait images against the same fitted box at every zoom level', () => {
    expect(imagePreviewSizingStyle(0.75)).toEqual({
      maxWidth: '75%',
      maxHeight: '75%'
    })
    expect(imagePreviewSizingStyle(1)).toEqual({
      maxWidth: '100%',
      maxHeight: '100%'
    })
    expect(imagePreviewSizingStyle(1.25)).toEqual({
      maxWidth: '125%',
      maxHeight: '125%'
    })
  })

  it('clamps zoom sizing to the supported min and max bounds', () => {
    expect(imagePreviewSizingStyle(0.1)).toEqual({
      maxWidth: '50%',
      maxHeight: '50%'
    })
    expect(imagePreviewSizingStyle(9)).toEqual({
      maxWidth: '300%',
      maxHeight: '300%'
    })
  })
})
