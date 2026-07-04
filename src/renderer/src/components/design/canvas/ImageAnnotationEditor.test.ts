import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  createImageAnnotationTextDraftAtCssPoint,
  createImageAnnotationTextOp,
  ImageAnnotationEditor,
  imageAnnotationTextNotes,
  shouldCommitImageAnnotationTextKey
} from './ImageAnnotationEditor'

const draft = {
  cssX: 10,
  cssY: 12,
  x: 100,
  y: 120,
  cssFontSize: 24,
  cssLineHeight: 28.8,
  maxCssWidth: 300
}

function renderEditor(): string {
  return renderToStaticMarkup(
    createElement(ImageAnnotationEditor, {
      imageUrl: '.kun-design/image.png',
      workspaceRoot: '/workspace',
      title: 'image.png',
      onCancel: () => undefined,
      onApply: () => undefined
    })
  )
}

describe('ImageAnnotationEditor layout', () => {
  it('keeps the full-screen editor out of native window drag controls', () => {
    const html = renderEditor()

    expect(html).toContain('ds-no-drag fixed inset-0')
    expect(html).toContain('ds-drag flex shrink-0')
    expect(html).toContain('padding-left:calc(var(--ds-window-controls-safe-inset) + 1.25rem)')
  })

  it('renders the instruction input with visible text on a generated background class', () => {
    const html = renderEditor()

    expect(html).toContain('appearance-none')
    expect(html).toContain('bg-white/10')
    expect(html).toContain('text-white')
    expect(html).toContain('caret-white')
    expect(html).not.toContain('bg-white/12')
  })
})

describe('ImageAnnotationEditor text annotations', () => {
  it('creates trimmed pending text annotations', () => {
    expect(
      createImageAnnotationTextOp(
        draft,
        '  改成蓝色  ',
        '#3b82f6',
        36
      )
    ).toEqual({
      kind: 'text',
      color: '#3b82f6',
      x: 100,
      y: 120,
      text: '改成蓝色',
      fontSize: 36
    })

    expect(createImageAnnotationTextOp(null, '改成蓝色', '#3b82f6', 36)).toBeNull()
    expect(createImageAnnotationTextOp({ ...draft, cssX: 0, cssY: 0, x: 0, y: 0 }, '   ', '#3b82f6', 36)).toBeNull()
  })

  it('extracts text notes from committed and pending operations', () => {
    const textOp = createImageAnnotationTextOp(
      draft,
      '标题放大',
      '#111827',
      24
    )

    if (!textOp) throw new Error('expected a text annotation op')

    expect(
      imageAnnotationTextNotes([
        { kind: 'arrow', color: '#ef4444', width: 4, from: { x: 0, y: 0 }, to: { x: 20, y: 20 } },
        textOp
      ])
    ).toEqual(['标题放大'])
  })

  it('does not commit Enter while an IME composition is active', () => {
    expect(shouldCommitImageAnnotationTextKey('Enter', false, false)).toBe(false)
    expect(shouldCommitImageAnnotationTextKey('Enter', false, false, true)).toBe(true)
    expect(shouldCommitImageAnnotationTextKey('Escape', false, false)).toBe(true)
    expect(shouldCommitImageAnnotationTextKey('Enter', true, false, true)).toBe(false)
    expect(shouldCommitImageAnnotationTextKey('Enter', false, true, true)).toBe(false)
    expect(shouldCommitImageAnnotationTextKey('a', false, false)).toBe(false)
  })

  it('creates a text draft at the clicked canvas point', () => {
    expect(
      createImageAnnotationTextDraftAtCssPoint({
        canvasWidth: 1000,
        canvasHeight: 800,
        cssWidth: 500,
        cssHeight: 400,
        cssX: 60,
        cssY: 48,
        canvasFontSize: 60
      })
    ).toEqual({
      cssX: 60,
      cssY: 48,
      x: 120,
      y: 96,
      cssFontSize: 30,
      cssLineHeight: 36,
      maxCssWidth: 432
    })

    expect(
      createImageAnnotationTextDraftAtCssPoint({
        canvasWidth: 0,
        canvasHeight: 800,
        cssWidth: 500,
        cssHeight: 400,
        cssX: 60,
        cssY: 48,
        canvasFontSize: 60
      })
    ).toBeNull()
  })

  it('keeps the text anchor at the clicked point near canvas edges', () => {
    expect(
      createImageAnnotationTextDraftAtCssPoint({
        canvasWidth: 1000,
        canvasHeight: 800,
        cssWidth: 500,
        cssHeight: 400,
        cssX: 490,
        cssY: 390,
        canvasFontSize: 60
      })
    ).toMatchObject({
      cssX: 490,
      cssY: 390,
      x: 980,
      y: 780,
      maxCssWidth: 120
    })
  })

  it('only clamps text anchors that fall outside the canvas', () => {
    expect(
      createImageAnnotationTextDraftAtCssPoint({
        canvasWidth: 1000,
        canvasHeight: 800,
        cssWidth: 500,
        cssHeight: 400,
        cssX: -20,
        cssY: 420,
        canvasFontSize: 60
      })
    ).toMatchObject({
      cssX: 0,
      cssY: 400,
      x: 0,
      y: 800
    })
  })
})
