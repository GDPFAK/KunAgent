import { describe, expect, it } from 'vitest'
import { normalizeWorkflow } from '../shared/app-settings-workflow'
import type { WorkflowNodeKind, WorkflowV1 } from '../shared/app-settings'
import {
  checkWorkflowCode,
  computeWorkflowNextRunAt,
  cronNextRun,
  workflowHasScheduleTrigger
} from './workflow-runtime'

// Loose fixture builders — normalizeWorkflow fills name/position/disabled and
// per-kind config defaults at runtime, so tests pass partial nodes. The single
// cast in buildWorkflow keeps every call site type-clean without `as any`.
type NodeSpec = {
  id: string
  type: WorkflowNodeKind
  name?: string
  disabled?: boolean
  config?: Record<string, unknown>
}
type WorkflowSpec = Omit<Partial<WorkflowV1>, 'nodes'> & { nodes?: NodeSpec[] }

function buildWorkflow(partial: WorkflowSpec): WorkflowV1 {
  return normalizeWorkflow(partial as unknown as Partial<WorkflowV1>, 0, '2026-06-18T00:00:00.000Z')
}

describe('cronNextRun', () => {
  it('finds the next daily fire time', () => {
    const from = new Date('2026-06-18T08:00:00') // local time
    const next = cronNextRun('0 9 * * *', from)
    expect(next).not.toBeNull()
    expect(next!.getHours()).toBe(9)
    expect(next!.getMinutes()).toBe(0)
    expect(next!.getTime()).toBeGreaterThan(from.getTime())
  })

  it('handles step expressions', () => {
    const from = new Date('2026-06-18T10:07:00')
    const next = cronNextRun('*/15 * * * *', from)
    expect(next).not.toBeNull()
    expect(next!.getMinutes()).toBe(15)
    expect(next!.getHours()).toBe(10)
  })

  it('returns null for malformed expressions', () => {
    expect(cronNextRun('not a cron', new Date())).toBeNull()
    expect(cronNextRun('* * * *', new Date())).toBeNull()
    expect(cronNextRun('99 * * * *', new Date())).toBeNull()
  })
})

describe('computeWorkflowNextRunAt', () => {
  it('returns empty when the workflow is disabled', () => {
    const workflow = buildWorkflow({
      id: 'w',
      name: 'w',
      enabled: false,
      nodes: [{ id: 't', type: 'schedule-trigger', config: { schedule: { kind: 'interval', everyMinutes: 30 } } }],
      connections: []
    })
    expect(computeWorkflowNextRunAt(workflow, new Date())).toBe('')
  })

  it('computes the interval next run', () => {
    const workflow = buildWorkflow({
      id: 'w',
      name: 'w',
      enabled: true,
      nodes: [{ id: 't', type: 'schedule-trigger', config: { schedule: { kind: 'interval', everyMinutes: 30 } } }],
      connections: []
    })
    const from = new Date('2026-06-18T08:00:00.000Z')
    expect(computeWorkflowNextRunAt(workflow, from)).toBe(new Date(from.getTime() + 30 * 60_000).toISOString())
  })

  it('returns empty when there is no schedule trigger', () => {
    const workflow = buildWorkflow({
      id: 'w',
      name: 'w',
      enabled: true,
      nodes: [{ id: 'm', type: 'manual-trigger', config: {} }],
      connections: []
    })
    expect(computeWorkflowNextRunAt(workflow, new Date())).toBe('')
    expect(workflowHasScheduleTrigger(workflow)).toBe(false)
  })

  it('detects an active schedule trigger', () => {
    const workflow = buildWorkflow({
      id: 'w',
      name: 'w',
      enabled: true,
      nodes: [{ id: 't', type: 'schedule-trigger', config: { schedule: { kind: 'daily', timeOfDay: '09:00' } } }],
      connections: []
    })
    expect(workflowHasScheduleTrigger(workflow)).toBe(true)
  })
})

describe('checkWorkflowCode', () => {
  it('accepts valid JavaScript', async () => {
    expect(await checkWorkflowCode('javascript', 'return { value: $json }')).toEqual({ status: 'ok' })
  })

  it('reports a JavaScript syntax error', async () => {
    const result = await checkWorkflowCode('javascript', 'return {{{ broken')
    expect(result.status).toBe('error')
    if (result.status === 'error') expect(result.message.length).toBeGreaterThan(0)
  })

  it('treats empty code as ok', async () => {
    expect(await checkWorkflowCode('python', '   ')).toEqual({ status: 'ok' })
  })

  it('accepts valid bash and rejects a syntax error', async () => {
    expect(await checkWorkflowCode('bash', 'echo "$WORKFLOW_TEXT"')).toEqual({ status: 'ok' })
    const bad = await checkWorkflowCode('bash', 'if [ 1 ]; then echo hi')
    expect(bad.status).toBe('error')
  })
})
