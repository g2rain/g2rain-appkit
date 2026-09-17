import { describe, expect, it, vi } from 'vitest'
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { exportJWK, generateKeyPair, jwtVerify } from 'jose'
import { sha256 } from 'js-sha256'
import { createHttpClient } from './client.js'
import { toRequestBodyBytes } from './request-body.js'
import type { HttpAuthSession } from './types.js'

const session = (): HttpAuthSession => ({ client: null, isLogin: true, isAccessTokenValid: true, tokenExpired: false, tokenString: 'old', setTokenExpired: vi.fn() })
const response = (config: InternalAxiosRequestConfig, status = 200, code = '', httpStatus = 200) => ({ config, status: httpStatus, statusText: 'OK', headers: {}, data: { status, errorCode: code, errorMessage: code, requestId: 'r1', requestTime: '', data: true } })

describe('HTTP integration regressions', () => {
  it('refreshes expired sessions before transport and rejects logged-out requests', async () => {
    const auth = session(); auth.isAccessTokenValid = false
    const ensure = vi.fn(async () => { auth.isAccessTokenValid = true; auth.tokenString = 'new' })
    const h = createHttpClient({ authSessionProvider: () => auth, ensureAccessToken: ensure })
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      expect(config.headers.get('Authorization')).toBe('Bearer new')
      return response(config)
    })
    h.axios.defaults.adapter = adapter
    await Promise.all([h.client.get('/a'), h.client.get('/b')])
    expect(ensure).toHaveBeenCalledTimes(1)
    auth.isLogin = false
    await expect(h.client.get('/c')).rejects.toMatchObject({ code: 'NO_LOGIN' })
    expect(adapter).toHaveBeenCalledTimes(2)
  })
  it('reuses a completed refresh for late failures from the old token', async () => {
    const auth = session()
    const ensure = vi.fn(async () => { auth.tokenString = 'new' })
    const h = createHttpClient({ authSessionProvider: () => auth, ensureAccessToken: ensure })
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    h.axios.defaults.adapter = async config => {
      if (config.headers.get('Authorization') === 'Bearer old') {
        if (config.url === '/slow') await gate
        return response(config, 500, 'gateway.40002')
      }
      return response(config)
    }
    const fast = h.client.get('/fast'); const slow = h.client.get('/slow')
    await fast; release(); await slow
    expect(ensure).toHaveBeenCalledTimes(1)
  })
  it('does not send a request when signing fails', async () => {
    const auth = session()
    auth.client = { clientId: 'invalid', isAuthenticated: true, publicKey: {}, privateKey: {} }
    const h = createHttpClient({ baseURL: 'https://example.test', authSessionProvider: () => auth, dpop: { applicationCode: 'test' } })
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => response(config))
    h.axios.defaults.adapter = adapter
    await expect(h.client.get('/a')).rejects.toMatchObject({ source: 'client' })
    expect(adapter).not.toHaveBeenCalled()
  })
  it('refreshes concurrent gateway failures once and preserves status=0 success', async () => {
    const auth = session()
    const ensure = vi.fn(async () => { auth.tokenString = 'new' })
    const h = createHttpClient({ authSessionProvider: () => auth, ensureAccessToken: ensure })
    let calls = 0
    h.axios.defaults.adapter = async config => { calls++; return config.headers.get('Authorization') === 'Bearer old' ? response(config, 500, 'gateway.40002') : response(config, 0) }
    const results = await Promise.all([h.client.get('/a'), h.client.get('/b'), h.client.get('/c')])
    expect(results.every(r => r.status === 0)).toBe(true)
    expect(ensure).toHaveBeenCalledTimes(1)
    expect(calls).toBe(6)
  })
  it('limits replay and does not refresh an invalid-login gateway result', async () => {
    const auth = session()
    const ensure = vi.fn(async () => {})
    const handler = vi.fn(async () => { throw Error('notification') })
    const h = createHttpClient({ authSessionProvider: () => auth, ensureAccessToken: ensure, authErrorHandler: handler })
    let count = 0
    h.axios.defaults.adapter = async config => { count++; return response(config, 500, 'gateway.40002') }
    await expect(h.client.get('/a')).rejects.toMatchObject({ source: 'auth', code: 'gateway.40002' })
    expect(count).toBe(2)
    h.axios.defaults.adapter = async config => response(config, 500, 'gateway.40001')
    await expect(h.client.get('/a')).rejects.toMatchObject({ code: 'gateway.40001' })
    expect(ensure).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledTimes(1)
  })
  it('notifies refresh failure once per cohort with the same error object', async () => {
    const auth = session()
    let reject!: (e: unknown) => void
    const ensure = vi.fn(() => new Promise<void>((_, fail) => { reject = fail }))
    const handler = vi.fn(() => { throw Error('notification') })
    const h = createHttpClient({ authSessionProvider: () => auth, ensureAccessToken: ensure, authErrorHandler: handler })
    h.axios.defaults.adapter = async config => response(config, 500, 'gateway.40002')
    const results = Promise.allSettled([h.client.get('/a'), h.client.get('/b'), h.client.get('/c')])
    await vi.waitFor(() => expect(ensure).toHaveBeenCalledTimes(1))
    reject(Error('refresh failed'))
    const settled = await results
    const errors = settled.map(r => r.status === 'rejected' ? r.reason : undefined)
    expect(errors[0]).toBe(errors[1])
    expect(errors[1]).toBe(errors[2])
    expect(errors[0].code).toBe('TOKEN_REFRESH_FAILED')
    expect(handler).toHaveBeenCalledTimes(1)
  })
  it('preserves original errors when onError rejects', async () => {
    const h = createHttpClient({ withAuth: false, onError: async () => { throw Error('notification failed') } })
    h.axios.defaults.adapter = async config => response(config, 500, 'DOMAIN_ERROR')
    await expect(h.client.get('/a')).rejects.toMatchObject({ code: 'DOMAIN_ERROR', requestId: 'r1' })
  })
  it.each(['cancel', 'dispose'])('does not replay after %s during refresh', async action => {
    const auth = session()
    let finish!: () => void
    const ensure = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
    const h = createHttpClient({ authSessionProvider: () => auth, ensureAccessToken: ensure })
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => response(config, 500, 'gateway.40002'))
    h.axios.defaults.adapter = adapter
    const controller = new AbortController()
    const result = h.client.get('/a', undefined, { signal: controller.signal }).catch(e => e)
    await vi.waitFor(() => expect(ensure).toHaveBeenCalledTimes(1))
    if (action === 'cancel') controller.abort(); else h.dispose()
    finish()
    expect((await result).code).toBe(action === 'cancel' ? 'ERR_CANCELED' : 'HTTP_CLIENT_DISPOSED')
    expect(adapter).toHaveBeenCalledTimes(1)
  })
  it('does not refresh or sign withAuth=false and preserves cancellation', async () => {
    const ensure = vi.fn()
    const h = createHttpClient({ withAuth: false, ensureAccessToken: ensure, dpop: { applicationCode: 'test' } })
    h.axios.defaults.adapter = async config => { throw new AxiosError('401', '401', config, undefined, response(config, 200, '', 401)) }
    await expect(h.client.get('/a')).rejects.toMatchObject({ source: 'auth' })
    expect(ensure).not.toHaveBeenCalled()
    const signal = AbortSignal.abort()
    await expect(h.client.get('/a', undefined, { signal })).rejects.toMatchObject({ code: 'ERR_CANCELED' })
  })
  it.each(['json', 'form', 'multipart'])('signs and replays exactly the transmitted %s bytes', async kind => {
    const keys = await generateKeyPair('ES256', { extractable: true })
    const auth = session()
    auth.client = { clientId: 'c', isAuthenticated: true, publicKey: await exportJWK(keys.publicKey), privateKey: await exportJWK(keys.privateKey) }
    const h = createHttpClient({ baseURL: '/api', dpop: { applicationCode: 'member' }, authSessionProvider: () => auth, ensureAccessToken: async () => { auth.tokenString = 'new' } })
    const proofs: string[] = []
    const bodies: string[] = []
    h.axios.defaults.adapter = async config => {
      const proof = String(config.headers.get('DPoP'))
      const { payload } = await jwtVerify(proof, keys.publicKey)
      const url = new URL(h.axios.getUri(config), 'https://example.test')
      const bytes = await toRequestBodyBytes(config.data)
      expect(payload.pha).toBe(sha256(`${url.search.slice(1)}\n${sha256(bytes)}`))
      expect(payload.htu).toBe('/items')
      expect(config.baseURL).toBe('/api')
      expect(payload.htm).toBe('POST')
      expect(url.search).toBe('?a=1&z=2')
      if (kind === 'multipart') {
        const parsed = await new Response(new Uint8Array(bytes).buffer, { headers: { 'Content-Type': String(config.headers.getContentType()) } }).formData()
        expect(parsed.get('name')).toBe('Alice')
        expect(await (parsed.get('file') as Blob).text()).toBe('file-data')
      }
      bodies.push(sha256(bytes)); proofs.push(proof)
      return proofs.length === 1 ? response(config, 500, 'gateway.40002') : response(config)
    }
    const form = new FormData(); form.append('name', 'Alice'); form.append('file', new Blob(['file-data']), 'test.txt')
    const data = kind === 'multipart' ? form : { name: 'Alice' }
    await h.client.post('/items', data, { params: { z: 2, a: 1 }, headers: { 'Content-Type': kind === 'form' ? 'application/x-www-form-urlencoded' : 'application/json' } })
    expect(proofs).toHaveLength(2)
    expect(proofs[0]).not.toBe(proofs[1])
    expect(bodies[0]).toBe(bodies[1])
  })
  it('refuses to hash an unencoded FormData', async () => {
    await expect(toRequestBodyBytes(new FormData())).rejects.toThrow('Encode multipart')
  })
})
