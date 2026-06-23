import { describe, expect, it } from 'vitest'
import { middleEllipsize } from './middle-ellipsize'

describe('middleEllipsize', () => {
  it('keeps short text unchanged', () => {
    expect(middleEllipsize('main', 12)).toBe('main')
  })

  it('cuts long text from the middle with three dots', () => {
    expect(middleEllipsize('this-is-a-very-long-branch-name-that-definitely-overflows', 30))
      .toBe('this-is-a-very...ely-overflows')
  })

  it('handles very small limits without exceeding the requested length', () => {
    expect(middleEllipsize('branch', 2)).toBe('..')
  })
})
