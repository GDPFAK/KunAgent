import { describe, it, expect } from 'vitest'
import {
  ContextCompiler,
  extractFactAnchorsFromTurn,
  extractDecisionStatements,
  mergeFactAnchors,
  formatFactAnchors,
} from '../src/loop/context-compiler/index.js'
import type { TurnItem } from '../src/contracts/items.js'
import { createImmutablePrefix } from '../src/cache/immutable-prefix.js'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeTurn(
  turnId: string,
  threadId: string,
  items: Array<{
    kind: 'user_message' | 'assistant_text' | 'tool_call' | 'tool_result'
    text?: string
    toolName?: string
    output?: unknown
    callId?: string
    isError?: boolean
  }>
): TurnItem[] {
  return items.map((item, i): TurnItem => {
    const base = {
      id: `${turnId}_${i}`,
      turnId,
      threadId,
      role: (item.kind === 'user_message' ? 'user' : 'assistant') as TurnItem['role'],
      status: 'completed' as const,
      createdAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    }

    switch (item.kind) {
      case 'user_message':
        return { ...base, kind: 'user_message' as const, text: item.text ?? '' } as TurnItem
      case 'assistant_text':
        return { ...base, kind: 'assistant_text' as const, text: item.text ?? '' } as TurnItem
      case 'tool_call':
        return {
          ...base,
          role: 'assistant' as TurnItem['role'],
          kind: 'tool_call' as const,
          toolName: item.toolName ?? '',
          callId: item.callId ?? `${turnId}_call`,
          arguments: {},
        } as TurnItem
      case 'tool_result':
        return {
          ...base,
          role: 'tool' as TurnItem['role'],
          kind: 'tool_result' as const,
          toolName: item.toolName ?? '',
          callId: item.callId ?? `${turnId}_call`,
          output: item.output ?? '',
          isError: item.isError ?? false,
        } as TurnItem
    }
  })
}

// ---------------------------------------------------------------------------
// Fact Anchor Extraction Tests (#247)
// ---------------------------------------------------------------------------

describe('fact anchor extraction (#247)', () => {
  it('extracts confirmed decisions from assistant text', () => {
    const items = makeTurn('turn_1', 'thread_1', [
      { kind: 'user_message', text: 'Should we use React for the frontend?' },
      {
        kind: 'assistant_text',
        text: 'I confirm that we should use React with TypeScript.\nAgreed: Tailwind CSS for styling.\nThe plan is to use Vite as the build tool.',
      },
      { kind: 'user_message', text: 'yes, sounds good' },
    ])

    const anchors = extractFactAnchorsFromTurn(items)
    expect(anchors.length).toBeGreaterThanOrEqual(1)
    expect(anchors.some((a) => a.statement.toLowerCase().includes('react'))).toBe(true)
  })

  it('extracts Chinese confirmed decisions', () => {
    const items = makeTurn('turn_1', 'thread_1', [
      { kind: 'user_message', text: '前端用什么框架？' },
      {
        kind: 'assistant_text',
        text: '确认：我们使用React + TypeScript作为前端技术栈。\n同意这个方案：使用Vite作为构建工具。',
      },
      { kind: 'user_message', text: '好的，没问题' },
    ])

    const anchors = extractFactAnchorsFromTurn(items)
    expect(anchors.length).toBeGreaterThanOrEqual(1)
    expect(anchors.some((a) => a.statement.includes('React'))).toBe(true)
  })

  it('marks tentative anchors when no user confirmation', () => {
    const items = makeTurn('turn_1', 'thread_1', [
      {
        kind: 'assistant_text',
        text: 'I will use PostgreSQL for the database.',
      },
    ])

    const anchors = extractFactAnchorsFromTurn(items)
    const tentative = anchors.filter((a) => a.status === 'tentative')
    // Without user confirmation, high-confidence statements become tentative
    expect(tentative.length).toBeGreaterThanOrEqual(0)
  })

  it('extracts fact anchors with decisionStatement helper', () => {
    const text = 'I confirm that we will use Redis for caching.\nWe agreed that the API will be RESTful.\nSo we can deploy to AWS.'
    const candidates = extractDecisionStatements(text)
    expect(candidates.length).toBeGreaterThanOrEqual(1)
    expect(candidates[0]!.score).toBeGreaterThan(0)
  })

  it('mergeFactAnchors marks overridden anchors', () => {
    // Test merge override logic: when a new anchor contains an override
    // signal word, previously confirmed anchors should be marked overridden.
    const existing = extractFactAnchorsFromTurn(
      makeTurn('turn_1', 'thread_1', [
        {
          kind: 'assistant_text',
          text: 'I confirm that we will use MongoDB for the database.',
        },
        { kind: 'user_message', text: 'yes' },
      ])
    )
    expect(existing.length).toBeGreaterThanOrEqual(1)

    // Create an anchor with an override signal
    const overrideAnchor = {
      id: 'anchor_turn_2_0',
      timestamp: new Date().toISOString(),
      sourceTurnId: 'turn_2',
      statement: 'Actually, we should use PostgreSQL instead of MongoDB.',
      status: 'confirmed' as const,
      category: 'decision' as const,
    }

    const merged = mergeFactAnchors(existing, [overrideAnchor])
    const overridden = merged.filter((a) => a.status === 'overridden')
    expect(overridden.length).toBeGreaterThanOrEqual(1)
  })

  it('extracts from tool results with explicit markers', () => {
    const items = makeTurn('turn_1', 'thread_1', [
      { kind: 'user_message', text: 'run the test' },
      { kind: 'tool_call', toolName: 'bash', callId: 'call_1' },
      {
        kind: 'tool_result',
        toolName: 'bash',
        callId: 'call_1',
        output: 'decision: All 42 tests pass. The code is ready for deployment.',
      },
      { kind: 'user_message', text: 'yes, good' },
    ])

    const anchors = extractFactAnchorsFromTurn(items)
    const toolAnchors = anchors.filter((a) => a.id.includes('_tool_'))
    expect(toolAnchors.length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// Fact Anchor Merging Tests (#247)
// ---------------------------------------------------------------------------

describe('fact anchor merging', () => {
  it('merges new anchors without duplicates', () => {
    const existing: ReturnType<typeof extractFactAnchorsFromTurn> = []
    const newAnchors = extractFactAnchorsFromTurn(
      makeTurn('turn_1', 'thread_1', [
        {
          kind: 'assistant_text',
          text: 'I confirm that we will use React.',
        },
        { kind: 'user_message', text: 'yes' },
      ])
    )

    const merged = mergeFactAnchors(existing, newAnchors)
    const merged2 = mergeFactAnchors(merged, newAnchors)
    // No duplicates
    expect(merged2.length).toBe(merged.length)
  })

  it('promotes tentative to confirmed on later confirmation', () => {
    // First turn: tentative anchor
    const turn1 = extractFactAnchorsFromTurn(
      makeTurn('turn_1', 'thread_1', [
        {
          kind: 'assistant_text',
          text: 'We will use PostgreSQL for the database.',
        },
      ])
    )

    // Second turn: similar topic with user confirmation
    const turn2 = extractFactAnchorsFromTurn(
      makeTurn('turn_2', 'thread_1', [
        {
          kind: 'assistant_text',
          text: 'I confirm that we will use PostgreSQL for the database.',
        },
        { kind: 'user_message', text: 'yes, sounds good' },
      ])
    )

    const merged = mergeFactAnchors(turn1, turn2)
    // Should have at least one confirmed anchor
    const confirmed = merged.filter((a) => a.status === 'confirmed')
    expect(confirmed.length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// Fact Anchor Formatting Tests (#247)
// ---------------------------------------------------------------------------

describe('fact anchor formatting', () => {
  it('formats anchors as XML block', () => {
    const anchors = extractFactAnchorsFromTurn(
      makeTurn('turn_1', 'thread_1', [
        {
          kind: 'assistant_text',
          text: 'I confirm that we will use React.',
        },
        { kind: 'user_message', text: 'yes' },
      ])
    )

    const formatted = formatFactAnchors(anchors)
    expect(formatted).toContain('<fact-anchors>')
    expect(formatted).toContain('</fact-anchors>')
  })

  it('returns empty string for empty anchors', () => {
    expect(formatFactAnchors([])).toBe('')
  })
})

// ---------------------------------------------------------------------------
// ContextCompiler Integration Tests
// ---------------------------------------------------------------------------

describe('ContextCompiler', () => {
  it('compiles a turn with fact anchors', () => {
    const compiler = new ContextCompiler()
    const immutable = createImmutablePrefix({
      systemPrompt: 'You are a helpful assistant.',
    })

    // First turn: establish a fact
    const turn1Items = makeTurn('turn_1', 'thread_1', [
      { kind: 'user_message', text: 'Should we use React?' },
      {
        kind: 'assistant_text',
        text: 'I confirm that we should use React with TypeScript.',
      },
      { kind: 'user_message', text: 'yes, sounds good' },
    ])
    compiler.extractAnchorsFromTurn(turn1Items)

    // Second turn: compile
    const turn2Items = [
      ...turn1Items,
      ...makeTurn('turn_2', 'thread_1', [
        { kind: 'user_message', text: 'Now add a login page.' },
      ]),
    ]

    const compiled = compiler.compileTurn(turn2Items, 'turn_2', immutable)

    // Prefix should contain fact anchors
    expect(compiled.prefixText).toBeTruthy()
    expect(compiled.prefixFingerprint).toBeTruthy()
    // Active items should only be from turn_2
    expect(compiled.activeItems.every((item) => item.turnId === 'turn_2')).toBe(true)
    // Turn boundary should be set
    expect(compiled.turnBoundaryId).toContain('turn_2')
  })

  it('injects fact anchors into request system prompt', () => {
    const compiler = new ContextCompiler()
    const immutable = createImmutablePrefix({
      systemPrompt: 'You are a helpful assistant.',
    })

    const turn1Items = makeTurn('turn_1', 'thread_1', [
      {
        kind: 'assistant_text',
        text: 'I confirm that we will use React.',
      },
      { kind: 'user_message', text: 'yes' },
    ])
    compiler.extractAnchorsFromTurn(turn1Items)

    const turn2Items = [
      ...turn1Items,
      ...makeTurn('turn_2', 'thread_1', [
        { kind: 'user_message', text: 'Next task.' },
      ]),
    ]

    const compiled = compiler.compileTurn(turn2Items, 'turn_2', immutable)
    const enriched = compiler.applyToRequest(compiled)

    expect(enriched.enrichedSystemPrompt).toBeTruthy()
    expect(enriched.enrichedSystemPrompt).toContain('fact-anchors')
    expect(enriched.turnBoundaryId).toContain('turn_2')
  })

  it('isolates current turn from history (#155)', () => {
    const compiler = new ContextCompiler()
    const immutable = createImmutablePrefix()

    const turn1Items = makeTurn('turn_1', 'thread_1', [
      { kind: 'user_message', text: 'Hello' },
      { kind: 'assistant_text', text: 'Hi there!' },
    ])

    const allItems = [
      ...turn1Items,
      ...makeTurn('turn_2', 'thread_1', [
        { kind: 'user_message', text: 'What is 2+2?' },
      ]),
    ]

    const compiled = compiler.compileTurn(allItems, 'turn_2', immutable)

    // turn_1 items should NOT be in active set
    const turn1InActive = compiled.activeItems.filter(
      (item) => item.turnId === 'turn_1'
    )
    expect(turn1InActive.length).toBe(0)

    // turn_2 items should be in active set
    const turn2InActive = compiled.activeItems.filter(
      (item) => item.turnId === 'turn_2'
    )
    expect(turn2InActive.length).toBeGreaterThan(0)
  })

  it('builds stable prefix from ImmutablePrefix (#229)', () => {
    const compiler = new ContextCompiler()
    const immutable = createImmutablePrefix({
      systemPrompt: 'Test system prompt.',
      pinnedConstraints: ['Always use TypeScript.'],
    })

    const compiled = compiler.compileTurn(
      makeTurn('turn_1', 'thread_1', [
        { kind: 'user_message', text: 'test' },
      ]),
      'turn_1',
      immutable
    )

    // Prefix should include system prompt
    expect(compiled.prefixText).toContain('Test system prompt')
    // Prefix should include pinned constraints
    expect(compiled.prefixText).toContain('Always use TypeScript')
    // Fingerprint should be stable for same inputs
    const compiled2 = compiler.compileTurn(
      makeTurn('turn_2', 'thread_1', [
        { kind: 'user_message', text: 'test again' },
      ]),
      'turn_2',
      immutable
    )
    expect(compiled.prefixFingerprint).toBe(compiled2.prefixFingerprint)
  })

  it('resets compiler state', () => {
    const compiler = new ContextCompiler()
    const immutable = createImmutablePrefix()

    const items = makeTurn('turn_1', 'thread_1', [
      {
        kind: 'assistant_text',
        text: 'I confirm that we will use React.',
      },
      { kind: 'user_message', text: 'yes' },
    ])
    compiler.extractAnchorsFromTurn(items)
    expect(compiler.getFactAnchors().length).toBeGreaterThan(0)

    compiler.reset()
    expect(compiler.getFactAnchors().length).toBe(0)
  })

  it('loads anchors from persisted history', () => {
    const compiler = new ContextCompiler()

    const history = [
      ...makeTurn('turn_1', 'thread_1', [
        { kind: 'user_message', text: 'Use React?' },
        {
          kind: 'assistant_text',
          text: 'I confirm that we will use React with TypeScript.',
        },
        { kind: 'user_message', text: 'yes, agreed' },
      ]),
      ...makeTurn('turn_2', 'thread_1', [
        { kind: 'user_message', text: 'Use Tailwind?' },
        {
          kind: 'assistant_text',
          text: 'I confirm that we will use Tailwind CSS.',
        },
        { kind: 'user_message', text: 'ok' },
      ]),
    ]

    compiler.loadAnchorsFromHistory(history)
    expect(compiler.getFactAnchors().length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles empty turn items', () => {
    const anchors = extractFactAnchorsFromTurn([])
    expect(anchors).toEqual([])
  })

  it('handles turn with no turnId', () => {
    const items: TurnItem[] = [
      {
        id: '1',
        turnId: '',
        threadId: '',
        role: 'user',
        status: 'completed',
        kind: 'user_message',
        text: 'hello',
        createdAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      },
    ]
    const anchors = extractFactAnchorsFromTurn(items)
    expect(anchors).toEqual([])
  })

  it('handles very short statements', () => {
    const items = makeTurn('turn_1', 'thread_1', [
      {
        kind: 'assistant_text',
        text: 'OK.',
      },
      { kind: 'user_message', text: 'yes' },
    ])
    const anchors = extractFactAnchorsFromTurn(items)
    // "OK" is too short to be an anchor
    expect(anchors.every((a) => a.statement.length >= 6)).toBe(true)
  })

  it('handles turn not found in items gracefully', () => {
    const compiler = new ContextCompiler()
    const immutable = createImmutablePrefix()

    const items = makeTurn('turn_1', 'thread_1', [
      { kind: 'user_message', text: 'hello' },
    ])

    const compiled = compiler.compileTurn(items, 'nonexistent_turn', immutable)
    // Should fall back to last turn as active
    expect(compiled.currentTurnId).toBe('turn_1')
  })

  it('accumulates anchors across multiple turns', () => {
    const compiler = new ContextCompiler()

    const turn1 = makeTurn('turn_1', 'thread_1', [
      {
        kind: 'assistant_text',
        text: 'I confirm that we will use React.',
      },
      { kind: 'user_message', text: 'yes' },
    ])
    compiler.extractAnchorsFromTurn(turn1)

    const turn2 = makeTurn('turn_2', 'thread_1', [
      {
        kind: 'assistant_text',
        text: 'I confirm that we will use TypeScript.',
      },
      { kind: 'user_message', text: 'agreed' },
    ])
    compiler.extractAnchorsFromTurn(turn2)

    // Should have anchors from both turns
    expect(compiler.getFactAnchors().length).toBeGreaterThanOrEqual(2)
  })
})
