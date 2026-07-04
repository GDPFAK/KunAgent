import { describe, expect, it, vi } from 'vitest'
import type { DesignCodeChangePlan, DesignCodeChangeRequest } from './code-change-request'
import { applyReactTailwindPlanToWorkspace } from './react-tailwind-workspace-adapter'

function codeRequest(partial: Partial<DesignCodeChangeRequest>): DesignCodeChangeRequest {
  return {
    id: partial.id ?? 'request_1',
    kind: partial.kind ?? 'edit-text',
    designObjectId: 'shape_1',
    bindingId: 'binding_1',
    ...(partial.sourceFile ? { sourceFile: partial.sourceFile } : {}),
    ...(partial.onlookId ? { onlookId: partial.onlookId } : {}),
    payload: partial.payload ?? {}
  }
}

describe('React Tailwind workspace adapter', () => {
  it('groups requests by source file and writes changed files', async () => {
    const readWorkspaceFile = vi.fn(async () => ({
      ok: true as const,
      path: 'src/app/page.tsx',
      content: '<button data-onlook-id="cta">Start</button>',
      size: 44,
      truncated: false
    }))
    const writeWorkspaceFile = vi.fn(async () => ({
      ok: true as const,
      path: 'src/app/page.tsx',
      savedAt: '2026-07-02T12:00:00.000Z'
    }))
    const plan: DesignCodeChangePlan = {
      requests: [
        codeRequest({
          id: 'request_text',
          sourceFile: 'src/app/page.tsx',
          onlookId: 'cta',
          payload: { textContent: 'Launch' }
        }),
        codeRequest({
          id: 'request_missing_source',
          sourceFile: undefined,
          onlookId: 'cta',
          payload: { textContent: 'Skip' }
        })
      ],
      skipped: [{ operationId: 'op_unbound', reason: 'No active code binding for operation targets.' }]
    }

    const result = await applyReactTailwindPlanToWorkspace({
      workspaceRoot: '/workspace',
      plan,
      adapter: { readWorkspaceFile, writeWorkspaceFile }
    })

    expect(readWorkspaceFile).toHaveBeenCalledWith({ workspaceRoot: '/workspace', path: 'src/app/page.tsx' })
    expect(writeWorkspaceFile).toHaveBeenCalledWith({
      workspaceRoot: '/workspace',
      path: 'src/app/page.tsx',
      content: '<button data-onlook-id="cta">Launch</button>'
    })
    expect(result.written).toEqual([{ sourceFile: 'src/app/page.tsx', requestIds: ['request_text'] }])
    expect(result.skipped).toEqual([
      { requestId: 'op_unbound', reason: 'No active code binding for operation targets.' },
      { requestId: 'request_missing_source', reason: 'Request has no sourceFile binding.' }
    ])
  })

  it('does not write truncated source files', async () => {
    const readWorkspaceFile = vi.fn(async () => ({
      ok: true as const,
      path: 'src/app/page.tsx',
      content: '<button data-onlook-id="cta">Start</button>',
      size: 44,
      truncated: true
    }))
    const writeWorkspaceFile = vi.fn()

    const result = await applyReactTailwindPlanToWorkspace({
      workspaceRoot: '/workspace',
      plan: {
        requests: [
          codeRequest({
            id: 'request_text',
            sourceFile: 'src/app/page.tsx',
            onlookId: 'cta',
            payload: { textContent: 'Launch' }
          })
        ],
        skipped: []
      },
      adapter: { readWorkspaceFile, writeWorkspaceFile }
    })

    expect(writeWorkspaceFile).not.toHaveBeenCalled()
    expect(result).toEqual({
      written: [],
      skipped: [{ requestId: 'request_text', reason: 'Source file read was truncated.' }]
    })
  })
})
