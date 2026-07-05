import { describe, expect, it } from 'vitest'
import { activeTimelineTurnKey, timelineJumpRailLeft, timelineJumpWaveLevel } from './MessageTimeline'

describe('activeTimelineTurnKey', () => {
  const positions = [
    { key: 'turn-1', top: -220 },
    { key: 'turn-2', top: 40 },
    { key: 'turn-3', top: 280 }
  ]

  it('keeps the latest turn that crossed the viewport threshold active', () => {
    expect(activeTimelineTurnKey(positions)).toBe('turn-2')
  })

  it('uses the first turn before any later turn crosses the threshold', () => {
    expect(activeTimelineTurnKey([
      { key: 'turn-1', top: 180 },
      { key: 'turn-2', top: 420 }
    ])).toBe('turn-1')
  })

  it('returns null for an empty timeline', () => {
    expect(activeTimelineTurnKey([])).toBeNull()
  })
})

describe('timelineJumpWaveLevel', () => {
  it('cycles compact rail items through a wave pattern', () => {
    expect(Array.from({ length: 7 }, (_, index) => timelineJumpWaveLevel(index))).toEqual([2, 4, 5, 3, 1, 2, 4])
  })
})

describe('timelineJumpRailLeft', () => {
  it('keeps the rail beside the content when the content width is capped', () => {
    expect(timelineJumpRailLeft(300, 1000, 800)).toBe(382)
  })

  it('reserves space when the requested content width is wider than the stage', () => {
    expect(timelineJumpRailLeft(300, 1000, 1200)).toBe(324)
  })
})
