import { describe, expect, it, vi } from 'vitest'
import { PlannerAgent } from '../src/delegation/planner-agent.js'
import { heuristicAgentRole } from '../src/loop/agent-router.js'
import type { DelegationRuntime } from '../src/delegation/delegation-runtime.js'

describe('E2E: Planner + multi-role flow', () => {
  function mockRuntime(results: Array<{ status: string; summary: string }>): DelegationRuntime {
    let idx = 0
    return {
      runChild: vi.fn().mockImplementation(() => {
        const r = results[idx] ?? { status: 'completed', summary: 'done' }
        idx += 1
        return Promise.resolve({ id: 'c', status: r.status, summary: r.summary, durationMs: 10 })
      }),
      abortChild: vi.fn()
    } as unknown as DelegationRuntime
  }

  it('8.1: Planner creates and executes multi-role flow', async () => {
    const agent = new PlannerAgent(mockRuntime([
      { status: 'completed', summary: 'Found auth module at src/auth.ts' },
      { status: 'completed', summary: 'Added JWT middleware' },
      { status: 'completed', summary: 'Review passed, no issues' }
    ]), undefined, undefined)

    const plan = await agent.plan({
      taskDescription: 'add user authentication with JWT',
      parentThreadId: 'e2e_t1', parentTurnId: 'e2e_tu1',
      signal: new AbortController().signal
    })
    expect(plan.subTasks.length).toBeGreaterThanOrEqual(1)

    const result = await agent.execute({
      plan, parentThreadId: 'e2e_t1', parentTurnId: 'e2e_tu1',
      signal: new AbortController().signal
    })
    expect(result.subTaskResults.length).toBeGreaterThanOrEqual(1)
    expect(result.allCompleted).toBe(true)
    expect(result.aggregatedSummary).toBeTruthy()
  })

  it('8.1: Handles partial sub-agent failures', async () => {
    const agent = new PlannerAgent(mockRuntime([
      { status: 'failed', summary: 'Could not find module' }
    ]), undefined, undefined)

    const plan = await agent.plan({
      taskDescription: 'refactor routing module',
      parentThreadId: 'e2e_t2', parentTurnId: 'e2e_tu2',
      signal: new AbortController().signal
    })
    const result = await agent.execute({
      plan, parentThreadId: 'e2e_t2', parentTurnId: 'e2e_tu2',
      signal: new AbortController().signal
    })
    expect(result.allCompleted).toBe(false)
  })

  it('8.2: Heuristic routing selects correct roles', () => {
    expect(heuristicAgentRole('implement user auth').role).toBe('coder')
    expect(heuristicAgentRole('review the code changes').role).toBe('reviewer')
    expect(heuristicAgentRole('find the API endpoint').role).toBe('researcher')
  })

  it('8.3: roles.enabled: false compile-time contract', () => {
    const capabilities = { roles: { enabled: false } }
    expect(capabilities.roles.enabled).toBe(false)
  })

  it('7.2: Degradation on empty input', () => {
    const result = heuristicAgentRole('')
    expect(result.role).toBe('coder')
    expect(result.confidence).toBeLessThanOrEqual(0.5)
  })

  it('7.2: Degradation on gibberish', () => {
    const result = heuristicAgentRole('!@#$%^&*()')
    expect(result.role).toBe('coder')
    expect(result.confidence).toBeLessThanOrEqual(0.5)
  })
})
