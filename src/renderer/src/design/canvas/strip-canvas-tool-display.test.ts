import { describe, expect, it } from 'vitest'
import {
  findMatchingJsonObjectEnd,
  sanitizeAssistantCanvasToolDisplay,
  stripUnfencedCanvasToolCalls
} from './strip-canvas-tool-display'

describe('stripUnfencedCanvasToolCalls', () => {
  it('removes a complete unfenced design_canvas JSON blob', () => {
    const input = [
      'I will add three screens for the landing page.',
      'design_canvas { "action": "add_screen", "name": "Home" }',
      'Then I will summarize the layout.'
    ].join('\n')
    expect(stripUnfencedCanvasToolCalls(input)).toBe(
      'I will add three screens for the landing page.\n\nThen I will summarize the layout.'
    )
  })

  it('strips HTML payloads embedded in unfenced write actions', () => {
    const input =
      'Plan first.\ndesign_canvas { "action": "write", "content": "<!DOCTYPE html><html><body>Hi</body></html>" }\nDone.'
    expect(stripUnfencedCanvasToolCalls(input)).toBe('Plan first.\n\nDone.')
  })

  it('drops an incomplete unfenced blob while streaming', () => {
    const input = 'Starting now.\ndesign_canvas { "action": "write", "content": "<!DOCTYPE html>'
    expect(stripUnfencedCanvasToolCalls(input)).toBe('Starting now.')
  })

  it('keeps fenced design_canvas blocks for chip rendering', () => {
    const input = [
      'Plan.',
      '```design_canvas',
      '{ "action": "add_screen", "name": "Home" }',
      '```',
      'Summary.'
    ].join('\n')
    expect(stripUnfencedCanvasToolCalls(input)).toBe(input)
  })

  it('findMatchingJsonObjectEnd respects quoted HTML', () => {
    const json = '{ "content": "<!DOCTYPE html>\\"quoted\\"" }'
    const end = findMatchingJsonObjectEnd(json, 0)
    expect(end).toBe(json.length - 1)
    expect(json.slice(0, end + 1)).toBe(json)
  })
})

describe('sanitizeAssistantCanvasToolDisplay', () => {
  it('trims trailing whitespace after stripping blobs', () => {
    expect(sanitizeAssistantCanvasToolDisplay('hello\n\n')).toBe('hello')
  })
})
