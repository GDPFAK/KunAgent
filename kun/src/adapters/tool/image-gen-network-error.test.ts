import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  describeNetworkError,
  MiniMaxImageClient,
  OpenAiCompatImageClient,
  controllableTimeout,
  isMiniMaxRetryable,
  retryOnce,
  ImageGenHttpError
} from './image-gen-tool-provider.js'

describe('describeNetworkError', () => {
  it('unwraps the cause behind undici fetch failed errors', () => {
    const dns = Object.assign(new Error('getaddrinfo ENOTFOUND images.example.test'), {
      code: 'ENOTFOUND'
    })
    const wrapped = new TypeError('fetch failed', { cause: dns })
    expect(describeNetworkError(wrapped)).toBe(
      'fetch failed: getaddrinfo ENOTFOUND images.example.test'
    )
  })

  it('digs into AggregateError connection failures', () => {
    const refused = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:8080'), {
      code: 'ECONNREFUSED'
    })
    const wrapped = new TypeError('fetch failed', { cause: new AggregateError([refused], '') })
    expect(describeNetworkError(wrapped)).toBe('fetch failed: connect ECONNREFUSED 127.0.0.1:8080')
  })

  it('appends error codes missing from the message', () => {
    const tls = Object.assign(new Error('self-signed certificate'), {
      code: 'DEPTH_ZERO_SELF_SIGNED_CERT'
    })
    expect(describeNetworkError(new TypeError('fetch failed', { cause: tls }))).toBe(
      'fetch failed: self-signed certificate (DEPTH_ZERO_SELF_SIGNED_CERT)'
    )
  })

  it('handles non-error values and empty chains', () => {
    expect(describeNetworkError('boom')).toBe('boom')
    expect(describeNetworkError(new Error(''))).toBe('unknown network error')
  })
})

describe('OpenAiCompatImageClient network failures', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('surfaces the failing endpoint and root cause instead of bare fetch failed', async () => {
    const dns = Object.assign(new Error('getaddrinfo ENOTFOUND images.example.test'), {
      code: 'ENOTFOUND'
    })
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed', { cause: dns })
    }))

    const client = new OpenAiCompatImageClient('https://images.example.test/v1', 'sk-test')
    await expect(
      client.generate({
        prompt: 'a cat',
        model: 'test-model',
        timeoutMs: 5_000,
        signal: new AbortController().signal
      })
    ).rejects.toThrow(
      'image request to https://images.example.test/v1/images/generations failed: ' +
        'fetch failed: getaddrinfo ENOTFOUND images.example.test'
    )
  })

  it('reports socket/body timeouts separately from config timeout', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    }))

    const client = new OpenAiCompatImageClient('https://images.example.test/v1', 'sk-test')
    await expect(
      client.generate({
        prompt: 'a cat',
        model: 'test-model',
        timeoutMs: 5_000,
        signal: new AbortController().signal
      })
    ).rejects.toThrow('image request to https://images.example.test/v1/images/generations failed: socket/body timeout')
  })

  it('reports config timeout from controllableTimeout', async () => {
    // Mock fetch that listens to the abort signal so it rejects when the timeout fires
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: { signal?: AbortSignal }) => {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 50)
        options?.signal?.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(options!.signal!.reason)
        }, { once: true })
      })
      return new Response(JSON.stringify({ data: [{ b64_json: 'AAAA' }] }))
    }))

    const client = new OpenAiCompatImageClient('https://images.example.test/v1', 'sk-test')
    await expect(
      client.generate({
        prompt: 'a cat',
        model: 'test-model',
        timeoutMs: 1,
        signal: new AbortController().signal
      })
    ).rejects.toThrow(/timed out after 1ms/)
  })
})

describe('controllableTimeout', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('aborts with imageProviderTimeout when timeout fires', async () => {
    vi.useFakeTimers()
    const outerSignal = new AbortController().signal
    const { signal, cancelTimeout } = controllableTimeout(outerSignal, 10_000)

    // Fire the timeout
    vi.advanceTimersByTime(10_000)

    expect(signal.aborted).toBe(true)
    const reason = signal.reason as Error
    expect((reason as unknown as Record<string, unknown>).imageProviderTimeout).toBe(true)
    expect(reason?.message).toBe('ImageProviderTimeout')

    cancelTimeout()
  })

  it('aborts when outer signal aborts', () => {
    const controller = new AbortController()
    const { signal, cancelTimeout } = controllableTimeout(controller.signal, 10_000)

    controller.abort(new Error('user canceled'))

    expect(signal.aborted).toBe(true)
    expect((signal.reason as Error)?.message).toBe('user canceled')
    cancelTimeout()
  })

  it('cleans up timer on cancelTimeout', () => {
    vi.useFakeTimers()
    const outerSignal = new AbortController().signal
    const { signal, cancelTimeout } = controllableTimeout(outerSignal, 10_000)

    cancelTimeout()

    // Advance time past the timeout - signal should NOT abort
    vi.advanceTimersByTime(10_000)
    expect(signal.aborted).toBe(false)

    vi.useRealTimers()
  })
})

describe('isMiniMaxRetryable', () => {
  it('returns true for ImageGenHttpError 503', () => {
    expect(isMiniMaxRetryable(new ImageGenHttpError(503, 'Service Unavailable'))).toBe(true)
  })

  it('returns true for ImageGenHttpError 502', () => {
    expect(isMiniMaxRetryable(new ImageGenHttpError(502, 'Bad Gateway'))).toBe(true)
  })

  it('returns true for ImageGenHttpError 504', () => {
    expect(isMiniMaxRetryable(new ImageGenHttpError(504, 'Gateway Timeout'))).toBe(true)
  })

  it('returns false for ImageGenHttpError 400', () => {
    expect(isMiniMaxRetryable(new ImageGenHttpError(400, 'Bad Request'))).toBe(false)
  })

  it('returns true for ECONNRESET', () => {
    const err = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' })
    expect(isMiniMaxRetryable(err)).toBe(true)
  })

  it('returns false for ENOTFOUND', () => {
    const err = Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })
    expect(isMiniMaxRetryable(err)).toBe(false)
  })
})

describe('retryOnce', () => {
  it('retries once when isRetryable returns true, then succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new ImageGenHttpError(503, 'Service Unavailable'))
      .mockResolvedValueOnce('success')

    const result = await retryOnce(fn, isMiniMaxRetryable, 1)

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does not retry when isRetryable returns false', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new ImageGenHttpError(400, 'Bad Request'))

    await expect(retryOnce(fn, isMiniMaxRetryable, 1)).rejects.toThrow('Bad Request')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('re-throws error when second attempt also fails', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new ImageGenHttpError(503, 'Service Unavailable'))
      .mockRejectedValueOnce(new ImageGenHttpError(503, 'Service Unavailable again'))

    await expect(retryOnce(fn, isMiniMaxRetryable, 1)).rejects.toThrow('Service Unavailable again')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('MiniMaxImageClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('retries once on 503 then succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('Service Unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        base_resp: { status_code: 0 },
        data: { image_base64: ['AAAA'] }
      }), { status: 200 }))

    vi.stubGlobal('fetch', fetchMock)

    const client = new MiniMaxImageClient('https://api.minimax.test', 'sk-test')
    const result = await client.generate({
      prompt: 'a cat',
      model: 'image-01',
      timeoutMs: 10_000,
      signal: new AbortController().signal
    })

    expect(result).toBeDefined()
    expect(result.data).toBeDefined()
    // First attempt: 503; wait 2s; second attempt: 200
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry on 400', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValue(new Response('Bad Request', { status: 400 }))

    vi.stubGlobal('fetch', fetchMock)

    const client = new MiniMaxImageClient('https://api.minimax.test', 'sk-test')
    await expect(
      client.generate({
        prompt: 'a cat',
        model: 'image-01',
        timeoutMs: 10_000,
        signal: new AbortController().signal
      })
    ).rejects.toThrow(/HTTP 400/)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
