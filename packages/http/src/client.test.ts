import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
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
      source: 'backend', code: 'DEMO_FAILED', requestId: 'request-1',
    })
  })

  it('does not issue requests after disposal', async () => {
    const { client, dispose } = createHttpClient()
    dispose()
    await expect(client.get('/disposed')).rejects.toMatchObject({ code: 'HTTP_CLIENT_DISPOSED' })
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
        source: 'backend', code: 'DEMO_FAILED', requestId: 'r1',
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
  })
})
