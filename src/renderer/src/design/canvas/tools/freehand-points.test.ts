import { describe, expect, it } from 'vitest'
import { normalizeFreehandPoints, simplifyFreehandPoints } from './freehand-points'

describe('freehand point simplification', () => {
  it('collapses nearly straight high-frequency samples to their endpoints', () => {
    const points = Array.from({ length: 120 }, (_, index) => ({
      x: index,
      y: Math.sin(index / 4) * 0.25
    }))

    const simplified = simplifyFreehandPoints(points)

    expect(simplified).toHaveLength(2)
    expect(simplified[0]).toEqual(points[0])
    expect(simplified[1]).toEqual(points[points.length - 1])
  })

  it('preserves meaningful corners', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 25, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 25 },
      { x: 50, y: 50 }
    ]

    expect(simplifyFreehandPoints(points)).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 }
    ])
  })

  it('caps noisy strokes as a safety guard', () => {
    const points = Array.from({ length: 80 }, (_, index) => ({
      x: index,
      y: index % 2 === 0 ? 0 : 10
    }))

    const simplified = simplifyFreehandPoints(points, { tolerance: 0, maxPoints: 12 })

    expect(simplified.length).toBeLessThanOrEqual(12)
    expect(simplified[0]).toEqual(points[0])
    expect(simplified[simplified.length - 1]).toEqual(points[points.length - 1])
  })

  it('normalizes absolute points to a relative bbox', () => {
    expect(normalizeFreehandPoints([
      { x: 10, y: 20 },
      { x: 15, y: 18 }
    ])).toEqual({
      x: 10,
      y: 18,
      width: 5,
      height: 2,
      points: [
        { x: 0, y: 2 },
        { x: 5, y: 0 }
      ]
    })
  })
})
