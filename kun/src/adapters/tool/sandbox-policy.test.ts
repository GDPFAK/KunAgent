import { describe, expect, it } from 'vitest'
import { canWritePath, sandboxBlockForTool } from './sandbox-policy.js'

describe('sandbox policy', () => {
  it('limits workspace-write file mutations to the workspace', async () => {
    const context = {
      workspace: '/repo/workspace',
      sandboxMode: 'workspace-write' as const
    }

    await expect(canWritePath('/repo/workspace/src/app.ts', context)).resolves.toEqual({ ok: true })
    await expect(canWritePath('/repo/other/app.ts', context)).resolves.toMatchObject({
      ok: false,
      block: {
        code: 'sandbox_write_blocked'
      }
    })
  })

  it('allows command execution in workspace-write mode', () => {
    expect(sandboxBlockForTool(
      { name: 'bash', toolKind: 'command_execution' },
      { sandboxMode: 'workspace-write' }
    )).toBeNull()
  })
})
