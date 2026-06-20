import { describe, expect, it } from 'vitest'
import { resolveConfiguredHooks } from './hook-config.js'

describe('resolveConfiguredHooks', () => {
  it('resolves a workflow entry to an in-process run hook', () => {
    const hooks = resolveConfiguredHooks([
      {
        phase: 'PostToolUse',
        toolNames: ['write', 'edit'],
        workflow: 'wf-1',
        mode: 'rewrite',
        baseUrl: 'http://127.0.0.1:8765',
        timeoutMs: 15_000
      }
    ])
    expect(hooks).toHaveLength(1)
    const hook = hooks[0]
    expect(hook.phase).toBe('PostToolUse')
    expect(hook.toolNames).toEqual(['write', 'edit'])
    expect(hook.timeoutMs).toBe(15_000)
    expect('run' in hook && typeof hook.run === 'function').toBe(true)
    expect('command' in hook).toBe(false)
  })

  it('still resolves a command entry to a command hook', () => {
    const hooks = resolveConfiguredHooks([{ phase: 'PreToolUse', command: 'echo hi', cwd: '/tmp' }])
    expect(hooks).toHaveLength(1)
    const hook = hooks[0]
    expect('command' in hook && hook.command).toBe('echo hi')
    expect('run' in hook).toBe(false)
  })
})
