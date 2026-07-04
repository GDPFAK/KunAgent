import { describe, expect, it } from 'vitest'
import { fitWorkbenchWidths, workbenchWidthConstraintsForRightPanel } from './workbench-layout'

describe('fitWorkbenchWidths', () => {
  it('keeps ordinary right panels within the inspector width cap', () => {
    const next = fitWorkbenchWidths(
      1800,
      304,
      1400,
      { leftPanelVisible: true, rightPanelVisible: true },
      workbenchWidthConstraintsForRightPanel('chat', 'browser')
    )

    expect(next.left).toBe(304)
    expect(next.right).toBe(760)
  })

  it('lets the code canvas grow into the available workspace', () => {
    const next = fitWorkbenchWidths(
      1800,
      304,
      1400,
      { leftPanelVisible: true, rightPanelVisible: true },
      workbenchWidthConstraintsForRightPanel('chat', 'canvas')
    )

    expect(next.left).toBe(304)
    expect(next.right).toBeGreaterThan(760)
    expect(next.right).toBe(1126)
  })
})
