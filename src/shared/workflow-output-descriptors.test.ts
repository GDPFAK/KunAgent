import { describe, expect, it } from 'vitest'
import { describeNodeOutput, extractNodeRefs, varTypeToInputType } from './workflow-output-descriptors'
import type { WorkflowNodeV1 } from './app-settings-types'

/** Minimal node builder — the cast keeps the per-kind config literal-friendly for tests. */
function node(type: WorkflowNodeV1['type'], config: unknown): WorkflowNodeV1 {
  return { id: 'n', type, name: '', position: { x: 0, y: 0 }, disabled: false, config } as WorkflowNodeV1
}

describe('describeNodeOutput', () => {
  it('describes the ai-agent text output', () => {
    const out = describeNodeOutput(
      node('ai-agent', { prompt: '', workspaceRoot: '', providerId: '', model: '', reasoningEffort: 'medium', mode: 'agent' })
    )
    expect(out).toEqual([{ key: 'text', type: 'string' }])
  })

  it('describes the generate-image output', () => {
    const out = describeNodeOutput(node('generate-image', { prompt: '', providerId: '', model: '', size: '', outputDir: '' }))
    expect(out.map((v) => v.key)).toEqual(['imagePath', 'mimeType'])
  })

  it('http exposes status/body only when not parsing JSON', () => {
    const base = { method: 'GET', url: '', headers: [], body: '', timeoutMs: 1000, parseJson: false }
    expect(describeNodeOutput(node('http-request', base)).map((v) => v.key)).toEqual(['status', 'body'])
    expect(describeNodeOutput(node('http-request', { ...base, parseJson: true }))).toEqual([])
  })

  it('parameter-extractor derives typed fields from its config', () => {
    const config = {
      source: '',
      instruction: '',
      providerId: '',
      model: '',
      reasoningEffort: 'medium',
      fields: [
        { key: 'name', label: '', type: 'text', required: false, options: [], defaultValue: '', description: '' },
        { key: 'age', label: '', type: 'number', required: false, options: [], defaultValue: '', description: '' }
      ]
    }
    expect(describeNodeOutput(node('parameter-extractor', config))).toEqual([
      { key: 'name', type: 'string' },
      { key: 'age', type: 'number' }
    ])
  })

  it('set-fields lists fields for payload scope but is opaque for run scope', () => {
    const fields = [{ key: 'a', value: '' }, { key: 'b', value: '' }]
    expect(describeNodeOutput(node('set-fields', { fields, keepIncoming: false })).map((v) => v.key)).toEqual(['a', 'b'])
    expect(describeNodeOutput(node('set-fields', { fields, keepIncoming: false, scope: 'run' }))).toEqual([])
  })

  it('aggregate output depends on its mode', () => {
    const cfg = (mode: string) => ({ mode, field: '', separator: '' })
    expect(describeNodeOutput(node('aggregate', cfg('sum'))).map((v) => v.key)).toEqual(['sum'])
    expect(describeNodeOutput(node('aggregate', cfg('join'))).map((v) => v.key)).toEqual(['text'])
    expect(describeNodeOutput(node('aggregate', cfg('collect'))).map((v) => v.key)).toEqual(['values'])
  })

  it('opaque / pass-through kinds return no typed fields', () => {
    expect(describeNodeOutput(node('code', { language: 'javascript', code: '' }))).toEqual([])
    expect(describeNodeOutput(node('condition', { leftExpr: '', operator: 'contains', rightValue: '', caseSensitive: false }))).toEqual([])
    expect(describeNodeOutput(node('merge', { mode: 'array' }))).toEqual([])
  })
})

describe('extractNodeRefs', () => {
  it('parses $nodes references and normalizes the first field', () => {
    expect(extractNodeRefs('hi {{$nodes.abc.json.title}} and {{$nodes.xyz.text}}')).toEqual([
      { token: '{{$nodes.abc.json.title}}', nodeId: 'abc', firstField: 'title' },
      { token: '{{$nodes.xyz.text}}', nodeId: 'xyz', firstField: '' }
    ])
  })

  it('treats whole-node json as a fieldless reference', () => {
    expect(extractNodeRefs('{{$nodes.abc.json}}')).toEqual([{ token: '{{$nodes.abc.json}}', nodeId: 'abc', firstField: '' }])
  })

  it('ignores common-scope templates', () => {
    expect(extractNodeRefs('{{text}} {{json.x}} {{$env.A}} {{$input.k}}')).toEqual([])
  })
})

describe('varTypeToInputType', () => {
  it('maps var types to the binding vocabulary', () => {
    expect(varTypeToInputType('number')).toBe('number')
    expect(varTypeToInputType('boolean')).toBe('boolean')
    expect(varTypeToInputType('object')).toBe('json')
    expect(varTypeToInputType('json')).toBe('json')
    expect(varTypeToInputType('any')).toBe('text')
    expect(varTypeToInputType('string')).toBe('text')
  })
})
