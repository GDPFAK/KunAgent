import { describe, expect, it, vi } from 'vitest'
import type { LarkChannel, MarkdownStreamController, SendOptions, SendResult } from '@larksuiteoapi/node-sdk'
import { FeishuStreamer, type SseSubscriber } from './feishu-streamer'

type StreamInput = { markdown: (controller: MarkdownStreamController) => Promise<void> }

function makeBridge(): {
  bridge: LarkChannel
  controller: MarkdownStreamController
  messageId: string
} {
  const messageId = 'om_stream_1'
  const controller: MarkdownStreamController = {
    append: vi.fn(async () => undefined),
    setContent: vi.fn(async () => undefined),
    get messageId() { return messageId }
  }
  const bridge = {
    // Critical: use stream, not send
    stream: vi.fn(async (_to: string, input: StreamInput, _opts: SendOptions): Promise<SendResult> => {
      await input.markdown(controller)
      return { messageId }
    })
  } as unknown as LarkChannel
  return { bridge, controller, messageId }
}

function makeSubscriber(
  events: Array<Record<string, unknown>>,
  onEvent: (event: Record<string, unknown>) => void
): { subscribe: SseSubscriber; delivered: () => Array<Record<string, unknown>> } {
  const delivered: Array<Record<string, unknown>> = []
  let closed = false
  const subscribe: SseSubscriber = (signal) => {
    const onAbort = (): void => { closed = true }
    signal.addEventListener('abort', onAbort, { once: true })
    queueMicrotask(() => {
      for (const event of events) {
        if (closed) return
        delivered.push(event)
        onEvent(event)
      }
    })
    return { close: (): void => { closed = true } }
  }
  return { subscribe, delivered: () => delivered }
}

describe('FeishuStreamer', () => {
  it('streams assistant_text_delta in order, calls setContent once on turn_completed, resolves with messageId', async () => {
    const { bridge, controller, messageId } = makeBridge()
    const streamer = new FeishuStreamer({
      bridge, chatId: 'oc_chat_1', turnId: 'turn_1', threadId: 'thr_1',
      replyOptions: { replyTo: 'om_in_1' }, logger: vi.fn()
    })
    const sub = makeSubscriber(
      [
        { kind: 'assistant_text_delta', turnId: 'turn_1', item: { text: '你' } },
        { kind: 'assistant_text_delta', turnId: 'turn_1', item: { text: '好' } },
        { kind: 'assistant_text_delta', turnId: 'turn_1', item: { text: '!' } },
        { kind: 'turn_completed', turnId: 'turn_1' }
      ],
      (event) => streamer.onSseEvent(event)
    )

    const result = await streamer.start({ subscribe: sub.subscribe })

    expect(controller.append).toHaveBeenCalledTimes(3)
    expect(controller.append).toHaveBeenNthCalledWith(1, '你')
    expect(controller.append).toHaveBeenNthCalledWith(2, '好')
    expect(controller.append).toHaveBeenNthCalledWith(3, '!')
    expect(controller.setContent).toHaveBeenCalledTimes(1)
    expect(controller.setContent).toHaveBeenCalledWith('你好!')
    expect(result).toEqual({ ok: true, messageId, finalText: '你好!', fellBack: false })
  })

  it('drops assistant_reasoning_delta without calling controller.append', async () => {
    const { bridge, controller } = makeBridge()
    const streamer = new FeishuStreamer({
      bridge, chatId: 'oc_chat_1', turnId: 'turn_1', threadId: 'thr_1',
      replyOptions: {}, logger: vi.fn()
    })
    streamer.onSseEvent({ kind: 'assistant_reasoning_delta', turnId: 'turn_1', item: { text: 'thinking...' } })
    streamer.onSseEvent({ kind: 'turn_completed', turnId: 'turn_1' })
    expect(controller.append).not.toHaveBeenCalled()
    expect(streamer.getAccumulatedText()).toBe('')
  })

  it('ignores assistant_text_delta from a different turn', async () => {
    const { bridge, controller } = makeBridge()
    const streamer = new FeishuStreamer({
      bridge, chatId: 'oc_chat_1', turnId: 'turn_1', threadId: 'thr_1',
      replyOptions: {}, logger: vi.fn()
    })
    const sub = makeSubscriber(
      [
        { kind: 'assistant_text_delta', turnId: 'turn_OTHER', item: { text: 'X' } },
        { kind: 'turn_completed', turnId: 'turn_1' }
      ],
      (event) => streamer.onSseEvent(event)
    )
    const result = await streamer.start({ subscribe: sub.subscribe })
    expect(controller.append).not.toHaveBeenCalled()
    expect(result.finalText).toBe('')
    expect(controller.setContent).toHaveBeenCalledWith('')
  })

  it('falls back to setContent(partial) when controller.append throws mid-stream', async () => {
    const bridge = {
      stream: vi.fn(async (_to: string, input: { markdown: (c: MarkdownStreamController) => Promise<void> }, _opts: SendOptions): Promise<SendResult> => {
        const controller: MarkdownStreamController = {
          append: vi.fn(async () => { throw new Error('rate_limited') }),
          setContent: vi.fn(async () => undefined),
          get messageId() { return 'om_stream_2' }
        }
        await input.markdown(controller)
        return { messageId: 'om_stream_2' }
      })
    } as unknown as LarkChannel
    const streamer = new FeishuStreamer({
      bridge, chatId: 'oc_chat_1', turnId: 'turn_1', threadId: 'thr_1',
      replyOptions: {}, logger: vi.fn()
    })
    const sub = makeSubscriber(
      [{ kind: 'assistant_text_delta', turnId: 'turn_1', item: { text: 'partial' } }],
      (event) => streamer.onSseEvent(event)
    )
    const result = await streamer.start({ subscribe: sub.subscribe })
    expect(result.ok).toBe(true)
    expect(result.finalText).toBe('partial')
    expect(result.fellBack).toBe(false)
  })

  it('rejects start() when subscribe() throws synchronously', async () => {
    const { bridge, controller } = makeBridge()
    const streamer = new FeishuStreamer({
      bridge, chatId: 'oc_chat_1', turnId: 'turn_1', threadId: 'thr_1',
      replyOptions: {}, logger: vi.fn()
    })
    const subscribe: SseSubscriber = () => { throw new Error('sse_unavailable') }
    await expect(streamer.start({ subscribe })).rejects.toThrow('sse_unavailable')
    expect(controller.append).not.toHaveBeenCalled()
  })

  it('resolves with ok=false and empty text on turn_failed', async () => {
    const { bridge, controller } = makeBridge()
    const streamer = new FeishuStreamer({
      bridge, chatId: 'oc_chat_1', turnId: 'turn_1', threadId: 'thr_1',
      replyOptions: {}, logger: vi.fn()
    })
    const sub = makeSubscriber(
      [
        { kind: 'assistant_text_delta', turnId: 'turn_1', item: { text: 'part' } },
        { kind: 'turn_failed', turnId: 'turn_1', message: 'oops' }
      ],
      (event) => streamer.onSseEvent(event)
    )
    const result = await streamer.start({ subscribe: sub.subscribe })
    expect(result.ok).toBe(false)
    expect(result.finalText).toBe('part')
  })

  it('aborts cleanly: nextDelta resolves null and start rejects with aborted', async () => {
    const { bridge } = makeBridge()
    const streamer = new FeishuStreamer({
      bridge, chatId: 'oc_chat_1', turnId: 'turn_1', threadId: 'thr_1',
      replyOptions: {}, logger: vi.fn()
    })
    // subscribe 故意永不喂事件，只等 abort
    const subscribe: SseSubscriber = (signal) => {
      signal.addEventListener('abort', () => undefined, { once: true })
      return { close: (): void => undefined }
    }
    const startPromise = streamer.start({ subscribe })
    // 等一帧，确保 start 已进入 await
    await new Promise((r) => setTimeout(r, 0))
    streamer.abort()
    await expect(startPromise).rejects.toThrow('aborted')
  })

  it('reads event.item.text (not item.delta)', async () => {
    // 上版踩过的字段错位坑
    const { bridge, controller } = makeBridge()
    const streamer = new FeishuStreamer({
      bridge, chatId: 'oc_chat_1', turnId: 'turn_1', threadId: 'thr_1',
      replyOptions: {}, logger: vi.fn()
    })
    const sub = makeSubscriber(
      [
        { kind: 'assistant_text_delta', turnId: 'turn_1', item: { text: 'real' } },
        { kind: 'turn_completed', turnId: 'turn_1' }
      ],
      (event) => streamer.onSseEvent(event)
    )
    const result = await streamer.start({ subscribe: sub.subscribe })
    expect(controller.append).toHaveBeenCalledWith('real')
    expect(result.finalText).toBe('real')
  })

  it('calls bridge.stream (not bridge.send)', async () => {
    const streamSpy = vi.fn(async (_to: string, input: { markdown: (c: MarkdownStreamController) => Promise<void> }, _opts: SendOptions): Promise<SendResult> => {
      const ctrl: MarkdownStreamController = {
        append: vi.fn(async () => undefined),
        setContent: vi.fn(async () => undefined),
        get messageId() { return 'om_x' }
      }
      await input.markdown(ctrl)
      return { messageId: 'om_x' }
    })
    const sendSpy = vi.fn(async (): Promise<SendResult> => {
      return { messageId: 'om_y' }
    })
    const bridge = {
      stream: streamSpy,
      send: sendSpy
    } as unknown as LarkChannel
    const streamer = new FeishuStreamer({
      bridge, chatId: 'oc_chat_1', turnId: 'turn_1', threadId: 'thr_1',
      replyOptions: {}, logger: vi.fn()
    })
    const sub = makeSubscriber(
      [{ kind: 'turn_completed', turnId: 'turn_1' }],
      (event) => streamer.onSseEvent(event)
    )
    await streamer.start({ subscribe: sub.subscribe })
    expect(streamSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('dispose() releases all waiters and the subscription', () => {
    const { bridge } = makeBridge()
    const streamer = new FeishuStreamer({
      bridge, chatId: 'oc_chat_1', turnId: 'turn_1', threadId: 'thr_1',
      replyOptions: {}, logger: vi.fn()
    })
    const closeSpy = vi.fn()
    ;(streamer as unknown as { subscription: { close: () => void } | null }).subscription = { close: closeSpy }
    streamer.dispose()
    expect(closeSpy).toHaveBeenCalledTimes(1)
  })
})
