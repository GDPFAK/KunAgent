import { describe, expect, it } from 'vitest'
import type { AttachmentReference } from '../../agent/types'
import {
  canvasAutoAttachmentReference,
  parseCanvasImageDataUrl,
  removeCanvasAutoAttachmentById,
  selectedCanvasImageAttachmentCandidate
} from './canvas-image-auto-attachment'
import { createDefaultShape, createEmptyDocument } from './canvas-types'

function documentWithImage(imageUrl = 'data:image/png;base64,AAAA') {
  const document = createEmptyDocument()
  const image = createDefaultShape('image', 10, 20)
  image.id = 'image_1'
  image.name = 'Hero image'
  image.imageUrl = imageUrl
  document.objects[image.id] = image
  document.objects[document.rootId].children.push(image.id)
  return document
}

describe('canvas image auto attachment helpers', () => {
  it('resolves the selected filled image in design mode', () => {
    expect(selectedCanvasImageAttachmentCandidate({
      route: 'design',
      selectedIds: new Set(['image_1']),
      document: documentWithImage('.deepseekgui-images/hero.png')
    })).toEqual({
      shapeId: 'image_1',
      imageUrl: '.deepseekgui-images/hero.png',
      shapeName: 'Hero image'
    })
  })

  it('ignores non-design mode, multi-selection, and empty image slots', () => {
    const document = documentWithImage()
    expect(selectedCanvasImageAttachmentCandidate({
      route: 'chat',
      selectedIds: new Set(['image_1']),
      document
    })).toBeNull()
    expect(selectedCanvasImageAttachmentCandidate({
      route: 'design',
      selectedIds: new Set(['image_1', 'other']),
      document
    })).toBeNull()

    const empty = documentWithImage('')
    expect(selectedCanvasImageAttachmentCandidate({
      route: 'design',
      selectedIds: new Set(['image_1']),
      document: empty
    })).toBeNull()
  })

  it('parses canvas image data urls', () => {
    expect(parseCanvasImageDataUrl('data:image/webp;base64,Zm9v')).toEqual({
      mimeType: 'image/webp',
      dataBase64: 'Zm9v'
    })
    expect(parseCanvasImageDataUrl('.deepseekgui-images/hero.png')).toBeNull()
  })

  it('builds and removes auto attachment references', () => {
    const ref = canvasAutoAttachmentReference({
      uploaded: {
        id: 'att_1',
        name: 'Hero image',
        mimeType: 'image/webp',
        width: 800,
        height: 600
      },
      prepared: {
        dataBase64: 'Zm9v',
        mimeType: 'image/webp',
        textFallback: {
          mimeType: 'image/webp',
          dataBase64: 'Zm9v',
          byteSize: 3
        }
      }
    })

    expect(ref).toEqual({
      id: 'att_1',
      name: 'Hero image',
      mimeType: 'image/webp',
      width: 800,
      height: 600,
      previewUrl: 'data:image/webp;base64,Zm9v'
    })

    const attachments: AttachmentReference[] = [ref, { id: 'manual', name: 'manual' }]
    expect(removeCanvasAutoAttachmentById(attachments, 'att_1')).toEqual([{ id: 'manual', name: 'manual' }])
    expect(removeCanvasAutoAttachmentById(attachments, null)).toEqual(attachments)
  })
})
