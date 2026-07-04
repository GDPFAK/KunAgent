import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createHtmlFrameShape, ROOT_SHAPE_ID, type CanvasDocument } from '../canvas/canvas-types'
import { buildOpenUiGeneratorLaneModel } from './openui-generator-lane'

function canvasWithScreen(): CanvasDocument {
  const doc = createEmptyDocument()
  const frame = {
    ...createHtmlFrameShape('Home', 0, 0, 'home', 'desktop'),
    id: 'frame_home',
    parentId: ROOT_SHAPE_ID
  }
  doc.objects[ROOT_SHAPE_ID] = { ...doc.objects[ROOT_SHAPE_ID], children: [frame.id] }
  doc.objects[frame.id] = frame
  return doc
}

describe('openui generator lane', () => {
  it('offers fast generation actions without requiring an existing screen', () => {
    const model = buildOpenUiGeneratorLaneModel({
      doc: createEmptyDocument(),
      selectedIds: new Set(),
      designTarget: 'web'
    })

    expect(model).toMatchObject({ screenCount: 0, selectedCount: 0, hasCodeBindings: false })
    expect(model.actions.map((action) => [action.id, action.disabledReasonKey])).toEqual([
      ['quick-screen', undefined],
      ['three-directions', undefined],
      ['annotate-refine', 'designGeneratorLaneNeedsScreen'],
      ['normalize-system', 'designGeneratorLaneNeedsScreen']
    ])
    expect(model.actions[0].prompt).toContain('OpenUI-style fast path')
    expect(model.actions[0]).toMatchObject({
      toolInputSeed: {
        toolId: 'design.generate_screen',
        input: {
          designTarget: 'web'
        }
      },
      toolCallLine: expect.stringContaining('Suggested tool call: design.generate_screen')
    })
    expect(model.actions[0].prompt).toContain('Tool protocol:')
    expect(model.actions[0].prompt).toContain('Suggested tool call: design.generate_screen')
    expect(model.actions[1].prompt).toContain('three distinct visual directions')
    expect(model.actions[1].toolInputSeed).toMatchObject({
      toolId: 'design.generate_directions',
      input: { count: 3 }
    })
  })

  it('enables annotate and normalize actions once a screen exists', () => {
    const model = buildOpenUiGeneratorLaneModel({
      doc: canvasWithScreen(),
      selectedIds: new Set(['frame_home']),
      designTarget: 'app'
    })

    expect(model.screenCount).toBe(1)
    expect(model.selectedCount).toBe(1)
    expect(model.actions.every((action) => !action.disabledReasonKey)).toBe(true)
    expect(model.actions.find((action) => action.id === 'annotate-refine')?.prompt).toContain(
      'Selected canvas objects: Home.'
    )
    expect(model.actions.find((action) => action.id === 'annotate-refine')?.toolInputSeed).toMatchObject({
      toolId: 'design.critique',
      input: {
        scopeIds: ['frame_home'],
        attachNotes: true
      },
      followUpToolIds: ['design.repair']
    })
    expect(model.actions.find((action) => action.id === 'normalize-system')?.prompt).toContain(
      "Kun's Design Graph and Design System"
    )
    expect(model.actions.find((action) => action.id === 'normalize-system')?.toolInputSeed).toMatchObject({
      toolId: 'design.system',
      input: {
        action: 'template',
        mode: 'light'
      }
    })
  })

  it('summarizes active code binding availability for the lane', () => {
    const doc = canvasWithScreen()
    doc.codeBindings = [
      {
        id: 'binding_1',
        designObjectId: 'frame_home',
        kind: 'component',
        status: 'active',
        createdAt: '2026-06-29T00:00:00.000Z',
        target: { sourceFile: 'src/Home.tsx' }
      }
    ]

    expect(buildOpenUiGeneratorLaneModel({
      doc,
      selectedIds: new Set(),
      designTarget: 'web'
    }).hasCodeBindings).toBe(true)
  })
})
