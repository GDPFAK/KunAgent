import { describe, expect, it } from 'vitest'
import type { DesignCodeChangeRequest } from './code-change-request'
import { applyReactTailwindRequestsToSource } from './react-tailwind-source-adapter'

function request(partial: Partial<DesignCodeChangeRequest>): DesignCodeChangeRequest {
  return {
    id: partial.id ?? 'request_1',
    kind: partial.kind ?? 'update-style',
    designObjectId: partial.designObjectId ?? 'shape_1',
    bindingId: partial.bindingId ?? 'binding_1',
    sourceFile: partial.sourceFile ?? 'src/app/page.tsx',
    ...(partial.onlookId ? { onlookId: partial.onlookId } : {}),
    ...(partial.domId ? { domId: partial.domId } : {}),
    ...(partial.componentName ? { componentName: partial.componentName } : {}),
    payload: partial.payload ?? {}
  }
}

describe('React Tailwind source adapter', () => {
  it('edits plain JSX text through an onlook id anchor', () => {
    const result = applyReactTailwindRequestsToSource(
      '<button data-onlook-id="cta">Start trial</button>',
      [request({ kind: 'edit-text', onlookId: 'cta', payload: { textContent: 'Pay <now>' } })]
    )

    expect(result.changed).toBe(true)
    expect(result.content).toBe('<button data-onlook-id="cta">Pay &lt;now&gt;</button>')
    expect(result.skipped).toEqual([])
  })

  it('adds Tailwind utility classes from style and layout payloads', () => {
    const result = applyReactTailwindRequestsToSource(
      '<button data-onlook-id="cta" className="px-4">Start</button>',
      [
        request({
          kind: 'update-style',
          onlookId: 'cta',
          payload: {
            fills: [{ type: 'solid', color: '#102030', opacity: 1 }],
            strokes: [{ color: '#ffffff', width: 2, opacity: 1, position: 'center' }],
            fontColor: '#f8fafc',
            cornerRadius: 12,
            opacity: 0.82
          }
        }),
        request({
          id: 'request_layout',
          kind: 'update-layout',
          onlookId: 'cta',
          payload: { width: 240, height: 48 }
        })
      ]
    )

    expect(result.content).toContain('className="px-4 bg-[#102030] border-[#ffffff] border border-[2px]')
    expect(result.content).toContain('text-[#f8fafc]')
    expect(result.content).toContain('rounded-[12px]')
    expect(result.content).toContain('opacity-[0.82]')
    expect(result.content).toContain('w-[240px] h-[48px]')
  })

  it('adds a className when the anchored element has none', () => {
    const result = applyReactTailwindRequestsToSource(
      '<div id="hero">Hero</div>',
      [request({ kind: 'update-layout', domId: 'hero', payload: { width: 390 } })]
    )

    expect(result.content).toBe('<div id="hero" className="w-[390px]">Hero</div>')
  })

  it('removes a complete anchored JSX element', () => {
    const result = applyReactTailwindRequestsToSource(
      '<main><aside data-onlook-id="rail">Rail</aside><section>Body</section></main>',
      [request({ kind: 'remove-node', onlookId: 'rail' })]
    )

    expect(result.content).toBe('<main><section>Body</section></main>')
  })

  it('skips expression class names and nested text edits', () => {
    const result = applyReactTailwindRequestsToSource(
      '<button data-onlook-id="cta" className={cn(active && "bg-red-500")}><span>Start</span></button>',
      [
        request({ kind: 'update-style', onlookId: 'cta', payload: { fontColor: '#111111' } }),
        request({ id: 'request_text', kind: 'edit-text', onlookId: 'cta', payload: { textContent: 'Go' } })
      ]
    )

    expect(result.changed).toBe(false)
    expect(result.skipped).toEqual([
      { requestId: 'request_1', reason: 'className is an expression.' },
      { requestId: 'request_text', reason: 'Text edit requires a non-nested plain JSX text node.' }
    ])
  })

  it('skips unsafe arbitrary class values instead of writing JSX-breaking strings', () => {
    const result = applyReactTailwindRequestsToSource(
      '<button data-onlook-id="cta">Start</button>',
      [
        request({
          kind: 'update-style',
          onlookId: 'cta',
          payload: { fontColor: '#fff" onClick="alert(1)' }
        })
      ]
    )

    expect(result.changed).toBe(false)
    expect(result.skipped).toEqual([
      { requestId: 'request_1', reason: 'No supported Tailwind class update in payload.' }
    ])
  })
})
