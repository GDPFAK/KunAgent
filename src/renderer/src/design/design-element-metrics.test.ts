import { describe, expect, it } from 'vitest'
import { formatBoxSides, formatPx, hasVisibleFill, rgbToHex } from './design-element-metrics'

describe('rgbToHex', () => {
  it('converts rgb() to lowercase 6-char hex', () => {
    expect(rgbToHex('rgb(59, 130, 216)')).toBe('#3b82d8')
    expect(rgbToHex('rgb(0,0,0)')).toBe('#000000')
    expect(rgbToHex('rgb(255, 255, 255)')).toBe('#ffffff')
  })

  it('clamps out-of-range channels and rounds fractions', () => {
    expect(rgbToHex('rgb(300, -10, 127.6)')).toBe('#ff0080')
  })

  it('strips alpha when rgba is opaque', () => {
    expect(rgbToHex('rgba(59, 130, 216, 1)')).toBe('#3b82d8')
    expect(rgbToHex('rgba(59, 130, 216, 0.5)')).toBe('#3b82d8')
  })

  it('treats fully transparent / transparent keyword as empty', () => {
    expect(rgbToHex('rgba(59, 130, 216, 0)')).toBe('')
    expect(rgbToHex('transparent')).toBe('')
    expect(rgbToHex('')).toBe('')
    expect(rgbToHex(null)).toBe('')
    expect(rgbToHex(undefined)).toBe('')
  })

  it('canonicalizes 3-char and 8-char hex inputs', () => {
    expect(rgbToHex('#3b8')).toBe('#33bb88')
    expect(rgbToHex('#3B82D8')).toBe('#3b82d8')
    expect(rgbToHex('#3b82d8ff')).toBe('#3b82d8')
  })

  it('returns empty for unparsable colors (named, hsl, oklch)', () => {
    expect(rgbToHex('red')).toBe('')
    expect(rgbToHex('hsl(200, 50%, 50%)')).toBe('')
    expect(rgbToHex('oklch(0.7 0.1 200)')).toBe('')
  })
})

describe('formatPx', () => {
  it('renders integer pixels without a decimal point', () => {
    expect(formatPx(0)).toBe('0px')
    expect(formatPx(42)).toBe('42px')
    expect(formatPx(42.04)).toBe('42px')
  })

  it('renders one decimal when fractional', () => {
    expect(formatPx(42.6)).toBe('42.6px')
    expect(formatPx(42.9)).toBe('42.9px')
  })

  it('handles non-finite inputs', () => {
    expect(formatPx(Number.NaN)).toBe('0px')
    expect(formatPx(Number.POSITIVE_INFINITY)).toBe('0px')
  })
})

describe('formatBoxSides', () => {
  it('returns "0" for an all-zero box', () => {
    expect(formatBoxSides({ top: 0, right: 0, bottom: 0, left: 0 })).toBe('0')
  })

  it('collapses to a single value when uniform', () => {
    expect(formatBoxSides({ top: 8, right: 8, bottom: 8, left: 8 })).toBe('8px')
  })

  it('collapses to vertical/horizontal pair', () => {
    expect(formatBoxSides({ top: 8, right: 16, bottom: 8, left: 16 })).toBe('8px 16px')
  })

  it('expands to all four sides when asymmetric', () => {
    expect(formatBoxSides({ top: 4, right: 8, bottom: 12, left: 16 })).toBe('4px 8px 12px 16px')
  })
})

describe('hasVisibleFill', () => {
  it('treats opaque colors as visible', () => {
    expect(hasVisibleFill('rgb(0, 0, 0)')).toBe(true)
    expect(hasVisibleFill('#3b82d8')).toBe(true)
  })

  it('treats transparent / unparsable as not visible', () => {
    expect(hasVisibleFill('transparent')).toBe(false)
    expect(hasVisibleFill('rgba(0, 0, 0, 0)')).toBe(false)
    expect(hasVisibleFill('')).toBe(false)
  })
})
