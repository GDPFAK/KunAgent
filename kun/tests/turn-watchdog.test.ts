import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TurnWatchdog } from '../src/loop/turn-watchdog.js'
import type { RuntimeEventRecorder } from '../src/services/runtime-event-recorder.js'
import type { TurnService } from '../src/services/turn-service.js'
import type { RuntimeEvent } from '../src/contracts/events.js'
import { InMemoryEventBus } from '../src/adapters/in-memory-event-bus.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: {
  kind: RuntimeEvent['kind']
  threadId?: string
  turnId?: string
}): RuntimeEvent {
  return {
    seq: 1,
    timestamp: new Date().toISOString(),
    threadId: overrides.threadId ?? 'test-thread',
    turnId: overrides.turnId ?? 'test-turn',
    ...overrides
  } as unknown as RuntimeEvent
}

function mockEventsRecorder(): RuntimeEventRecorder {
  return {
    record: vi.fn().mockResolvedValue({ seq: 1, timestamp: '' })
  } as unknown as RuntimeEventRecorder
}

function mockTurnService(): TurnService {
  return {
    interruptTurn: vi.fn().mockResolvedValue({ status: 'aborted' })
  } as unknown as TurnService
}

const bus = new InMemoryEventBus()

// ---------------------------------------------------------------------------
// Timeout tests — use fake timers for deterministic timeout control
// ---------------------------------------------------------------------------

describe('TurnWatchdog — timeout', () => {
  let watchdog: TurnWatchdog
  let events: ReturnType<typeof mockEventsRecorder>
  let turnService: ReturnType<typeof mockTurnService>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    events = mockEventsRecorder()
    turnService = mockTurnService()
    watchdog = new TurnWatchdog(bus, events, turnService, { stepTimeoutMs: 1000 })
  })

  afterEach(() => {
    watchdog.stop()
    vi.useRealTimers()
  })

  it('starts watching when watchTurn is called', () => {
    watchdog.watchTurn('test-thread', 'test-turn')

    expect(watchdog.getStatus()).toBe('watching')
    expect(watchdog.getCurrentTurnId()).toBe('test-turn')
    expect(watchdog.getCurrentStage()).toBe('turn_started')
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'pipeline_stage',
        threadId: 'test-thread',
        turnId: 'test-turn',
        label: 'Watchdog Started'
      })
    )
  })

  it('times out when step exceeds configured duration', async () => {
    watchdog.watchTurn('test-thread', 'test-turn')
    await vi.advanceTimersByTimeAsync(1100)

    expect(watchdog.getStatus()).toBe('timed_out')
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'error', code: 'WATCHDOG_STEP_TIMEOUT' })
    )
    expect(turnService.interruptTurn).toHaveBeenCalledWith({
      threadId: 'test-thread',
      turnId: 'test-turn'
    })
  })

  it('does not timeout when step finishes within window', () => {
    watchdog.watchTurn('test-thread', 'test-turn')
    vi.advanceTimersByTime(999)

    expect(watchdog.getStatus()).toBe('watching')
    expect(turnService.interruptTurn).not.toHaveBeenCalled()
  })

  it('handles interrupt failure gracefully', async () => {
    vi.mocked(turnService.interruptTurn).mockRejectedValueOnce(new Error('Interrupt failed'))

    watchdog.watchTurn('test-thread', 'test-turn')
    await vi.advanceTimersByTimeAsync(1100)

    expect(watchdog.getStatus()).toBe('timed_out')
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'error', code: 'WATCHDOG_STEP_TIMEOUT' })
    )
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'error', code: 'WATCHDOG_ABORT_FAILED' })
    )
  })

  it('respects disabled flag', () => {
    const off = new TurnWatchdog(bus, events, turnService, { enabled: false })
    off.watchTurn('test-thread', 'test-turn')

    expect(off.getStatus()).toBe('idle')
    expect(off.getCurrentTurnId()).toBeNull()
    expect(events.record).not.toHaveBeenCalled()
  })

  it('uses custom timeout when provided', () => {
    const custom = new TurnWatchdog(bus, events, turnService, { stepTimeoutMs: 5000 })
    custom.watchTurn('test-thread', 'test-turn')

    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Watchdog Started',
        details: expect.objectContaining({ stepTimeoutMs: 5000 })
      })
    )
  })

  it('only watches the latest turn', async () => {
    watchdog.watchTurn('test-thread', 'turn-1')
    watchdog.watchTurn('test-thread', 'turn-2')

    expect(watchdog.getCurrentTurnId()).toBe('turn-2')

    // turn-1 events should be ignored
    bus.publish(makeEvent({ kind: 'turn_completed', turnId: 'turn-1' }))

    expect(watchdog.getStatus()).toBe('watching')
    expect(watchdog.getCurrentTurnId()).toBe('turn-2')

    await vi.advanceTimersByTimeAsync(1100)
    expect(watchdog.getStatus()).toBe('timed_out')
    expect(turnService.interruptTurn).toHaveBeenCalledWith({
      threadId: 'test-thread',
      turnId: 'turn-2'
    })
  })
})

// ---------------------------------------------------------------------------
// Event subscription tests — use real timers for async handler settling
// ---------------------------------------------------------------------------

describe('TurnWatchdog — event subscription', () => {
  let watchdog: TurnWatchdog
  let events: ReturnType<typeof mockEventsRecorder>
  let turnService: ReturnType<typeof mockTurnService>

  beforeEach(() => {
    vi.clearAllMocks()
    events = mockEventsRecorder()
    turnService = mockTurnService()
    watchdog = new TurnWatchdog(bus, events, turnService, { stepTimeoutMs: 10000 })
  })

  afterEach(() => {
    watchdog.stop()
  })

  it('stops on turn_completed event', async () => {
    watchdog.watchTurn('test-thread', 'test-turn')
    bus.publish(makeEvent({ kind: 'turn_completed' }))
    // Let the async handler settle
    await new Promise<void>((resolve) => setTimeout(resolve, 10))

    expect(watchdog.getStatus()).toBe('idle')
    expect(watchdog.getCurrentTurnId()).toBeNull()
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Watchdog Stopped',
        details: expect.objectContaining({ endReason: 'turn_completed' })
      })
    )
  })

  it('stops on turn_failed event', async () => {
    watchdog.watchTurn('test-thread', 'test-turn')
    bus.publish(makeEvent({ kind: 'turn_failed' }))
    await new Promise<void>((resolve) => setTimeout(resolve, 10))

    expect(watchdog.getStatus()).toBe('idle')
  })

  it('stops on turn_aborted event', async () => {
    watchdog.watchTurn('test-thread', 'test-turn')
    bus.publish(makeEvent({ kind: 'turn_aborted' }))
    await new Promise<void>((resolve) => setTimeout(resolve, 10))

    expect(watchdog.getStatus()).toBe('aborted')
  })

  it('resets timeout on pipeline_stage event', async () => {
    watchdog.watchTurn('test-thread', 'test-turn')

    // Publish a pipeline_stage event — should trigger handlePipelineStage
    bus.publish(makeEvent({ kind: 'pipeline_stage' }))
    await new Promise<void>((resolve) => setTimeout(resolve, 10))

    // After the pipeline stage, a watchdog label event should have been recorded
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({
        label: expect.stringContaining('Watchdog:')
      })
    )
  })
})
