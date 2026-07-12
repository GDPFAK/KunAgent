import { describe, expect, it } from 'vitest'
import { ToolFailureGuard } from './tool-failure-guard.js'

describe('ToolFailureGuard', () => {
  it('starts with zero failures', () => {
    const guard = new ToolFailureGuard()
    expect(guard.failureCount).toBe(0)
  })

  it('increments on failure', () => {
    const guard = new ToolFailureGuard(5)
    guard.recordFailure('read')
    expect(guard.failureCount).toBe(1)
    guard.recordFailure('grep')
    expect(guard.failureCount).toBe(2)
  })

  it('resets on success', () => {
    const guard = new ToolFailureGuard(5)
    guard.recordFailure('read')
    guard.recordFailure('grep')
    expect(guard.failureCount).toBe(2)
    guard.recordSuccess('read')
    expect(guard.failureCount).toBe(0)
  })

  it('resets on reset()', () => {
    const guard = new ToolFailureGuard()
    guard.recordFailure('read')
    guard.recordFailure('edit')
    guard.recordFailure('write')
    expect(guard.failureCount).toBe(3)
    guard.reset()
    expect(guard.failureCount).toBe(0)
  })

  it('signals stop at threshold', () => {
    const guard = new ToolFailureGuard(3)
    expect(guard.recordFailure('read').stop).toBe(false)
    expect(guard.recordFailure('edit').stop).toBe(false)
    const verdict = guard.recordFailure('grep')
    expect(verdict.stop).toBe(true)
    expect(verdict.reason).toContain('3 consecutive failures')
    expect(verdict.reason).toContain('failure loop')
  })

  it('does not stop before threshold', () => {
    const guard = new ToolFailureGuard(5)
    for (let i = 0; i < 4; i++) {
      expect(guard.recordFailure('read').stop).toBe(false)
    }
    expect(guard.failureCount).toBe(4)
  })

  it('accounts all tools toward the consecutive count', () => {
    const guard = new ToolFailureGuard(3)
    // Three different tools failing = 3 consecutive failures = stop
    guard.recordFailure('read')
    guard.recordFailure('grep')
    const verdict = guard.recordFailure('edit')
    expect(verdict.stop).toBe(true)
  })

  it('does not count exempt tools (user_input)', () => {
    const guard = new ToolFailureGuard(2)
    guard.recordFailure('user_input')
    expect(guard.failureCount).toBe(0)
    guard.recordFailure('request_user_input')
    expect(guard.failureCount).toBe(0)
  })

  it('exempt tools do not reset the counter', () => {
    const guard = new ToolFailureGuard(3)
    guard.recordFailure('read')
    expect(guard.failureCount).toBe(1)
    // exempt tool call does not reset
    guard.recordSuccess('user_input')
    expect(guard.failureCount).toBe(1)
  })

  it('works with default threshold of 3', () => {
    const guard = new ToolFailureGuard()
    expect(guard.recordFailure('a').stop).toBe(false)
    expect(guard.recordFailure('b').stop).toBe(false)
    expect(guard.recordFailure('c').stop).toBe(true)
  })

  it('supports custom threshold of 1 (immediate stop)', () => {
    const guard = new ToolFailureGuard(1)
    expect(guard.recordFailure('anything').stop).toBe(true)
  })

  it('supports custom threshold of 10 (high tolerance)', () => {
    const guard = new ToolFailureGuard(10)
    for (let i = 0; i < 9; i++) {
      guard.recordFailure('x')
    }
    expect(guard.failureCount).toBe(9)
    expect(guard.recordFailure('x').stop).toBe(true)
  })
})
