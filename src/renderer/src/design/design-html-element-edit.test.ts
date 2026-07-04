import { describe, expect, it } from 'vitest'
import { replaceHtmlElementTextInSource } from './design-html-element-edit'
import type { DesignHtmlElementContext } from './design-composer-context'

function elementContext(patch: Partial<DesignHtmlElementContext>): DesignHtmlElementContext {
  return {
    artifactId: 'screen',
    artifactTitle: 'Screen',
    artifactRelativePath: '.kun-design/screen/v1.html',
    selector: 'body > main:nth-of-type(1) > h1:nth-of-type(1)',
    tagName: 'H1',
    text: 'Old headline',
    html: '<h1>Old headline</h1>',
    ...patch
  }
}

describe('HTML element text edit', () => {
  it('updates a selected element by id without rewriting unrelated HTML', () => {
    const source = [
      '<!doctype html>',
      '<html><body>',
      '<main><h1 id="hero-title" class="headline">Old headline</h1><p>Keep me</p></main>',
      '</body></html>'
    ].join('\n')

    const result = replaceHtmlElementTextInSource(
      source,
      elementContext({
        selector: '#hero-title',
        html: '<h1 id="hero-title" class="headline">Old headline</h1>'
      }),
      'New headline'
    )

    expect(result).toEqual({
      ok: true,
      content: source.replace('>Old headline<', '>New headline<')
    })
  })

  it('updates a generated nth-of-type selector when the element has no id', () => {
    const source = [
      '<html>',
      '<body>',
      '  <main>',
      '    <section><h2>First</h2></section>',
      '    <section><h2>Second</h2></section>',
      '  </main>',
      '</body>',
      '</html>'
    ].join('\n')

    const result = replaceHtmlElementTextInSource(
      source,
      elementContext({
        selector: 'body > main:nth-of-type(1) > section:nth-of-type(2) > h2:nth-of-type(1)',
        tagName: 'H2',
        text: 'Second',
        html: '<h2>Second</h2>'
      }),
      'Updated'
    )

    expect(result).toEqual({
      ok: true,
      content: source.replace('<h2>Second</h2>', '<h2>Updated</h2>')
    })
  })

  it('escapes replacement text as HTML text', () => {
    const result = replaceHtmlElementTextInSource(
      '<html><body><main><p id="copy">Old</p></main></body></html>',
      elementContext({
        selector: '#copy',
        tagName: 'P',
        text: 'Old',
        html: '<p id="copy">Old</p>'
      }),
      'A < B & C > D'
    )

    expect(result).toEqual({
      ok: true,
      content: '<html><body><main><p id="copy">A &lt; B &amp; C &gt; D</p></main></body></html>'
    })
  })

  it('refuses direct edits on nested markup so the caller can ask for a narrower target', () => {
    const result = replaceHtmlElementTextInSource(
      '<html><body><button id="cta"><span>Start</span></button></body></html>',
      elementContext({
        selector: '#cta',
        tagName: 'BUTTON',
        text: 'Start',
        html: '<button id="cta"><span>Start</span></button>'
      }),
      'Launch'
    )

    expect(result).toEqual({
      ok: false,
      message: 'Only plain text elements can be edited directly. Select the innermost text node.'
    })
  })
})
