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
})
