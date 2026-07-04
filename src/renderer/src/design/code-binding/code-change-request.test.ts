import { describe, expect, it } from 'vitest'
import type { DesignOperation } from '../graph/design-graph-types'
import type { DesignCodeBinding } from './code-binding-types'
import { designOperationsToCodeChangePlan } from './code-change-request'

const createdAt = '2026-07-02T00:00:00.000Z'

function operation(id: string, payload: DesignOperation['payload']): DesignOperation {
  return {
    id,
    type: 'update_shape',
    label: 'design update',
    source: 'agent',
    createdAt,
    targetIds: [],
    payload
  }
}

function binding(designObjectId: string, patch: Partial<DesignCodeBinding> = {}): DesignCodeBinding {
  return {
    id: `binding_${designObjectId}`,
    designObjectId,
    kind: 'dom-node',
    status: 'active',
    createdAt,
    target: {
      sourceFile: 'src/app/page.tsx',
      componentName: 'Hero',
      onlookId: `oid_${designObjectId}`
    },
    ...patch
  }
}

describe('design operations to code change requests', () => {
  it('converts text, style and layout updates for bound objects', () => {
    const plan = designOperationsToCodeChangePlan(
      [
        operation('op_1', {
          op: 'update',
          id: 'shape_1',
          patch: {
            textContent: 'Start trial',
            fills: [{ type: 'solid', color: '#3b82d8', opacity: 1 }],
            x: 20,
            y: 40
          }
        })
      ],
      [binding('shape_1')]
    )

    expect(plan.skipped).toEqual([])
    expect(plan.requests.map((request) => request.kind)).toEqual(['edit-text', 'update-style', 'update-layout'])
    expect(plan.requests[0]).toMatchObject({
      designObjectId: 'shape_1',
      bindingId: 'binding_shape_1',
      sourceFile: 'src/app/page.tsx',
      componentName: 'Hero',
      onlookId: 'oid_shape_1',
      payload: { textContent: 'Start trial' }
    })
    expect(plan.requests[1].payload).toEqual({
      fills: [{ type: 'solid', color: '#3b82d8', opacity: 1 }]
    })
    expect(plan.requests[2].payload).toEqual({ x: 20, y: 40 })
  })

  it('converts set-style, move, resize and delete ops', () => {
    const plan = designOperationsToCodeChangePlan(
      [
        operation('op_style', {
          op: 'set-style',
          ids: ['shape_1', 'shape_2'],
          style: { opacity: 0.5, fontColor: '#111827' }
        }),
        operation('op_move', { op: 'move', ids: ['shape_1'], dx: 8, dy: 12 }),
        operation('op_resize', { op: 'resize', id: 'shape_2', bounds: { x: 0, y: 0, width: 320, height: 180 } }),
        operation('op_delete', { op: 'delete', id: 'shape_2' })
      ],
      [binding('shape_1'), binding('shape_2')]
    )

    expect(plan.skipped).toEqual([])
    expect(plan.requests.map((request) => request.kind)).toEqual([
      'update-style',
      'update-style',
      'update-layout',
      'update-layout',
      'remove-node'
    ])
    expect(plan.requests.find((request) => request.id.startsWith('op_move'))?.payload).toEqual({ dx: 8, dy: 12 })
  })

  it('skips unbound or non-shape operations explicitly', () => {
    const plan = designOperationsToCodeChangePlan(
      [
        operation('op_unbound', { op: 'update', id: 'shape_missing', patch: { textContent: 'No binding' } }),
        { ...operation('op_bad', { anything: true }), payload: { anything: true } }
      ],
      [binding('shape_1', { status: 'stale' })]
    )

    expect(plan.requests).toEqual([])
    expect(plan.skipped).toEqual([
      { operationId: 'op_unbound', reason: 'No active code binding for operation targets.' },
      { operationId: 'op_bad', reason: 'Operation payload is not a shape op.' }
    ])
  })
})
