import { describe, expect, it, vi } from 'vitest'
import { PlannerAgent } from './planner-agent.js'
import type { DelegationRuntime } from './delegation-runtime.js'
function createMockRuntime() { return { runChild: vi.fn().mockResolvedValue({ id: 'c1', status: 'completed', summary: 'done', durationMs: 50 }) } as unknown as DelegationRuntime }
describe('PlannerAgent', () => {
  it('creates plan', async () => {
    const agent = new PlannerAgent(createMockRuntime(), undefined, undefined);
    const plan = await agent.plan({ taskDescription: 'implement login', parentThreadId: 't1', parentTurnId: 'tu1', signal: new AbortController().signal });
    expect(plan.title).toBeTruthy();
    expect(plan.subTasks.length).toBeGreaterThanOrEqual(1);
    expect(plan.subTasks[0].assignedRole).toBe('coder');
  });
  it('executes plan', async () => {
    const agent = new PlannerAgent(createMockRuntime(), undefined, undefined);
    const plan = await agent.plan({ taskDescription: 'fix bug', parentThreadId: 't1', parentTurnId: 'tu1', signal: new AbortController().signal });
    const result = await agent.execute({ plan, parentThreadId: 't1', parentTurnId: 'tu1', signal: new AbortController().signal });
    expect(result.subTaskResults.length).toBeGreaterThanOrEqual(1);
    expect(result.allCompleted).toBe(true);
  });
  it('handles failure', async () => {
    const fail = { runChild: vi.fn().mockRejectedValue(new Error('fail')) } as unknown as DelegationRuntime;
    const agent = new PlannerAgent(fail, undefined, undefined);
    const plan = await agent.plan({ taskDescription: 'test', parentThreadId: 't1', parentTurnId: 'tu1', signal: new AbortController().signal });
    const result = await agent.execute({ plan, parentThreadId: 't1', parentTurnId: 'tu1', signal: new AbortController().signal });
    expect(result.allCompleted).toBe(false);
  });
  it('handles abort', async () => {
    const ctrl = new AbortController(); ctrl.abort();
    const agent = new PlannerAgent(createMockRuntime(), undefined, undefined);
    const plan = await agent.plan({ taskDescription: 'test', parentThreadId: 't1', parentTurnId: 'tu1', signal: ctrl.signal });
    const result = await agent.execute({ plan, parentThreadId: 't1', parentTurnId: 'tu1', signal: ctrl.signal });
    expect(result.subTaskResults[0].status).toBe('aborted');
  });
});
