import { describe, expect, it } from 'vitest'
import {
  extractPlanTodos,
  makePlanTodoId,
  mergePlanTodos,
  normalizePlanRelativePath,
  normalizeTodoContent,
  patchPlanTodoStatus,
  sourceKey,
  todoContentHash,
  type ExtractedPlanTodo
} from '../src/shared/todos.js'
import type { ThreadTodoItem, ThreadTodoList } from '../src/contracts/threads.js'

const NOW = '2026-01-01T00:00:00.000Z'
const PLAN_ID = 'plan-1'
const RELATIVE_PATH = './docs/plan.md'

function extract(
  markdown: string,
  overrides: Partial<Parameters<typeof extractPlanTodos>[0]> = {}
): ExtractedPlanTodo[] {
  return extractPlanTodos({
    markdown,
    planId: PLAN_ID,
    relativePath: RELATIVE_PATH,
    threadId: 'thread-1',
    now: NOW,
    ...overrides
  })
}

function todoList(items: ThreadTodoItem[]): ThreadTodoList {
  return { threadId: 'thread-1', items, updatedAt: NOW }
}

describe('normalizeTodoContent', () => {
  it('collapses runs of whitespace into single spaces and trims', () => {
    expect(normalizeTodoContent('  a   b\tc  ')).toBe('a b c')
    expect(normalizeTodoContent('a\nb')).toBe('a b')
  })

  it('returns an empty string for whitespace-only input', () => {
    expect(normalizeTodoContent('   ')).toBe('')
    expect(normalizeTodoContent('\t')).toBe('')
  })
})

describe('todoContentHash', () => {
  it('is deterministic for identical input', () => {
    expect(todoContentHash('Write tests')).toBe(todoContentHash('Write tests'))
  })

  it('is case-insensitive after normalization', () => {
    expect(todoContentHash('Write Tests')).toBe(todoContentHash('WRITE TESTS'))
  })

  it('is unaffected by internal whitespace differences', () => {
    expect(todoContentHash('Write  tests')).toBe(todoContentHash('Write tests'))
  })

  it('produces a stable base36 string', () => {
    expect(todoContentHash('Write tests')).toMatch(/^[0-9a-z]+$/)
  })
})

describe('makePlanTodoId', () => {
  it('prefixes the hash with the plan namespace', () => {
    expect(
      makePlanTodoId({
        planId: PLAN_ID,
        relativePath: 'plan.md',
        ordinal: 0,
        contentHash: 'abc'
      })
    ).toMatch(/^todo_plan_/)
  })

  it('derives the same id from the same identity inputs', () => {
    const id = makePlanTodoId({
      planId: PLAN_ID,
      relativePath: 'plan.md',
      ordinal: 0,
      contentHash: 'abc'
    })
    expect(
      makePlanTodoId({
        planId: PLAN_ID,
        relativePath: 'plan.md',
        ordinal: 0,
        contentHash: 'abc'
      })
    ).toBe(id)
  })

  it('differs when the ordinal changes', () => {
    const a = makePlanTodoId({ planId: PLAN_ID, relativePath: 'plan.md', ordinal: 0, contentHash: 'abc' })
    const b = makePlanTodoId({ planId: PLAN_ID, relativePath: 'plan.md', ordinal: 1, contentHash: 'abc' })
    expect(a).not.toBe(b)
  })
})

describe('normalizePlanRelativePath', () => {
  it('flips backslashes to forward slashes', () => {
    expect(normalizePlanRelativePath('a\\b\\c')).toBe('a/b/c')
  })

  it('collapses repeated slashes', () => {
    expect(normalizePlanRelativePath('a//b///c')).toBe('a/b/c')
  })

  it('strips a leading ./ segment', () => {
    expect(normalizePlanRelativePath('./a/b')).toBe('a/b')
  })

  it('normalizes a mixed Windows + dot path', () => {
    expect(normalizePlanRelativePath('.\\a\\b//c/')).toBe('a/b/c/')
  })
})

describe('extractPlanTodos', () => {
  it('parses checked and unchecked tasks and assigns ordinals in order', () => {
    const items = extract('- [x] done task\n- [ ] pending task\n')
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ content: 'done task', status: 'completed' })
    expect(items[1]).toMatchObject({ content: 'pending task', status: 'pending' })
    expect(items.map((item) => item.source.ordinal)).toEqual([0, 1])
  })

  it('accepts -, * and + bullets and both x and X markers', () => {
    const items = extract(
      '- [x] a\n* [X] b\n+ [ ] c\n'
    )
    expect(items.map((item) => item.content)).toEqual(['a', 'b', 'c'])
    expect(items.map((item) => item.status)).toEqual(['completed', 'completed', 'pending'])
  })

  it('normalizes whitespace inside the task content', () => {
    const items = extract('- [x]  extra   spaces \n')
    expect(items[0].content).toBe('extra spaces')
  })

  it('ignores lines that are not markdown tasks', () => {
    const items = extract('# heading\n- not a task\n- [ ] real task\n- []\n')
    expect(items.map((item) => item.content)).toEqual(['real task'])
  })

  it('stamps createdAt/updatedAt with the provided timestamp', () => {
    const items = extract('- [ ] task\n', { now: NOW })
    expect(items[0].createdAt).toBe(NOW)
    expect(items[0].updatedAt).toBe(NOW)
  })

  it('derives stable ids for the same plan content across calls', () => {
    const first = extract('- [ ] task\n')
    const second = extract('- [ ] task\n')
    expect(second[0].id).toBe(first[0].id)
  })

  it('normalizes the relative path in the embedded source', () => {
    const items = extract('- [ ] task\n', { relativePath: '.\\docs\\plan.md' })
    expect(items[0].source?.relativePath).toBe('docs/plan.md')
  })
})

describe('patchPlanTodoStatus', () => {
  it('rewrites a pending task marker to checked when patching to completed', () => {
    const md = '# Plan\n- [ ] task one\n- [x] task two\n'
    const items = extract(md)
    const res = patchPlanTodoStatus(md, {
      status: 'completed',
      source: items[0].source,
      content: items[0].content
    })
    expect(res.changed).toBe(true)
    expect(res.markdown).toBe('# Plan\n- [x] task one\n- [x] task two\n')
  })

  it('rewrites a checked task marker to pending when patching away from completed', () => {
    const md = '- [x] task one\n'
    const items = extract(md)
    const res = patchPlanTodoStatus(md, {
      status: 'pending',
      source: items[0].source,
      content: items[0].content
    })
    expect(res.changed).toBe(true)
    expect(res.markdown).toBe('- [ ] task one\n')
  })

  it('is a no-op when the marker already matches the target status', () => {
    const md = '- [x] task one\n'
    const items = extract(md)
    const res = patchPlanTodoStatus(md, {
      status: 'completed',
      source: items[0].source,
      content: items[0].content
    })
    expect(res.changed).toBe(false)
    expect(res.markdown).toBe(md)
  })

  it('preserves CRLF line endings across the patch', () => {
    const md = '- [ ] task one\r\n- [x] task two\r\n'
    const items = extract(md)
    const res = patchPlanTodoStatus(md, {
      status: 'completed',
      source: items[0].source,
      content: items[0].content
    })
    expect(res.changed).toBe(true)
    expect(res.markdown.includes('\r\n')).toBe(true)
    expect(res.markdown).toBe('- [x] task one\r\n- [x] task two\r\n')
  })

  it('returns unchanged when the item has no plan source', () => {
    const md = '- [ ] task one\n'
    const res = patchPlanTodoStatus(md, {
      status: 'completed',
      source: undefined,
      content: 'task one'
    })
    expect(res).toEqual({ markdown: md, changed: false })
  })

  it('falls back to content-hash matching when ordinal has shifted', () => {
    const md = '- [ ] task one\n'
    const items = extract(md)
    // Simulate the task moving position (ordinal now 1) while content stays equal.
    const shiftedSource = { ...items[0].source, ordinal: 5 } as ExtractedPlanTodo['source']
    const res = patchPlanTodoStatus(md, {
      status: 'completed',
      source: shiftedSource,
      content: items[0].content
    })
    expect(res.changed).toBe(true)
    expect(res.markdown).toBe('- [x] task one\n')
  })
})

describe('mergePlanTodos', () => {
  it('returns the plan items untouched when there is no existing list', () => {
    const planItems = extract('- [ ] task one\n- [x] task two\n')
    const merged = mergePlanTodos({ threadId: 'thread-1', existing: null, planItems, now: NOW })
    expect(merged.threadId).toBe('thread-1')
    expect(merged.updatedAt).toBe(NOW)
    expect(merged.items.map((item) => item.status)).toEqual(['pending', 'completed'])
  })

  it('reuses the existing id and timestamps when the same plan item is merged', () => {
    const planItems = extract('- [ ] task one\n')
    const earlier = '2025-01-01T00:00:00.000Z'
    const existing: ThreadTodoList = todoList([
      {
        id: planItems[0].id,
        content: 'task one',
        status: 'pending',
        createdAt: earlier,
        updatedAt: earlier,
        source: planItems[0].source
      }
    ])
    const merged = mergePlanTodos({ threadId: 'thread-1', existing, planItems, now: NOW })
    expect(merged.items[0].id).toBe(planItems[0].id)
    expect(merged.items[0].createdAt).toBe(earlier)
    expect(merged.items[0].updatedAt).toBe(earlier)
  })

  it('preserves an existing completed status when preserveCompleted is set', () => {
    const planItems = extract('- [ ] task one\n')
    const existing = todoList([
      {
        id: planItems[0].id,
        content: 'task one',
        status: 'completed',
        createdAt: NOW,
        updatedAt: NOW,
        source: planItems[0].source
      }
    ])
    const merged = mergePlanTodos({
      threadId: 'thread-1',
      existing,
      planItems,
      now: NOW,
      preserveCompleted: true
    })
    expect(merged.items[0].status).toBe('completed')
  })

  it('orphaned plan items are kept but stripped of their plan source', () => {
    const planItems = extract('- [ ] gone task\n')
    const existing = todoList([...planItems])
    const merged = mergePlanTodos({ threadId: 'thread-1', existing, planItems: [], now: NOW })
    expect(merged.items).toHaveLength(1)
    expect(merged.items[0].content).toBe('gone task')
    expect(merged.items[0].source).toBeUndefined()
    expect(merged.items[0].updatedAt).toBe(NOW)
  })

  it('keeps non-plan existing items verbatim', () => {
    const planItems = extract('- [ ] task one\n')
    const manual: ThreadTodoItem = {
      id: 'manual-1',
      content: 'manual note',
      status: 'pending',
      createdAt: NOW,
      updatedAt: NOW
    }
    const existing = todoList([manual])
    const merged = mergePlanTodos({ threadId: 'thread-1', existing, planItems, now: NOW })
    const manualItem = merged.items.find((item) => item.id === 'manual-1')
    expect(manualItem).toEqual(manual)
  })
})

describe('sourceKey', () => {
  it('serializes the full plan source identity', () => {
    const items = extract('- [ ] task\n')
    const key = sourceKey(items[0].source!)
    expect(key).toBe(`plan:${PLAN_ID}:docs/plan.md:0:${items[0].source!.contentHash}`)
  })

  it('produces different keys for different ordinals', () => {
    const items = extract('- [ ] a\n- [ ] b\n')
    expect(sourceKey(items[0].source!)).not.toBe(sourceKey(items[1].source!))
  })
})
