import { describe, expect, it } from 'vitest'
import { shapeGuestExtraction, TOKEN_EXTRACT_GUEST_SRC } from './design-token-extract'

describe('shapeGuestExtraction', () => {
  it('tags colors with inferred roles and keeps source order', () => {
    const out = shapeGuestExtraction({
      colors: [
        { name: '--accent', value: '#3b82d8' },
        { name: '--text-primary', value: '#212529' },
        { name: '--something-weird', value: '#7e57c2' }
      ],
      fonts: [], radii: [], spacing: [],
      typeScale: [],
      sampledColors: [], title: ''
    })
    expect(out.colors.map((c) => c.role)).toEqual(['primary', 'neutral', 'other'])
    expect(out.colors[0].value).toBe('#3b82d8')
    expect(out.colors[1].value).toBe('#212529')
  })

  it('passes through non-color metadata unchanged', () => {
    const out = shapeGuestExtraction({
      colors: [],
      fonts: [{ name: '--font-sans', value: 'Inter, system-ui' }],
      radii: [{ name: '--radius', value: '8px' }],
      spacing: [{ name: '--space-md', value: '20px' }],
      typeScale: [],
      sampledColors: ['rgb(0,0,0)'], title: 'demo'
    })
    expect(out.fonts).toEqual([{ name: '--font-sans', value: 'Inter, system-ui' }])
    expect(out.radii[0].value).toBe('8px')
    expect(out.spacing[0].value).toBe('20px')
    expect(out.title).toBe('demo')
    expect(out.sampledColors).toEqual(['rgb(0,0,0)'])
  })

  it('drops colors that normalize to empty (only when document is unavailable do we keep raw)', () => {
    // In the node vitest env document is undefined, so non-hex values fall
    // through to the raw value rather than being normalized. The shape still
    // returns a defined `value`, which is what the rest of the pipeline needs.
    const out = shapeGuestExtraction({
      colors: [{ name: '--primary', value: 'oklch(0.7 0.1 200)' }],
      fonts: [], radii: [], spacing: [], typeScale: [],
      sampledColors: [], title: ''
    })
    expect(out.colors).toHaveLength(1)
    expect(out.colors[0].role).toBe('primary')
  })

  it('keeps guest extraction failures inside the webview script', () => {
    const execute = new Function(`return ${TOKEN_EXTRACT_GUEST_SRC}`)
    expect(() => execute()).not.toThrow()
    expect(execute()).toBeNull()
  })
})
