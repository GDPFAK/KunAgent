/** Shared callback bridge for creating HTML screen artifacts from canvas operations. */

import type { DevicePreset, Rect } from './canvas-types'

type ScreenArtifactFactory = (name: string) => string | null

export type ScreenCreationRequest = Rect & {
  name: string
  brief?: string
  devicePreset: DevicePreset
  targetFrameId?: string
  preparePreview?: boolean
  /**
   * How the requested width/height should be persisted:
   * - 'manual-width-auto-height': explicit user width (e.g. drag-drawn frame);
   *   board sync keeps it instead of resetting to the target's default device
   *   size, while height stays content-driven.
   * - 'manual': both dimensions locked.
   * Defaults to 'auto'.
   */
  sizeMode?: 'auto' | 'manual' | 'manual-width-auto-height'
}

export type ScreenCreationResult = {
  artifactId: string
  shapeId: string
}

type ScreenCreationFactory = (request: ScreenCreationRequest) => ScreenCreationResult | null

let _factory: ScreenArtifactFactory | null = null
let _creationFactory: ScreenCreationFactory | null = null

export function setScreenArtifactFactory(fn: ScreenArtifactFactory | null): void {
  _factory = fn
}

export function getScreenArtifactFactory(): ScreenArtifactFactory | null {
  return _factory
}

export function setScreenCreationFactory(fn: ScreenCreationFactory | null): void {
  _creationFactory = fn
}

export function getScreenCreationFactory(): ScreenCreationFactory | null {
  return _creationFactory
}

/**
 * One-shot store for the `brief` the agent attached to an `add_screen` call,
 * keyed by the created frame's shape id. The add-screen executor stashes it; the
 * turn-complete hook takes it (read + clear) and forwards it to the follow-up
 * HTML-generation turn so that turn designs from the agent's own expanded brief
 * instead of the raw, often-terse user prompt.
 */
const _screenBriefs = new Map<string, string>()

export function setScreenBrief(shapeId: string, brief: string): void {
  const trimmed = brief.trim()
  if (trimmed) _screenBriefs.set(shapeId, trimmed)
}

export function takeScreenBrief(shapeId: string): string | null {
  const brief = _screenBriefs.get(shapeId) ?? null
  if (brief !== null) _screenBriefs.delete(shapeId)
  return brief
}
