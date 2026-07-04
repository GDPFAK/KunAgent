import { describe, expect, it } from 'vitest'
import {
  buildPalette,
  generateRamp,
  hexToRgb,
  hslToRgb,
  RAMP_STOPS,
  rgbToHex,
  rgbToHsl,
  roleFromTokenName,
  typeScaleToRows,
  type ExtractedDesignTokens
} from './design-tokens'

describe('hex parsing + rgb<->hex', () => {
  it('parses 3-char hex', () => {
    expect(hexToRgb('#3b8')).toEqual({ r: 0x33, g: 0xbb, b: 0x88 })
  })
  it('parses 6-char hex case-insensitively', () => {
    expect(hexToRgb('#3B82D8')).toEqual({ r: 0x3b, g: 0x82, b: 0xd8 })
  })
  it('rejects garbage', () => {
    expect(hexToRgb('not-a-color')).toBeNull()
    expect(hexToRgb('')).toBeNull()
  })
  it('round-trips rgb<->hex', () => {
    const hex = '#3b82d8'
    expect(rgbToHex(hexToRgb(hex) as { r: number; g: number; b: number })).toBe(hex)
  })
  it('clamps out-of-range channels in rgbToHex', () => {
    expect(rgbToHex({ r: 300, g: -10, b: 127.6 })).toBe('#ff0080')
  })
})

describe('rgb <-> hsl', () => {
  it('returns hue=0, sat=0 for neutral grays', () => {
    const hsl = rgbToHsl({ r: 128, g: 128, b: 128 })
    expect(hsl.s).toBe(0)
  })
  it('round-trips a saturated color within 1 channel', () => {
    const rgb = { r: 59, g: 130, b: 216 }
    const back = hslToRgb(rgbToHsl(rgb))
    expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(1)
    expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(1)
    expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(1)
  })
})

describe('generateRamp', () => {
  it('emits one stop per RAMP_STOPS', () => {
    const ramp = generateRamp('#3b82d8')
    expect(ramp.map((s) => s.stop)).toEqual([...RAMP_STOPS])
  })
  it('includes the base color exactly once and lowercased', () => {
    const ramp = generateRamp('#3B82D8')
    const bases = ramp.filter((s) => s.isBase)
    expect(bases).toHaveLength(1)
    expect(bases[0].hex).toBe('#3b82d8')
  })
  it('is deterministic — same input, same ramp', () => {
    expect(generateRamp('#3b82d8')).toEqual(generateRamp('#3b82d8'))
  })
  it('returns [] for invalid input', () => {
    expect(generateRamp('not-a-color')).toEqual([])
  })
  it('lightens toward 50 and darkens toward 900', () => {
    const ramp = generateRamp('#3b82d8')
    const r50 = ramp.find((s) => s.stop === 50)!
    const r900 = ramp.find((s) => s.stop === 900)!
    const l50 = rgbToHsl(hexToRgb(r50.hex)!).l
    const l900 = rgbToHsl(hexToRgb(r900.hex)!).l
    expect(l50).toBeGreaterThan(0.8)
    expect(l900).toBeLessThan(0.2)
  })
})

describe('roleFromTokenName', () => {
  it('maps name patterns to canonical roles', () => {
    expect(roleFromTokenName('--primary')).toBe('primary')
    expect(roleFromTokenName('--accent')).toBe('primary')
    expect(roleFromTokenName('--brand-500')).toBe('primary')
    expect(roleFromTokenName('--secondary')).toBe('secondary')
    expect(roleFromTokenName('--tertiary')).toBe('tertiary')
    expect(roleFromTokenName('--text-primary')).toBe('neutral')
    expect(roleFromTokenName('--surface')).toBe('neutral')
    expect(roleFromTokenName('--bg')).toBe('neutral')
    expect(roleFromTokenName('--border')).toBe('neutral')
  })
  it('returns "other" when nothing matches', () => {
    expect(roleFromTokenName('--something-weird')).toBe('other')
  })
})

describe('buildPalette', () => {
  function makeExtracted(colors: { name: string; value: string }[]): ExtractedDesignTokens {
    return {
      colors: colors.map((c) => ({ ...c, role: roleFromTokenName(c.name) })),
      fonts: [], radii: [], spacing: [], typeScale: [], sampledColors: [], title: ''
    }
  }

  it('assigns named roles directly', () => {
    const palette = buildPalette(makeExtracted([
      { name: '--accent', value: '#3b82d8' },
      { name: '--surface', value: '#ffffff' }
    ]))
    expect(palette.primary?.base).toBe('#3b82d8')
    expect(palette.neutral?.base).toBe('#ffffff')
    expect(palette.secondary).toBeUndefined()
  })

  it('falls back to ordering for unnamed colors', () => {
    const palette = buildPalette(makeExtracted([
      { name: '--something-weird', value: '#3b82d8' },
      { name: '--other-thing', value: '#7e57c2' },
      { name: '--third-thing', value: '#43a047' }
    ]))
    expect(palette.primary?.base).toBe('#3b82d8')
    expect(palette.secondary?.base).toBe('#7e57c2')
    expect(palette.tertiary?.base).toBe('#43a047')
  })

  it('does not overwrite a slot once claimed', () => {
    const palette = buildPalette(makeExtracted([
      { name: '--primary', value: '#3b82d8' },
      { name: '--accent', value: '#ff0000' }
    ]))
    expect(palette.primary?.base).toBe('#3b82d8')
  })
})

describe('typeScaleToRows', () => {
  it('sorts large-to-small and labels by size buckets', () => {
    const rows = typeScaleToRows([
      { sample: 'p', fontSize: '16px', fontWeight: '400', lineHeight: '24px', fontFamily: 'Inter' },
      { sample: 'h1', fontSize: '40px', fontWeight: '800', lineHeight: '48px', fontFamily: 'Inter' },
      { sample: 'small', fontSize: '12px', fontWeight: '400', lineHeight: '16px', fontFamily: 'Inter' },
      { sample: 'h2', fontSize: '24px', fontWeight: '700', lineHeight: '32px', fontFamily: 'Inter' }
    ])
    expect(rows.map((r) => r.sample)).toEqual(['h1', 'h2', 'p', 'small'])
    expect(rows.map((r) => r.label)).toEqual(['Display', 'H2', 'Body', 'Caption'])
  })

  it('dedupes entries with the same size+weight', () => {
    const rows = typeScaleToRows([
      { sample: 'p', fontSize: '16px', fontWeight: '400', lineHeight: '24px', fontFamily: 'Inter' },
      { sample: 'span', fontSize: '16px', fontWeight: '400', lineHeight: '24px', fontFamily: 'Inter' }
    ])
    expect(rows).toHaveLength(1)
  })
})
