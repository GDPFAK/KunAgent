import { memo } from 'react'
import type { CanvasShape } from '../../../../design/canvas/canvas-types'
import { ShapeDispatcher } from './ShapeDispatcher'

function GroupShapeInner({
  shape,
  objects
}: {
  shape: CanvasShape
  objects: Record<string, CanvasShape>
}) {
  return (
    // Children store ABSOLUTE coords; cancel the group's own translate(shape.x,
    // shape.y) so they don't render double-offset. (See FrameShape for the why.)
    <g transform={`translate(${-shape.x}, ${-shape.y})`}>
      {shape.children.map((childId) => {
        const child = objects[childId]
        if (!child || !child.visible) return null
        return <ShapeDispatcher key={childId} shapeId={childId} objects={objects} />
      })}
    </g>
  )
}

export const GroupShape = memo(GroupShapeInner)
