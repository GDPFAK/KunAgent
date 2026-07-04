import { describe, expect, it } from 'vitest'
import {
  buildCodeCanvasTurnPrompt,
  buildDesignFromCodePrompt,
  buildDesignImageNodePrompt,
  buildDesignTurnPrompt,
  buildParallelDesignPagesPrompt,
  buildPrototypeHref
} from './design-turn-prompt'
import type { ScreenTurnOptions } from './design-turn-prompt'
import { snapshotCanvas } from './canvas/canvas-snapshot'
import { createDefaultShape, createEmptyDocument, createHtmlFrameShape } from './canvas/canvas-types'
import { setLastLintFindings } from './canvas/design-lint'
import { useDesignSystemStore } from './canvas/design-system-store'

describe("design-turn-prompt split test entry", () => {
  it('keeps split test files next to this entry', () => {
    expect(true).toBe(true)
  })
})
