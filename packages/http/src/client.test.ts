import axiosLib, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { createHttpClient } from './client.js'

function unauthorized(config: InternalAxiosRequestConfig) {
  return new AxiosError('Unauthorized', AxiosError.ERR_BAD_REQUEST, config, undefined, {
    config,
    data: null,
    headers: {},
    status: 401,
    statusText: 'Unauthorized',
  })
}

describe('createHttpClient', () => {
  it('shares one access-token refresh across concurrent 401 responses and replays once', async () => {
    let token = 'old-token'
    let refreshed = false
    const ensureAccessToken = vi.fn(async () => {
      await Promise.resolve()
      token = 'new-token'
      refreshed = true
    })
    const { axios, client } = createHttpClient({
      authSessionProvider: () => ({
        client: null,
        isLogin: true,
        isAccessTokenValid: true,
        tokenExpired: false,
        tokenString: token,
        setTokenExpired: vi.fn(),
      }),
      ensureAccessToken,
    })
    const adapter: AxiosAdapter = async (config) => {
      if (!refreshed) throw unauthorized(config)
      return { config, data: { requestId: 'r', requestTime: '', status: 200, errorCode: '', errorMessage: '', data: config.headers.Authorization }, headers: {}, status: 200, statusText: 'OK' }
    }
    axios.defaults.adapter = adapter

    const results = await Promise.all([client.get<string>('/one'), client.get<string>('/two'), client.get<string>('/three')])

    expect(ensureAccessToken).toHaveBeenCalledTimes(1)
    expect(results.map(result => result.data)).toEqual(['Bearer new-token', 'Bearer new-token', 'Bearer new-token'])
  })

  it('normalizes a failed backend Result and preserves its request id', async () => {
    const { axios, client } = createHttpClient()
    axios.defaults.adapter = async (config) => ({
      config, data: { requestId: 'request-1', requestTime: '', status: 400, errorCode: 'DEMO_FAILED', errorMessage: 'Failed', data: null }, headers: {}, status: 200, statusText: 'OK',
    })

    await expect(client.get('/failed')).rejects.toMatchObject({
      source: 'backend', errorCode: 'DEMO_FAILED', requestId: 'request-1',
    })
  })

  it('does not issue requests after disposal', async () => {
    const { client, dispose } = createHttpClient()
    dispose()
    await expect(client.get('/disposed')).rejects.toMatchObject({ errorCode: 'HTTP_CLIENT_DISPOSED' })
  })

  describe('sse', () => {
    function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
      const encoder = new TextEncoder()
      return new ReadableStream({
        start(controller) {
          chunks.forEach(chunk => controller.enqueue(encoder.encode(chunk)))
          controller.close()
        },
      })
    }
    function session(token: () => string) {
      return () => ({
        client: null, isLogin: true, isAccessTokenValid: true, tokenExpired: false,
        tokenString: token(), setTokenExpired: vi.fn(),
      })
    }

    it('dispatches events split across chunks and sends the shared auth headers', async () => {
      const { client } = createHttpClient({ authSessionProvider: session(() => 'token'), getLocale: () => 'zh-CN' })
      let headers: InternalAxiosRequestConfig['headers'] | undefined
      const adapter: AxiosAdapter = async (config) => {
        headers = config.headers
        return { config, data: streamOf('data: {"type":"PRO', 'GRESS"}\n\ndata: {"type":"RESULT"}\n\n'), headers: {}, status: 200, statusText: 'OK' }
      }
      const events: Array<{ type: string }> = []

      await client.sse<{ type: string }>('/chat', { text: 'hi' }, event => events.push(event), { adapter })

      expect(events).toEqual([{ type: 'PROGRESS' }, { type: 'RESULT' }])
      expect(headers?.Authorization).toBe('Bearer token')
      expect(headers?.Accept).toBe('text/event-stream')
      expect(headers?.['Accept-Language']).toBe('zh-CN')
    })

    it('normalizes a failed backend Result returned as a stream', async () => {
      const { client } = createHttpClient()
      const adapter: AxiosAdapter = async (config) => {
        throw new AxiosError('Bad', AxiosError.ERR_BAD_RESPONSE, config, undefined, {
          config, headers: {}, status: 500, statusText: 'Error',
          data: streamOf('{"requestId":"r1","requestTime":"","status":500,"errorCode":"DEMO_FAILED","errorMessage":"Failed","data":null}'),
        })
      }

      await expect(client.sse('/chat', {}, vi.fn(), { adapter })).rejects.toMatchObject({
        source: 'backend', errorCode: 'DEMO_FAILED', requestId: 'r1',
      })
    })

    it('refreshes the access token on 401 and replays the stream once', async () => {
      let token = 'old-token'
      const ensureAccessToken = vi.fn(async () => { token = 'new-token' })
      const { client } = createHttpClient({ authSessionProvider: session(() => token), ensureAccessToken })
      const adapter: AxiosAdapter = async (config) => {
        if (config.headers.Authorization === 'Bearer old-token') throw unauthorized(config)
        return { config, data: streamOf('data: {"ok":true}\n\n'), headers: {}, status: 200, statusText: 'OK' }
      }
      const onEvent = vi.fn()

      await client.sse('/chat', {}, onEvent, { adapter })

      expect(ensureAccessToken).toHaveBeenCalledTimes(1)
      expect(onEvent).toHaveBeenCalledWith({ ok: true })
    })

    it('refreshes and replays when HTTP 200 carries gateway.40002 as JSON', async () => {
      let token = 'old-token'
      const ensureAccessToken = vi.fn(async () => { token = 'new-token' })
      const { client } = createHttpClient({ authSessionProvider: session(() => token), ensureAccessToken })
      const adapter: AxiosAdapter = async (config) => {
        if (config.headers.Authorization === 'Bearer old-token') {
          return {
            config, headers: { 'content-type': 'application/json' }, status: 200, statusText: 'OK',
            data: streamOf('{"requestId":"r1","requestTime":"","status":401,"errorCode":"gateway.40002","errorMessage":"expired","data":null}'),
          }
        }
        return { config, data: streamOf('data: {"ok":true}\n\n'), headers: { 'content-type': 'text/event-stream' }, status: 200, statusText: 'OK' }
      }
      const onEvent = vi.fn()

      await client.sse('/chat', {}, onEvent, { adapter })

      expect(ensureAccessToken).toHaveBeenCalledTimes(1)
      expect(onEvent).toHaveBeenCalledWith({ ok: true })
    })

    it('reports NO_LOGIN when HTTP 200 carries gateway.40001 as JSON', async () => {
      const authErrorHandler = vi.fn()
      const { client } = createHttpClient({ authSessionProvider: session(() => 'token'), authErrorHandler })
      const adapter: AxiosAdapter = async (config) => ({
        config, headers: { 'content-type': 'application/json' }, status: 200, statusText: 'OK',
        data: streamOf('{"requestId":"r1","requestTime":"","status":401,"errorCode":"gateway.40001","errorMessage":"login","data":null}'),
      })

      await expect(client.sse('/chat', {}, vi.fn(), { adapter })).rejects.toMatchObject({ errorCode: 'gateway.40001' })
      expect(authErrorHandler).toHaveBeenCalledWith('NO_LOGIN', expect.anything())
    })

    it('skips non-JSON events with a warning and keeps reading', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const { client } = createHttpClient()
      const adapter: AxiosAdapter = async (config) => ({
        config, headers: {}, status: 200, statusText: 'OK',
        data: streamOf('data: ping\n\ndata: {"n":1}\n\ndata: [DONE]\n\n'),
      })
      const onEvent = vi.fn()

      await client.sse('/chat', {}, onEvent, { adapter })

      expect(onEvent.mock.calls).toEqual([[{ n: 1 }]])
      expect(warn).toHaveBeenCalledTimes(2)
      warn.mockRestore()
    })

    /** 第一段数据后保持打开，记录是否被 cancel */
    function openStream(first: string) {
      const state = { cancelled: false, push: (_chunk: string) => {} }
      const encoder = new TextEncoder()
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(first))
          state.push = chunk => controller.enqueue(encoder.encode(chunk))
        },
        cancel() { state.cancelled = true },
      })
      return { stream, state }
    }

    it('cancels the underlying stream when the callback throws', async () => {
      const { stream, state } = openStream('data: {"n":1}\n\n')
      const { client } = createHttpClient()
      const adapter: AxiosAdapter = async (config) => ({ config, data: stream, headers: {}, status: 200, statusText: 'OK' })

      await expect(client.sse('/chat', {}, () => { throw new Error('boom') }, { adapter })).rejects.toBeTruthy()
      expect(state.cancelled).toBe(true)
    })

    it('releases a silent stream after dispose without waiting for more data', async () => {
      const { stream, state } = openStream('data: {"n":1}\n\n')
      const { client, dispose } = createHttpClient()
      const adapter: AxiosAdapter = async (config) => ({ config, data: stream, headers: {}, status: 200, statusText: 'OK' })
      const onEvent = vi.fn()

      const running = client.sse('/chat', {}, onEvent, { adapter })
      await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(1))
      dispose()

      await expect(running).rejects.toMatchObject({ errorCode: 'HTTP_CLIENT_DISPOSED' })
      expect(onEvent).toHaveBeenCalledTimes(1)
      expect(state.cancelled).toBe(true)
    })

    it('disposes all active silent streams', async () => {
      const { client, dispose } = createHttpClient()
      const streams = [openStream('data: {"n":1}\n\n'), openStream('data: {"n":2}\n\n')]
      const onEvent = vi.fn()
      const running = streams.map(({ stream }) => client.sse('/chat', {}, onEvent, {
        adapter: async config => ({ config, data: stream, headers: {}, status: 200, statusText: 'OK' }),
      }).catch(error => error))
      await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(2))
      dispose()
      for (const error of await Promise.all(running)) {
        expect(error).toMatchObject({ errorCode: 'HTTP_CLIENT_DISPOSED' })
      }
      await vi.waitFor(() => expect(streams.every(({ state }) => state.cancelled)).toBe(true))
    })

    it('cancels a silent stream using the caller signal', async () => {
      const { stream, state } = openStream('data: {"n":1}\n\n')
      const { client } = createHttpClient()
      const controller = new AbortController()
      const onEvent = vi.fn()
      const running = client.sse('/chat', {}, onEvent, {
        signal: controller.signal,
        adapter: async config => ({ config, data: stream, headers: {}, status: 200, statusText: 'OK' }),
      }).catch(error => error)
      await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(1))
      controller.abort()
      expect(await running).toMatchObject({ code: 'ERR_CANCELED' })
      await vi.waitFor(() => expect(state.cancelled).toBe(true))
    })

    it('aborts transport while waiting for response headers on dispose', async () => {
      const { client, dispose } = createHttpClient()
      let transportSignal: AbortSignal | undefined
      const running = client.sse('/chat', {}, vi.fn(), {
        adapter: config => new Promise((_resolve, reject) => {
          transportSignal = config.signal as AbortSignal
          transportSignal.addEventListener('abort', () => reject(new Error('transport aborted')), { once: true })
        }),
      }).catch(error => error)
      await vi.waitFor(() => expect(transportSignal).toBeDefined())
      dispose()
      expect(await running).toMatchObject({ errorCode: 'HTTP_CLIENT_DISPOSED' })
      expect(transportSignal?.aborted).toBe(true)
    })
  })

  it('attaches the backend Result on detail when business fails', async () => {
    const result = { requestId: 'request-1', requestTime: '', status: 400, errorCode: 'DEMO_FAILED', errorMessage: 'Failed', data: null }
    const { axios, client } = createHttpClient()
    axios.defaults.adapter = async (config) => ({
      config, data: result, headers: {}, status: 200, statusText: 'OK',
    })

    await expect(client.get('/failed')).rejects.toMatchObject({ errorCode: 'DEMO_FAILED', detail: result })
  })

  it('notifies NO_LOGIN only once for concurrent gateway.40001 responses', async () => {
    const authErrorHandler = vi.fn()
    const { axios, client } = createHttpClient({
      authSessionProvider: () => ({
        client: null, isLogin: true, isAccessTokenValid: true, tokenExpired: false,
        tokenString: 'token', setTokenExpired: vi.fn(),
      }),
      authErrorHandler,
    })
    axios.defaults.adapter = async (config) => ({
      config,
      data: { requestId: 'r1', requestTime: '', status: 401, errorCode: 'gateway.40001', errorMessage: 'login', data: null },
      headers: {}, status: 200, statusText: 'OK',
    })

    const results = await Promise.allSettled([client.get('/a'), client.get('/b'), client.get('/c')])
    expect(results.every((item) => item.status === 'rejected')).toBe(true)
    expect(authErrorHandler).toHaveBeenCalledTimes(1)
    expect(authErrorHandler).toHaveBeenCalledWith('NO_LOGIN', expect.anything())
  })

  it('keeps the original Error message for client-side failures', async () => {
    const { axios, client } = createHttpClient({ withAuth: false })
    axios.interceptors.request.use(() => {
      throw new Error('sign failed: missing key')
    })
    await expect(client.get('/signed')).rejects.toMatchObject({
      errorCode: 'HTTP_CLIENT_FAILED',
      message: 'sign failed: missing key',
    })
  })

  it('abandons waiting for a shared refresh when the request is aborted', async () => {
    let token = 'old-token'
    let accessValid = false
    let finishRefresh!: () => void
    const ensureAccessToken = vi.fn(
      () => new Promise<void>(resolve => {
        finishRefresh = () => { token = 'new-token'; accessValid = true; resolve() }
      }),
    )
    const { axios, client } = createHttpClient({
      authSessionProvider: () => ({
        client: null, isLogin: true, isAccessTokenValid: accessValid, tokenExpired: false,
        tokenString: token, setTokenExpired: vi.fn(),
      }),
      ensureAccessToken,
    })
    axios.defaults.adapter = async (config) => ({
      config, data: { requestId: 'r', requestTime: '', status: 200, errorCode: '', errorMessage: '', data: config.headers.Authorization },
      headers: {}, status: 200, statusText: 'OK',
    })

    const controller = new AbortController()
    const aborted = client.get('/a', undefined, { signal: controller.signal }).catch(error => error)
    await vi.waitFor(() => expect(ensureAccessToken).toHaveBeenCalledTimes(1))
    controller.abort()
    const cancelError = await aborted
    expect(axiosLib.isCancel(cancelError)).toBe(true)

    finishRefresh()
    await expect(client.get('/b')).resolves.toMatchObject({ data: 'Bearer new-token' })
  })

  it('replays with the new token without refreshing when another client already refreshed', async () => {
    let token = 'old-token'
    const ensureAccessToken = vi.fn(async () => { token = 'should-not-run' })
    const { axios, client } = createHttpClient({
      authSessionProvider: () => ({
        client: null, isLogin: true, isAccessTokenValid: true, tokenExpired: false,
        tokenString: token, setTokenExpired: vi.fn(),
      }),
      ensureAccessToken,
    })
    let calls = 0
    axios.defaults.adapter = async (config) => {
      calls += 1
      if (calls === 1) {
        // 返回 401 前模拟别的 client 已刷新
        token = 'new-token'
        throw unauthorized(config)
      }
      return {
        config, data: { requestId: 'r', requestTime: '', status: 200, errorCode: '', errorMessage: '', data: config.headers.Authorization },
        headers: {}, status: 200, statusText: 'OK',
      }
    }

    await expect(client.get('/x')).resolves.toMatchObject({ data: 'Bearer new-token' })
    expect(ensureAccessToken).not.toHaveBeenCalled()
  })

  it('defaults string bodies to application/json and keeps explicit content types', async () => {
    const { axios, client } = createHttpClient({ withAuth: false })
    const seen: string[] = []
    axios.defaults.adapter = async (config) => {
      seen.push(String(config.headers.getContentType() ?? ''))
      return { config, data: { requestId: 'r', requestTime: '', status: 200, errorCode: '', errorMessage: '', data: null }, headers: {}, status: 200, statusText: 'OK' }
    }

    await client.post('/x', '{"a":1}')
    await client.post('/y', 'plain', { headers: { 'Content-Type': 'text/plain' } })
    await client.post('/z', new URLSearchParams({ a: '1' }))

    expect(seen[0]).toMatch(/application\/json/)
    expect(seen[1]).toMatch(/text\/plain/)
    expect(seen[2]).toMatch(/application\/x-www-form-urlencoded/)
  })
})
