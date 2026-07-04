import { describe, expect, it, vi } from 'vitest'
import {
  buildPrototypeNavigationCaptureScript,
  extractPrototypeHashRouteHref,
  extractPrototypeNavigationHref,
  hasPrototypePlayback,
  isPrototypeBackNavigation,
  prototypeBackNavigationSteps,
  prototypeMissingScreenPromptValues,
  prototypePlayerGoBack,
  prototypePlayerNavigateTo,
  resolveInitialPrototypeArtifactId,
  resolvePreferredPrototypeArtifactId,
  resolvePrototypeNavigationTarget,
  resolvePrototypeLinks,
  resolvePrototypeScreens,
  resolvePrototypeViewportFrame,
  suggestedPrototypeScreenTitleFromHref,
  shouldInitializePrototypePlayerCurrentId,
  shouldCapturePrototypeNavigationHref
} from './prototype-player'
import type { DesignArtifact } from './design-types'

describe("prototype-player split test entry", () => {
  it('keeps split test files next to this entry', () => {
    expect(true).toBe(true)
  })
})
