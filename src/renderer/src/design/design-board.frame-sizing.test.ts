import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { syncHtmlArtifactsToBoardDocument } from './design-board'
import { useCanvasSelectionStore } from './canvas/canvas-selection-store'
import { useCanvasShapeStore } from './canvas/canvas-shape-store'
import { createEmptyDocument, createHtmlFrameShape } from './canvas/canvas-types'
import { useCanvasUndoStore } from './canvas/canvas-undo-store'
import { useCanvasViewportStore } from './canvas/canvas-viewport-store'
import { useDesignWorkspaceStore } from './design-workspace-store'
import { artifact } from './design-board.test-helpers'

beforeEach(() => {
  vi.stubGlobal('window', {
    kunGui: {
      writeWorkspaceFile: vi.fn(async () => ({ ok: true as const }))
    }
  })
  useCanvasShapeStore.getState().loadDocument(createEmptyDocument())
  useCanvasUndoStore.getState().clear()
  useCanvasSelectionStore.getState().clearSelection()
  useCanvasViewportStore.getState().setContainerSize(1200, 800)
  useCanvasViewportStore.getState().setVbox({ x: -600, y: -400, width: 1200, height: 800 })
  useDesignWorkspaceStore.setState({ designContext: { designTarget: 'web' } })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('design board HTML frame sizing sync', () => {
  it('keeps user-resized screen width while allowing auto-height sizing', () => {
    const screen = artifact('screen', 'html', {
      title: 'Responsive',
      node: { x: 40, y: 60, width: 760, height: 900, sizeMode: 'manual-width-auto-height' }
    })

    const synced = syncHtmlArtifactsToBoardDocument(createEmptyDocument(), [screen])
    const frame = synced.document.objects[synced.addedFrameIds[0]]

    expect(frame).toMatchObject({
      type: 'frame',
      htmlArtifactId: 'screen',
      x: 40,
      y: 60,
      width: 760,
      height: 900
    })
  })

  it('restores pending width-locked screens from stale skeleton heights', () => {
    const screen = artifact('screen', 'html', {
      title: 'Pending responsive',
      previewStatus: 'pending',
      node: { x: 40, y: 60, width: 825, height: 270, sizeMode: 'manual-width-auto-height' }
    })

    const synced = syncHtmlArtifactsToBoardDocument(createEmptyDocument(), [screen])
    const frame = synced.document.objects[synced.addedFrameIds[0]]

    expect(frame).toMatchObject({
      type: 'frame',
      htmlArtifactId: 'screen',
      x: 40,
      y: 60,
      width: 825,
      height: 516
    })
  })

  it('keeps a drawn height taller than the aspect floor for pending width-locked screens', () => {
    const screen = artifact('screen', 'html', {
      title: 'Tall drawn screen',
      previewStatus: 'pending',
      node: { x: 40, y: 60, width: 825, height: 1200, sizeMode: 'manual-width-auto-height' }
    })

    const synced = syncHtmlArtifactsToBoardDocument(createEmptyDocument(), [screen])
    const frame = synced.document.objects[synced.addedFrameIds[0]]

    expect(frame).toMatchObject({ width: 825, height: 1200 })
  })

  it('does not shrink an existing pending width-locked frame taller than the aspect floor', () => {
    const doc = createEmptyDocument()
    const root = doc.objects[doc.rootId]
    const existing = createHtmlFrameShape('Screen', 40, 60, 'screen', 'desktop')
    existing.width = 825
    existing.height = 1200
    doc.objects[existing.id] = { ...existing, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...root, children: [existing.id] }
    const screen = artifact('screen', 'html', {
      title: 'Screen',
      previewStatus: 'pending',
      node: { x: 40, y: 60, width: 825, height: 1200, sizeMode: 'manual-width-auto-height' }
    })

    const synced = syncHtmlArtifactsToBoardDocument(doc, [screen])

    expect(synced.updatedFrameIds).toEqual([])
    expect(synced.document.objects[existing.id]).toMatchObject({ width: 825, height: 1200 })
  })

  it('restores existing pending auto screens from stale skeleton heights', () => {
    const doc = createEmptyDocument()
    const root = doc.objects[doc.rootId]
    const existing = createHtmlFrameShape('Screen', 1410, -895, 'screen', 'desktop')
    existing.width = 825
    existing.height = 270
    doc.objects[existing.id] = { ...existing, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...root, children: [existing.id] }
    const screen = artifact('screen', 'html', {
      title: 'Screen',
      previewStatus: 'pending',
      node: { x: 1410, y: -895, width: 825, height: 270, sizeMode: 'auto' }
    })

    const synced = syncHtmlArtifactsToBoardDocument(doc, [screen])

    expect(synced.updatedFrameIds).toEqual([existing.id])
    expect(synced.document.objects[existing.id]).toMatchObject({
      width: 1280,
      height: 800
    })
  })

  it('restores existing pending width-locked screens from stale skeleton heights', () => {
    const doc = createEmptyDocument()
    const root = doc.objects[doc.rootId]
    const existing = createHtmlFrameShape('Screen', 1410, -895, 'screen', 'desktop')
    existing.width = 825
    existing.height = 270
    doc.objects[existing.id] = { ...existing, parentId: doc.rootId }
    doc.objects[doc.rootId] = { ...root, children: [existing.id] }
    const screen = artifact('screen', 'html', {
      title: 'Screen',
      previewStatus: 'pending',
      node: { x: 1410, y: -895, width: 825, height: 270, sizeMode: 'manual-width-auto-height' }
    })

    const synced = syncHtmlArtifactsToBoardDocument(doc, [screen])

    expect(synced.updatedFrameIds).toEqual([existing.id])
    expect(synced.document.objects[existing.id]).toMatchObject({
      width: 825,
      height: 516
    })
  })
})
