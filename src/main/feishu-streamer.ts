import type { LarkChannel, MarkdownStreamController, SendOptions } from '@larksuiteoapi/node-sdk'
import type { SseSubscriber } from './claw-runtime-helpers'

export type { SseSubscriber } from './claw-runtime-helpers'

export type FeishuStreamLogger = (category: string, message: string, detail?: unknown) => void

export type FeishuStreamerOptions = {
  bridge: LarkChannel
  chatId: string
  turnId: string
  threadId: string
  replyOptions: SendOptions
  logger: FeishuStreamLogger
}

export type FeishuStreamerResult = {
  ok: boolean
  messageId: string
  finalText: string
  fellBack: boolean
}

export class FeishuStreamer {
  private readonly opts: FeishuStreamerOptions
  private readonly outbox: Array<string | null> = []
  private readonly waiters: Array<(chunk: string | null) => void> = []
  private state: 'pending' | 'streaming' | 'closed' = 'pending'
  private accumulatedText = ''
  private subscription: { close: () => void } | null = null
  private startAbortController: AbortController | null = null
  private failed = false
  private ended = false

  constructor(opts: FeishuStreamerOptions) {
    this.opts = opts
  }

  start(input: { subscribe: SseSubscriber }): Promise<FeishuStreamerResult> {
    return new Promise<FeishuStreamerResult>((resolve, reject) => {
      const controller = new AbortController()
      this.startAbortController = controller
      this.failed = false
      this.ended = false
      let resolved = false
      const onComplete = (result: FeishuStreamerResult): void => {
        if (resolved) return
        resolved = true
        resolve(result)
      }
      const onError = (error: Error): void => {
        if (resolved) return
        resolved = true
        reject(error)
      }

      const producer = async (streamController: MarkdownStreamController): Promise<void> => {
        this.state = 'streaming'
        try {
          while (this.state === 'streaming') {
            const chunk = await this.nextDelta()
            if (chunk === null) break
            this.accumulatedText += chunk
            try {
              await streamController.append(chunk)
            } catch (error) {
              this.opts.logger('claw-feishu-stream', 'append failed; saving accumulated text and finalizing', {
                message: error instanceof Error ? error.message : String(error)
              })
              try {
                await streamController.setContent(this.accumulatedText)
              } catch (finalError) {
                this.opts.logger('claw-feishu-stream', 'setContent on append-failure also failed', {
                  message: finalError instanceof Error ? finalError.message : String(finalError)
                })
              }
              onComplete({
                ok: !this.failed,
                messageId: streamController.messageId,
                finalText: this.accumulatedText,
                fellBack: false
              })
              return
            }
          }
          try {
            await streamController.setContent(this.accumulatedText)
          } catch (error) {
            this.opts.logger('claw-feishu-stream', 'final setContent failed; returning accumulated text as-is', {
              message: error instanceof Error ? error.message : String(error)
            })
          }
          onComplete({
            ok: !this.failed,
            messageId: streamController.messageId,
            finalText: this.accumulatedText,
            fellBack: false
          })
        } catch (error) {
          onError(error instanceof Error ? error : new Error(String(error)))
        }
      }

      const subscription = input.subscribe(controller.signal)
      if (this.ended || controller.signal.aborted) subscription.close()
      else this.subscription = subscription
      const onAbort = (): void => {
        this.state = 'closed'
        this.subscription?.close()
        this.subscription = null
        while (this.waiters.length > 0) {
          const w = this.waiters.shift()!
          w(null)
        }
        if (!resolved) onError(new Error('aborted'))
      }
      controller.signal.addEventListener('abort', onAbort, { once: true })

      // 关键：bridge.stream,不是 bridge.send
      const bridgeAny = this.opts.bridge as unknown as {
        stream: (
          to: string,
          input: { markdown: (c: MarkdownStreamController) => Promise<void> },
          opts?: SendOptions
        ) => Promise<{ messageId: string }>
      }
      const sendPromise: Promise<{ messageId: string }> = bridgeAny.stream(
        this.opts.chatId,
        { markdown: producer },
        this.opts.replyOptions
      )
      void sendPromise.catch((error: unknown) => {
        this.state = 'closed'
        controller.abort()
        onError(error instanceof Error ? error : new Error(String(error)))
      })
    })
  }

  onSseEvent(event: Record<string, unknown>): void {
    if (this.state === 'closed' || this.ended) return
    const kind = event.kind
    // 关键：读 event.item.text,不是 event.item.delta
    if (kind === 'assistant_text_delta' && event.turnId === this.opts.turnId) {
      const item = (event as { item?: { text?: unknown } }).item
      const delta = typeof item?.text === 'string' ? item.text : ''
      if (delta) this.push(delta)
      return
    }
    if (kind === 'assistant_reasoning_delta') {
      this.opts.logger('claw-feishu-stream-debug', 'drop reasoning delta', { turnId: this.opts.turnId })
      return
    }
    if (
      (kind === 'turn_completed' || kind === 'turn_failed' || kind === 'turn_aborted') &&
      event.turnId === this.opts.turnId
    ) {
      if (kind === 'turn_failed') this.failed = true
      this.ended = true
      this.subscription?.close()
      this.subscription = null
      this.push(null)
    }
  }

  private push(chunk: string | null): void {
    if (this.waiters.length > 0) {
      const waiter = this.waiters.shift()!
      waiter(chunk)
      return
    }
    this.outbox.push(chunk)
  }

  private nextDelta(): Promise<string | null> {
    if (this.outbox.length > 0) {
      return Promise.resolve(this.outbox.shift() ?? null)
    }
    return new Promise<string | null>((resolve) => {
      this.waiters.push(resolve)
    })
  }

  getAccumulatedText(): string {
    return this.accumulatedText
  }

  abort(): void {
    this.state = 'closed'
    this.subscription?.close()
    this.subscription = null
    this.startAbortController?.abort()
  }

  dispose(): void {
    this.abort()
    while (this.waiters.length > 0) {
      const w = this.waiters.shift()!
      w(null)
    }
  }
}
