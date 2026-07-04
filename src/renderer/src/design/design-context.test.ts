import { describe, expect, it } from 'vitest'
import {
  defaultDevicePresetForDesignTarget,
  defaultFrameSizeForDesignTarget,
  formatDesignContextLines,
  mergeDesignContextWithTokens,
  type DesignContext
} from './design-context'

const tokens = {
  palette: { primary: { base: '#3b82d8' } },
  typeRows: [{ fontFamily: 'Inter, sans-serif' }]
}

describe('mergeDesignContextWithTokens', () => {
  it('fills unset brandColor + fontStyle from the realized tokens', () => {
    expect(mergeDesignContextWithTokens(undefined, tokens)).toMatchObject({
      brandColor: '#3b82d8',
      fontStyle: 'geometric'
    })
  })

  it('never overrides an explicit user choice', () => {
    const ctx: DesignContext = { brandColor: '#ff0000', fontStyle: 'serif', tone: ['专业'] }
    expect(mergeDesignContextWithTokens(ctx, tokens)).toEqual(ctx)
  })

  it('infers font style buckets from common families', () => {
    expect(mergeDesignContextWithTokens(undefined, { palette: {}, typeRows: [{ fontFamily: 'Georgia, serif' }] })?.fontStyle).toBe('serif')
    expect(mergeDesignContextWithTokens(undefined, { palette: {}, typeRows: [{ fontFamily: 'JetBrains Mono' }] })?.fontStyle).toBe('mono')
    expect(mergeDesignContextWithTokens(undefined, { palette: {}, typeRows: [{ fontFamily: 'Roboto' }] })?.fontStyle).toBe('humanist')
  })

  it('returns the context unchanged when there are no tokens', () => {
    expect(mergeDesignContextWithTokens({ tone: ['专业'] }, undefined)).toEqual({ tone: ['专业'] })
  })
})

describe('design target context', () => {
  it('defaults every design turn to web target context', () => {
    const lines = formatDesignContextLines(undefined)
    expect(lines.join('\n')).toContain('Target: Web')
    expect(defaultDevicePresetForDesignTarget(undefined)).toBe('desktop')
    expect(defaultFrameSizeForDesignTarget(undefined)).toEqual({ width: 1280, height: 800 })
  })

  it('describes app target as mobile-first phone frames', () => {
    const lines = formatDesignContextLines({ designTarget: 'app' })
    expect(lines.join('\n')).toContain('Target: App')
    expect(lines.join('\n')).toContain('390x844')
    expect(defaultDevicePresetForDesignTarget('app')).toBe('mobile')
    expect(defaultFrameSizeForDesignTarget('app')).toEqual({ width: 390, height: 844 })
  })
})
