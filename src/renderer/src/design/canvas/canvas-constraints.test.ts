import { describe, expect, it } from 'vitest'
import { constrainedBox } from './canvas-constraints'

const oldFrame = { x: 0, y: 0, width: 200, height: 200 }
const newFrame = { x: 0, y: 0, width: 400, height: 200 }

describe('constrainedBox', () => {
  it('default (left/top) keeps the child pinned to the top-left, unchanged', () => {
    const box = constrainedBox({ x: 10, y: 10, width: 50, height: 50 }, oldFrame, newFrame)
    expect(box).toEqual({ x: 10, y: 10, width: 50, height: 50 })
  })

  it('right constraint keeps the trailing gap constant', () => {
    // Child's right edge sat 20px from the frame's right (200 - 180).
    const box = constrainedBox(
      { x: 130, y: 10, width: 50, height: 50, constraints: { h: 'right', v: 'top' } },
      oldFrame,
      newFrame
    )
    // New right edge = 400 - 20 = 380 → x = 330, width unchanged.
    expect(box.x).toBe(330)
    expect(box.width).toBe(50)
  })

  it('left-right constraint stretches width to keep both gaps', () => {
    const box = constrainedBox(
      { x: 20, y: 10, width: 160, height: 50, constraints: { h: 'left-right', v: 'top' } },
      oldFrame,
      newFrame
    )
    // leftGap 20, rightGap 20 → new width = 400 - 40 = 360.
    expect(box.x).toBe(20)
    expect(box.width).toBe(360)
  })

  it('scale constraint scales position and size proportionally', () => {
    const box = constrainedBox(
      { x: 50, y: 10, width: 50, height: 50, constraints: { h: 'scale', v: 'top' } },
      oldFrame,
      newFrame
    )
    // ratio 2 on the horizontal axis.
    expect(box.x).toBe(100)
    expect(box.width).toBe(100)
  })

  it('center constraint preserves the offset from the frame center', () => {
    // Child centered in the old frame (center 100) stays centered in the new one.
    const box = constrainedBox(
      { x: 75, y: 10, width: 50, height: 50, constraints: { h: 'center', v: 'top' } },
      oldFrame,
      newFrame
    )
    // New frame center 200, child width 50 → x = 175.
    expect(box.x).toBe(175)
    expect(box.width).toBe(50)
  })
})
