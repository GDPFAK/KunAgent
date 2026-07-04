import type { EventBus } from '../ports/event-bus.js'
import type { RuntimeEventRecorder } from '../services/runtime-event-recorder.js'
import type { TurnService } from '../services/turn-service.js'
import type { PipelineStage, RuntimeEvent } from '../contracts/events.js'
import type { RuntimeErrorSeverity } from '../contracts/errors.js'

/**
 * 环节级看门狗配置选项
 */
export interface TurnWatchdogOptions {
  /** 每个步骤的超时时间（毫秒），默认 120000ms (120秒) */
  stepTimeoutMs?: number
  /** 是否启用看门狗，默认 true */
  enabled?: boolean
}

/**
 * 看门狗状态
 */
export type WatchdogStatus = 'idle' | 'watching' | 'timed_out' | 'aborted'

/**
 * 环节级看门狗 - 通过事件订阅接入，不侵入核心循环。
 *
 * 功能：
 * 1. 监控每个 turn 的执行时间
 * 2. 超时后自动中断当前 turn
 * 3. 状态通过 telemetry/events 暴露
 *
 * 设计思路：
 * - 外部在 turn_started 时调用 watchTurn 开始监控
 * - 订阅 pipeline_stage 事件跟踪步骤进度，每次重置超时计时器
 * - 订阅 turn_completed/turn_failed/turn_aborted 事件停止监控
 * - 超时后发出 error 事件并调用 TurnService.interruptTurn 中断执行
 */
export class TurnWatchdog {
  private readonly eventBus: EventBus
  private readonly events: RuntimeEventRecorder
  private readonly turnService: TurnService
  private readonly options: Required<TurnWatchdogOptions>

  /** 当前监控的 turn ID */
  private currentTurnId: string | null = null
  /** 当前监控的线程 ID */
  private currentThreadId: string | null = null
  /** 超时计时器 */
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null
  /** 当前阶段标签 */
  private currentStageLabel: string | null = null
  /** 阶段开始时间 */
  private stageStartTime: number = 0
  /** 看门狗状态 */
  private status: WatchdogStatus = 'idle'
  /** 事件取消订阅函数 */
  private unsubscribe: (() => void) | null = null
  /** 超时处理中标志 — 防止 handleTimeout 与 handleTurnEnded 之间的竞态 */
  private timeoutHandling = false

  constructor(
    eventBus: EventBus,
    events: RuntimeEventRecorder,
    turnService: TurnService,
    options: TurnWatchdogOptions = {}
  ) {
    this.eventBus = eventBus
    this.events = events
    this.turnService = turnService
    this.options = {
      stepTimeoutMs: options.stepTimeoutMs ?? 120000,
      enabled: options.enabled ?? true
    }
  }

  /**
   * 启动看门狗监控指定的 turn
   */
  watchTurn(threadId: string, turnId: string): void {
    if (!this.options.enabled) return

    this.stop()

    this.unsubscribe = this.eventBus.subscribe(threadId, this.handleEvent.bind(this))
    this.doWatchTurn(threadId, turnId)
  }

  /**
   * 停止看门狗，取消事件订阅和计时器
   */
  stop(): void {
    this.clearTimeout()
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
    this.status = 'idle'
    this.currentTurnId = null
    this.currentThreadId = null
    this.currentStageLabel = null
  }

  /** 获取当前看门狗状态 */
  getStatus(): WatchdogStatus {
    return this.status
  }

  /** 获取当前监控的 turn ID */
  getCurrentTurnId(): string | null {
    return this.currentTurnId
  }

  /** 获取当前阶段标签 */
  getCurrentStage(): string | null {
    return this.currentStageLabel
  }

  /**
   * 处理 runtime 事件（通过 EventBus 订阅接入）
   */
  private async handleEvent(event: RuntimeEvent): Promise<void> {
    switch (event.kind) {
      case 'turn_started':
        // 仅当未监控或新 turn 与当前不同时更新
        if (event.threadId && event.turnId) {
          this.doWatchTurn(event.threadId, event.turnId)
        }
        break

      case 'pipeline_stage':
        if (event.threadId && event.turnId) {
          await this.handlePipelineStage(event.threadId, event.turnId, event.label)
        }
        break

      case 'turn_completed':
      case 'turn_failed':
      case 'turn_aborted':
        if (event.threadId && event.turnId) {
          await this.handleTurnEnded(event.threadId, event.turnId, event.kind)
        }
        break
    }
  }

  private doWatchTurn(threadId: string, turnId: string): void {
    this.clearTimeout()
    this.currentThreadId = threadId
    this.currentTurnId = turnId
    this.currentStageLabel = 'turn_started'
    this.stageStartTime = Date.now()
    this.status = 'watching'

    // 记录看门狗启动事件
    this.events.record({
      kind: 'pipeline_stage',
      threadId,
      turnId,
      stage: 'setup',
      label: 'Watchdog Started',
      details: {
        watchdogStatus: this.status,
        stepTimeoutMs: this.options.stepTimeoutMs
      }
    }).catch(() => { /* fire-and-forget */ })

    this.startTimeout(threadId, turnId, 'turn_started')
  }

  /**
   * 处理 pipeline 阶段事件 — 重置超时计时器
   */
  private async handlePipelineStage(
    threadId: string,
    turnId: string,
    label?: string
  ): Promise<void> {
    if (this.currentTurnId !== turnId || this.currentThreadId !== threadId) return
    if (this.timeoutHandling) return

    this.clearTimeout()
    this.currentStageLabel = label ?? 'pipeline_stage'
    this.stageStartTime = Date.now()

    // 记录阶段切换事件
    await this.events.record({
      kind: 'pipeline_stage',
      threadId,
      turnId,
      stage: 'pre_send',
      label: `Watchdog: ${this.currentStageLabel}`,
      details: {
        watchdogStatus: this.status,
        stageLabel: this.currentStageLabel,
        stageStartTime: this.stageStartTime
      }
    })

    this.startTimeout(threadId, turnId, this.currentStageLabel)
  }

  /**
   * 处理 turn 结束事件 — 停止监控
   */
  private async handleTurnEnded(
    threadId: string,
    turnId: string,
    endKind: 'turn_completed' | 'turn_failed' | 'turn_aborted'
  ): Promise<void> {
    if (this.currentTurnId !== turnId || this.currentThreadId !== threadId) return
    if (this.timeoutHandling) return

    this.clearTimeout()
    this.status = endKind === 'turn_aborted' ? 'aborted' : 'idle'

    await this.events.record({
      kind: 'pipeline_stage',
      threadId,
      turnId,
      stage: 'response_received' as PipelineStage,
      label: 'Watchdog Stopped',
      details: {
        watchdogStatus: this.status,
        endReason: endKind,
        lastStage: this.currentStageLabel
      }
    })

    this.currentTurnId = null
    this.currentThreadId = null
    this.currentStageLabel = null
  }

  /**
   * 启动超时计时器
   */
  private startTimeout(threadId: string, turnId: string, stage: string): void {
    if (this.timeoutTimer) return

    this.timeoutTimer = setTimeout(async () => {
      await this.handleTimeout(threadId, turnId, stage)
    }, this.options.stepTimeoutMs)
  }

  /**
   * 处理超时 — 记录错误 + 中断 turn
   */
  private async handleTimeout(threadId: string, turnId: string, stage: string): Promise<void> {
    if (this.timeoutHandling) return
    this.timeoutHandling = true
    this.status = 'timed_out'
    const durationMs = Date.now() - this.stageStartTime

    const errorContext = {
      threadId,
      turnId,
      timedOutStage: stage,
      stageDurationMs: durationMs,
      timeoutConfigMs: this.options.stepTimeoutMs,
      watchdogStatus: this.status
    }

    // 记录超时错误事件
    await this.events.record({
      kind: 'error',
      threadId,
      turnId,
      message: `Step timed out after ${durationMs}ms: ${stage}`,
      code: 'WATCHDOG_STEP_TIMEOUT',
      severity: 'error' as RuntimeErrorSeverity,
      details: errorContext
    })

    // 记录超时阶段事件
    await this.events.record({
      kind: 'pipeline_stage',
      threadId,
      turnId,
      stage: 'response_received' as PipelineStage,
      label: 'Watchdog Timeout',
      details: errorContext
    })

    // 中断 turn 执行（回滚等效）
    try {
      await this.turnService.interruptTurn({ threadId, turnId })
    } catch (error) {
      await this.events.record({
        kind: 'error',
        threadId,
        turnId,
        message: `Failed to interrupt turn after timeout: ${(error as Error).message}`,
        code: 'WATCHDOG_ABORT_FAILED',
        severity: 'error' as RuntimeErrorSeverity,
        details: {
          ...errorContext,
          interruptError: (error as Error).message
        }
      })
    }

    this.clearTimeout()
    this.currentTurnId = null
    this.currentThreadId = null
    this.currentStageLabel = null
    this.timeoutHandling = false
  }

  /**
   * 清除超时计时器
   */
  private clearTimeout(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer)
      this.timeoutTimer = null
    }
  }
}
