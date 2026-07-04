import { describe, expect, it } from 'vitest'
import { createDefaultShape } from './canvas-types'
import {
  absoluteLinearPoints,
  normalizeAbsoluteLinearPoints,
  removeLinearPoint,
  snapshotLinearPoints
} from './linear-point-edit'

describe('linear-point-edit', () => {
  it('normalizes absolute points into bbox-relative storage', () => {
    expect(normalizeAbsoluteLinearPoints([
      { x: 20, y: 30 },
      { x: 60, y: 10 },
      { x: 80, y: 50 }
    ])).toEqual({
      x: 20,
      y: 10,
      width: 60,
      height: 40,
      points: [
        { x: 0, y: 20 },
        { x: 40, y: 0 },
        { x: 60, y: 40 }
      ]
    })
  })

  it('removes a vertex and recomputes the bbox from remaining absolute points', () => {
    const shape = createDefaultShape('line', 20, 10)
    shape.width = 60
    shape.height = 40
    shape.points = [
      { x: 0, y: 20 },
      { x: 40, y: 0 },
      { x: 60, y: 40 }
    ]

    expect(removeLinearPoint(shape, 0)).toEqual({
      x: 60,
      y: 10,
      width: 20,
      height: 40,
      points: [
        { x: 0, y: 0 },
        { x: 20, y: 40 }
      ]
    })
  })

  it('does not remove points from a two-point line', () => {
    const shape = createDefaultShape('arrow', 10, 20)
    shape.points = [
      { x: 0, y: 0 },
      { x: 30, y: 10 }
    ]

    expect(removeLinearPoint(shape, 0)).toBeNull()
  })

  it('snapshots and resolves absolute points without mutating the shape', () => {
    const shape = createDefaultShape('line', 100, 200)
    shape.points = [
      { x: 0, y: 0 },
      { x: 10, y: 20 }
    ]

    const snapshot = snapshotLinearPoints(shape)
    snapshot.points[0].x = 999

    expect(shape.points[0].x).toBe(0)
    expect(absoluteLinearPoints(shape)).toEqual([
      { x: 100, y: 200 },
      { x: 110, y: 220 }
    ])
  })
})
