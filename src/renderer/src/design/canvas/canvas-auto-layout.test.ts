import { describe, expect, it } from 'vitest'
import { computeAutoLayout, defaultAutoLayout } from './canvas-auto-layout'
import { createDefaultShape, createEmptyDocument } from './canvas-types'
import type { AutoLayout, CanvasShape } from './canvas-types'

function frameWith(layout: AutoLayout, frameRect: { x: number; y: number; w: number; h: number }) {
  const doc = createEmptyDocument()
  const objects = doc.objects
  const frame = createDefaultShape('frame', frameRect.x, frameRect.y)
  frame.width = frameRect.w
  frame.height = frameRect.h
  frame.layout = layout
  frame.children = []
  objects[frame.id] = frame
  const addChild = (w: number, h: number): CanvasShape => {
    const c = createDefaultShape('rect', 0, 0)
    c.width = w
    c.height = h
    c.parentId = frame.id
    objects[c.id] = c
    frame.children.push(c.id)
    return c
  }
  return { objects, frame, addChild }
}

describe('computeAutoLayout', () => {
  it('returns nothing for a frame without a layout', () => {
    const doc = createEmptyDocument()
    const f = createDefaultShape('frame', 0, 0)
    doc.objects[f.id] = f
    expect(computeAutoLayout(doc.objects, f.id)).toEqual([])
  })

  it('stacks children vertically with gap + padding', () => {
    const { objects, frame, addChild } = frameWith(
      { direction: 'vertical', gap: 10, paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16 },
      { x: 100, y: 100, w: 200, h: 400 }
    )
    const a = addChild(50, 30)
    const b = addChild(50, 40)
    const pos = computeAutoLayout(objects, frame.id)
    // First child at top-left inner corner.
    expect(pos.find((p) => p.id === a.id)).toEqual({ id: a.id, x: 116, y: 116 })
    // Second child below the first + gap (116 + 30 + 10).
    expect(pos.find((p) => p.id === b.id)).toEqual({ id: b.id, x: 116, y: 156 })
  })

  it('lays children horizontally and centers them on the cross axis', () => {
    const { objects, frame, addChild } = frameWith(
      {
        direction: 'horizontal',
        gap: 8,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        counterAlign: 'center'
      },
      { x: 0, y: 0, w: 300, h: 100 }
    )
    const a = addChild(40, 20)
    const b = addChild(40, 60)
    const pos = computeAutoLayout(objects, frame.id)
    // x flows left→right with the gap; y centers each child in the 100px height.
    expect(pos.find((p) => p.id === a.id)).toEqual({ id: a.id, x: 0, y: 40 })
    expect(pos.find((p) => p.id === b.id)).toEqual({ id: b.id, x: 48, y: 20 })
  })

  it('space-between spreads children edge to edge', () => {
    const { objects, frame, addChild } = frameWith(
      {
        direction: 'horizontal',
        gap: 0,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        primaryAlign: 'space-between'
      },
      { x: 0, y: 0, w: 200, h: 50 }
    )
    const a = addChild(20, 20)
    const b = addChild(20, 20)
    const c = addChild(20, 20)
    const pos = computeAutoLayout(objects, frame.id)
    expect(pos.find((p) => p.id === a.id)?.x).toBe(0)
    expect(pos.find((p) => p.id === c.id)?.x).toBe(180)
    // Middle child sits halfway: (200 - 60)/2 spread → gap 70 each → 0+20+70 = 90.
    expect(pos.find((p) => p.id === b.id)?.x).toBe(90)
  })

  it('ignores hidden children', () => {
    const { objects, frame, addChild } = frameWith(defaultAutoLayout(), { x: 0, y: 0, w: 200, h: 400 })
    const a = addChild(50, 30)
    const hidden = addChild(50, 30)
    hidden.visible = false
    const pos = computeAutoLayout(objects, frame.id)
    expect(pos).toHaveLength(1)
    expect(pos[0].id).toBe(a.id)
  })
})
