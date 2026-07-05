import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  designSystemPath,
  parseDesignSystem,
  persistDesignSystem,
  serializeDesignSystem
} from './design-system-persistence'
import { createDefaultShape } from './canvas-types'
import { createEmptyDesignSystem, type DesignSystem } from './design-system-types'

describe('design-system-persistence', () => {
  it('puts design-system.json at the doc dir (baseDir)', () => {
    expect(designSystemPath('.kun-design/doc_123')).toBe('.kun-design/doc_123/design-system.json')
  })

  it('round-trips a design system through serialize/parse', () => {
    const system: DesignSystem = {
      tokens: {
        'brand/primary': { name: 'brand/primary', kind: 'color', value: '#3b82d8' },
        'space/md': { name: 'space/md', kind: 'space', value: 16 }
      },
      components: {}
    }
    const parsed = parseDesignSystem(serializeDesignSystem(system))
    expect(parsed).toEqual(system)
  })

  it('returns null on garbage and an empty system on a bare object', () => {
    expect(parseDesignSystem('not json {')).toBeNull()
    expect(parseDesignSystem('{}')).toEqual(createEmptyDesignSystem())
  })

  it('repairs missing names and discards malformed persisted entries', () => {
    const componentRoot = createDefaultShape('frame', 0, 0)
    componentRoot.id = 'component-card-root'
    componentRoot.name = 'Card Root'

    expect(
      parseDesignSystem(
        JSON.stringify({
          tokens: {
            'brand/primary': { kind: 'color', value: '#3b82d8' },
            broken: null
          },
          components: {
            Card: {
              id: 'component-card',
              version: 1,
              tree: [componentRoot],
              slots: [{ path: 'Title', kind: 'text' }]
            },
            EmptyTree: { id: 'empty-tree', version: 1, tree: [], slots: [] },
            BrokenSlot: { id: 'broken-slot', version: 1, tree: [componentRoot], slots: [null] },
            broken: { name: 'Broken' }
          }
        })
      )
    ).toEqual({
      tokens: {
        'brand/primary': { name: 'brand/primary', kind: 'color', value: '#3b82d8' }
      },
      components: {
        Card: {
          id: 'component-card',
          name: 'Card',
          version: 1,
          tree: [componentRoot],
          slots: [{ path: 'Title', kind: 'text' }]
        }
      }
    })
  })

  describe('debounced save', () => {
    afterEach(() => {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    })

    it('does not let one design-system file cancel another design-system save', () => {
      vi.useFakeTimers()
      const writeWorkspaceFile = vi.fn(async () => ({ ok: true as const }))
      vi.stubGlobal('window', { kunGui: { writeWorkspaceFile } })
      const designSystem: DesignSystem = {
        tokens: {
          'brand/primary': { name: 'brand/primary', kind: 'color', value: '#3b82d8' }
        },
        components: {}
      }
      const codeSystem: DesignSystem = {
        tokens: {
          'brand/primary': { name: 'brand/primary', kind: 'color', value: '#14b8a6' }
        },
        components: {}
      }

      persistDesignSystem('/workspace', designSystem, '.kun-design/doc-1')
      persistDesignSystem('/workspace', codeSystem, '.kun-canvas/code-thread-1')
      vi.advanceTimersByTime(600)

      expect(writeWorkspaceFile).toHaveBeenCalledTimes(2)
      expect(writeWorkspaceFile).toHaveBeenCalledWith({
        path: designSystemPath('.kun-design/doc-1'),
        workspaceRoot: '/workspace',
        content: serializeDesignSystem(designSystem)
      })
      expect(writeWorkspaceFile).toHaveBeenCalledWith({
        path: designSystemPath('.kun-canvas/code-thread-1'),
        workspaceRoot: '/workspace',
        content: serializeDesignSystem(codeSystem)
      })
    })

    it('keeps debouncing repeated saves for the same design-system file', () => {
      vi.useFakeTimers()
      const writeWorkspaceFile = vi.fn(async () => ({ ok: true as const }))
      vi.stubGlobal('window', { kunGui: { writeWorkspaceFile } })
      const firstSystem = createEmptyDesignSystem()
      const latestSystem: DesignSystem = {
        tokens: {
          'brand/primary': { name: 'brand/primary', kind: 'color', value: '#14b8a6' }
        },
        components: {}
      }

      persistDesignSystem('/workspace', firstSystem, '.kun-canvas/code-thread-1')
      persistDesignSystem('/workspace', latestSystem, '.kun-canvas/code-thread-1')
      vi.advanceTimersByTime(600)

      expect(writeWorkspaceFile).toHaveBeenCalledTimes(1)
      expect(writeWorkspaceFile).toHaveBeenCalledWith({
        path: designSystemPath('.kun-canvas/code-thread-1'),
        workspaceRoot: '/workspace',
        content: serializeDesignSystem(latestSystem)
      })
    })
  })
})
