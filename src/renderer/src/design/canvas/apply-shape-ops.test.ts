import { describe, expect, it, beforeEach } from 'vitest'
import {
  extractDesignCanvasToolBlocks,
  extractShapeOpsBlocks,
  applyShapeOpsFromText
} from './apply-shape-ops'
import { useCanvasShapeStore } from './canvas-shape-store'
import { useCanvasUndoStore } from './canvas-undo-store'
import { useCanvasSelectionStore } from './canvas-selection-store'
import { createEmptyDocument } from './canvas-types'
import { setScreenArtifactFactory } from './screen-artifact-bridge'

beforeEach(() => {
  useCanvasShapeStore.getState().loadDocument(createEmptyDocument())
  useCanvasUndoStore.getState().clear()
  useCanvasSelectionStore.getState().clearSelection()
  setScreenArtifactFactory(() => null)
})

describe('extractShapeOpsBlocks', () => {
  it('returns [] when there is no shapeops fence', () => {
    expect(extractShapeOpsBlocks('just some prose, no canvas here')).toEqual([])
  })

  it('extracts a single fenced array', () => {
    const text = 'plan\n```shapeops\n[{ "op": "delete", "id": "x" }]\n```'
    const blocks = extractShapeOpsBlocks(text)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toHaveLength(1)
  })

  it('extracts multiple fenced blocks', () => {
    const text =
      '```shapeops\n[{ "op": "delete", "id": "a" }]\n```\nmid\n```shapeops\n[{ "op": "delete", "id": "b" }]\n```'
    expect(extractShapeOpsBlocks(text)).toHaveLength(2)
  })

  it('wraps a non-array JSON object into a single-op batch', () => {
    const blocks = extractShapeOpsBlocks('```shapeops\n{ "op": "delete", "id": "x" }\n```')
    expect(blocks[0]).toHaveLength(1)
  })

  it('skips malformed JSON without throwing', () => {
    expect(extractShapeOpsBlocks('```shapeops\nnot json\n```')).toEqual([])
  })
})

describe('extractDesignCanvasToolBlocks', () => {
  it('maps update_shapes tool calls to shape ops', () => {
    const blocks = extractDesignCanvasToolBlocks(
      '```design_canvas\n{ "action": "update_shapes", "ops": [{ "op": "delete", "id": "x" }] }\n```'
    )
    expect(blocks).toEqual([[{ op: 'delete', id: 'x' }]])
  })

  it('maps add_screen tool calls to the legacy add-screen op', () => {
    const blocks = extractDesignCanvasToolBlocks(
      '```design_canvas\n{ "action": "add_screen", "name": "Login", "width": 390, "height": 844, "devicePreset": "mobile" }\n```'
    )
    expect(blocks).toEqual([[
      {
        op: 'add-screen',
        name: 'Login',
        width: 390,
        height: 844,
        devicePreset: 'mobile'
      }
    ]])
  })
})

describe('applyShapeOpsFromText', () => {
  it('is a no-op (batchCount 0) for plain text', () => {
    const result = applyShapeOpsFromText('I will not touch the canvas.')
    expect(result.batchCount).toBe(0)
    expect(result.affectedIds).toEqual([])
  })

  it('applies an add op and reports the affected id', () => {
    const text = '```shapeops\n[{ "op": "add", "shape": { "type": "rect", "x": 0, "y": 0, "width": 20, "height": 20 } }]\n```'
    const result = applyShapeOpsFromText(text)
    expect(result.batchCount).toBe(1)
    expect(result.affectedIds).toHaveLength(1)
    expect(useCanvasShapeStore.getState().document.objects[result.affectedIds[0]]?.type).toBe('rect')
  })

  it('counts each fenced block as its own batch', () => {
    const text =
      '```shapeops\n[{ "op": "add", "shape": { "type": "rect", "width": 10, "height": 10 } }]\n```\n```shapeops\n[{ "op": "add", "shape": { "type": "ellipse", "width": 10, "height": 10 } }]\n```'
    expect(applyShapeOpsFromText(text).batchCount).toBe(2)
  })

  it('applies design_canvas update_shapes calls', () => {
    const text =
      '```design_canvas\n{ "action": "update_shapes", "ops": [{ "op": "add", "shape": { "type": "text", "textContent": "Hello", "x": 10, "y": 20 } }] }\n```'
    const result = applyShapeOpsFromText(text)
    expect(result.batchCount).toBe(1)
    expect(result.affectedIds).toHaveLength(1)
    expect(useCanvasShapeStore.getState().document.objects[result.affectedIds[0]]?.type).toBe('text')
  })

  it('applies design_canvas add_screen calls through the screen factory', () => {
    setScreenArtifactFactory((name) => `artifact-${name.toLowerCase()}`)
    const text =
      '```design_canvas\n{ "action": "add_screen", "name": "Login", "width": 390, "height": 844, "devicePreset": "mobile" }\n```'
    const result = applyShapeOpsFromText(text)
    expect(result.batchCount).toBe(1)
    expect(result.affectedIds).toHaveLength(1)
    const shape = useCanvasShapeStore.getState().document.objects[result.affectedIds[0]]
    expect(shape?.type).toBe('frame')
    expect(shape?.htmlArtifactId).toBe('artifact-login')
    expect(shape?.width).toBe(390)
    expect(shape?.height).toBe(844)
  })
})

describe('imageUrl ShapeOp support', () => {
  it('add op accepts imageUrl and stores it on the image shape', () => {
    const text =
      '```shapeops\n[{ "op": "add", "shape": { "type": "image", "width": 100, "height": 100, "imageUrl": ".deepseekgui-images/img-1.png" } }]\n```'
    const result = applyShapeOpsFromText(text)
    expect(result.affectedIds).toHaveLength(1)
    const shape = useCanvasShapeStore.getState().document.objects[result.affectedIds[0]]
    expect(shape?.type).toBe('image')
    expect(shape?.imageUrl).toBe('.deepseekgui-images/img-1.png')
  })

  it('update op patches imageUrl on an existing shape', () => {
    const added = applyShapeOpsFromText(
      '```shapeops\n[{ "op": "add", "shape": { "type": "image", "width": 50, "height": 50 } }]\n```'
    )
    const id = added.affectedIds[0]
    const result = applyShapeOpsFromText(
      `\`\`\`shapeops\n[{ "op": "update", "id": "${id}", "patch": { "imageUrl": ".deepseekgui-images/img-2.png" } }]\n\`\`\``
    )
    expect(result.affectedIds).toContain(id)
    expect(useCanvasShapeStore.getState().document.objects[id]?.imageUrl).toBe(
      '.deepseekgui-images/img-2.png'
    )
  })
})
