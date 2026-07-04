import { useCanvasViewportStore } from './canvas-viewport-store'

const MIN_SCALE = 0.8
const MAX_SCALE = 1
const SMALL = 440
const LARGE = 920

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Continuous scale factor for canvas overlay controls (toolbar, minimap, zoom bar).
 * Driven by the canvas panel's smaller side, not by the canvas zoom level: a
 * narrower/shorter panel shrinks the overlays proportionally so they stay
 * unobtrusive at a 1:1 canvas.
 */
export function useCanvasUiScale(): number {
  const width = useCanvasViewportStore((s) => s.containerWidth)
  const height = useCanvasViewportStore((s) => s.containerHeight)
  const minSide = Math.min(width, height)
  const t = clamp((minSide - SMALL) / (LARGE - SMALL), 0, 1)
  return MIN_SCALE + t * (MAX_SCALE - MIN_SCALE)
}
