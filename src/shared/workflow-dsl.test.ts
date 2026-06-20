import { describe, expect, it } from 'vitest'
import { exportWorkflowDsl, parseWorkflowDsl, serializeWorkflowDsl } from './workflow-dsl'
import { normalizeWorkflow } from './app-settings-workflow'
import type { WorkflowV1 } from './app-settings-types'

const NOW = '2026-06-19T00:00:00.000Z'

function makeWorkflow(): WorkflowV1 {
  return normalizeWorkflow(
    {
      id: 'wf-source',
      name: 'My Loop',
      enabled: true,
      callableByAgent: true,
      env: [
        { key: 'PUBLIC', value: 'hello', type: 'string' },
        { key: 'TOKEN', value: 's3cr3t', type: 'secret' }
      ],
      nodes: [
        { id: 'm', type: 'manual-trigger', name: '', position: { x: 0, y: 0 }, disabled: false, config: { workspaceRoot: '' } },
        {
          id: 'o',
          type: 'output',
          name: '',
          position: { x: 200, y: 0 },
          disabled: false,
          config: { mode: 'auto', textTemplate: '', jsonPath: '' }
        }
      ],
      connections: [{ id: 'e1', source: 'm', sourceHandle: 'out', target: 'o', targetHandle: 'in' }],
      runs: [
        {
          id: 'run-1',
          trigger: 'manual',
          status: 'success',
          startedAt: NOW,
          finishedAt: NOW,
          message: 'ok',
          nodeResults: []
        }
      ]
    },
    0,
    NOW
  )
}

describe('workflow-dsl', () => {
  it('strips secret values, run history, and resets volatile fields on export', () => {
    const dsl = exportWorkflowDsl(makeWorkflow(), 'deepseek-gui', NOW)
    expect(dsl.dsv).toBe(1)
    expect(dsl.kind).toBe('workflow')
    expect(dsl.workflow.enabled).toBe(false)
    expect(dsl.workflow.callableByAgent).toBe(false)
    expect(dsl.workflow.runs).toEqual([])
    const secret = dsl.workflow.env.find((entry) => entry.key === 'TOKEN')
    expect(secret?.value).toBe('')
    const pub = dsl.workflow.env.find((entry) => entry.key === 'PUBLIC')
    expect(pub?.value).toBe('hello')
  })

  it('round-trips a workflow through serialize → parse', () => {
    const text = serializeWorkflowDsl(makeWorkflow(), 'deepseek-gui', NOW)
    const result = parseWorkflowDsl(text, NOW)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.workflow.nodes.map((node) => node.type)).toEqual(['manual-trigger', 'output'])
    expect(result.workflow.connections).toHaveLength(1)
    expect(result.workflow.enabled).toBe(false)
    expect(result.workflow.runs).toEqual([])
  })

  it('accepts a bare workflow object (no DSL wrapper)', () => {
    const bare = JSON.stringify(makeWorkflow())
    const result = parseWorkflowDsl(bare, NOW)
    expect(result.ok).toBe(true)
  })

  it('rejects invalid json and unsupported payloads', () => {
    expect(parseWorkflowDsl('not json', NOW)).toEqual({ ok: false, error: 'invalid-json' })
    expect(parseWorkflowDsl('{"foo":1}', NOW)).toEqual({ ok: false, error: 'unsupported' })
  })
})
