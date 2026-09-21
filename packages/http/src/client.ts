import axios, { CanceledError, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { G2rainHttpError } from './error.js'
import { defaultParamsSerializer } from './params-serializer.js'
import { prepareRequestBody, toRequestBodyBytes } from './request-body.js'
import { createDpopProof } from './dpop.js'
import type { HttpClient, HttpClientInstance, HttpClientOptions, HttpResponse, Result } from './types.js'

type RequestConfig = InternalAxiosRequestConfig & { __g2Retry?: boolean; __g2Generation?: number }
function isResult(value: unknown): value is Result {
  return typeof value === 'object' && value !== null && 'status' in value && typeof value.status === 'number' && 'errorCode' in value && 'errorMessage' in value
}
function resultError(value: Result): G2rainHttpError {
  return new G2rainHttpError(value.errorMessage || 'Backend request failed', {
    source: ['gateway.40001', 'gateway.40002'].includes(value.errorCode) ? 'auth' : 'backend',
    code: value.errorCode || 'BACKEND_REQUEST_FAILED', status: value.status, requestId: value.requestId, retryable: false,
  })
}
function normalize(error: unknown): G2rainHttpError {
  if (error instanceof G2rainHttpError) return error
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    if (isResult(error.response?.data)) {
      const result = error.response.data
      if (status === 401) return new G2rainHttpError(result.errorMessage || error.message, { source: 'auth', code: result.errorCode || 'UNAUTHORIZED', status, requestId: result.requestId, cause: error })
      return resultError(result)
    }
    return new G2rainHttpError(error.message, { code: status === 401 ? 'UNAUTHORIZED' : error.code ?? 'HTTP_REQUEST_FAILED', source: status === 401 ? 'auth' : status == null ? 'network' : 'backend', status, cause: error })
  }
  return new G2rainHttpError('HTTP client failed', { code: 'HTTP_CLIENT_FAILED', source: 'client', cause: error })
}
/** 通知失败不能替换原来的请求失败。 */
async function notify(callback: (() => void | Promise<void>) | undefined): Promise<void> {
  try { await callback?.() } catch { /* 通知失败不能替换原来的请求失败。 */ }
}

/**
 * 创建带登录态和可选 DPoP 的 Axios 客户端。
 *
 * 同一时刻只有一次 token 刷新。generation 用来区分刷新前后发出的请求：
 * 旧代表返回 401 且刷新已经完成时，不再强制刷新，直接用新 token 重放；每个请求最多重试一次。
 * DPoP 的 htu 使用 config.url，不拼接 baseURL，与 Main Shell 现有验签协议一致。
 * 查询串在签名前序列化一次，并用恒等 serializer 固定下来，保证传输和 proof 使用同一份字符串。
 * dispose 后拒绝新请求并卸掉拦截器；进行中的请求在下一次检查点失败。
 */
export function createHttpClient<Direct extends boolean = false>(options: HttpClientOptions & { isDirectResponse?: Direct } = {}): HttpClientInstance<Direct> {
  const withAuth = options.withAuth ?? true
  let disposed = false
  let generation = 0
  let refresh: Promise<void> | undefined
  let noLoginNotified = false
  const instance = axios.create({ baseURL: options.baseURL, timeout: 10_000, paramsSerializer: { serialize: defaultParamsSerializer }, responseType: 'json' })

  function assertActive(config?: RequestConfig) {
    if (config?.signal?.aborted) throw new CanceledError()
    if (disposed) throw new G2rainHttpError('HTTP client has been disposed', { source: 'client', code: 'HTTP_CLIENT_DISPOSED' })
  }
  /** 未登录只通知一次，直到后续请求重新拿到有效会话后再允许通知。 */
  async function requireLogin(): Promise<never> {
    const error = new G2rainHttpError('Authentication is required', { source: 'auth', code: 'NO_LOGIN', status: 401 })
    if (!noLoginNotified && !disposed) {
      noLoginNotified = true
      await notify(() => options.authErrorHandler?.('NO_LOGIN', error))
    }
    throw error
  }
  /** 合并并发刷新。成功后 generation 加一，并清掉 tokenExpired，让更早发出的 401 知道自己已被这次刷新覆盖。 */
  function refreshToken(force: boolean): Promise<void> {
    assertActive()
    if (!refresh) {
      refresh = Promise.resolve().then(async () => {
        assertActive()
        if (!options.ensureAccessToken) throw new Error('ensureAccessToken is not configured')
        await options.ensureAccessToken({ force })
        assertActive()
        const session = options.authSessionProvider?.()
        if (!session?.isLogin || !session.isAccessTokenValid || !session.tokenString) throw new Error('Refresh returned no valid session')
        session.setTokenExpired(false)
        generation++
      }).catch(async cause => {
        if (disposed) { assertActive(); return }
        const error = new G2rainHttpError('Access token refresh failed', { source: 'auth', code: 'TOKEN_REFRESH_FAILED', status: 401, cause })
        await notify(() => options.authErrorHandler?.('TOKEN_REFRESH_FAILED', error))
        throw error
      }).finally(() => { refresh = undefined })
    }
    return refresh
  }

  const requestId = instance.interceptors.request.use(async (raw) => {
    const config = raw as RequestConfig
    assertActive(config)
    if (withAuth && options.authSessionProvider) {
      let session = options.authSessionProvider()
      if (!session.isLogin) await requireLogin()
      noLoginNotified = false
      if (refresh) await refresh
      else if (!session.isAccessTokenValid || session.tokenExpired) await refreshToken(false)
      assertActive(config)
      session = options.authSessionProvider()
      if (!session.tokenString) await requireLogin()
      config.headers.set('Authorization', `Bearer ${session.tokenString}`)
    }
    config.__g2Generation = generation
    const locale = options.getLocale?.()
    if (locale && !config.headers.has('Accept-Language')) config.headers.set('Accept-Language', locale)
    await prepareRequestBody(config)
    assertActive(config)
    if (withAuth && options.dpop) {
      const client = options.authSessionProvider?.().client
      if (!client) throw new G2rainHttpError('DPoP client is required', { source: 'auth', code: 'DPOP_CLIENT_REQUIRED' })
      // htu 只用 config.url，不拼 baseURL，以保持和 Main Shell 验签协议一致。
      const htu = config.url ?? ''
      if (!htu) throw new Error('DPoP requires a request URL')
      const serializer = config.paramsSerializer
      const serialize = typeof serializer === 'function' ? serializer : serializer?.serialize
      if (config.params != null && !serialize) throw new Error('Signed requests require paramsSerializer.serialize')
      const params = config.params == null ? '' : serialize!(config.params)
      // 把已序列化的查询串固定下来，传输和重放都复用这一份，避免和 proof 不一致。
      config.paramsSerializer = { serialize: () => params }
      config.headers.set('DPoP', await createDpopProof({
        url: htu, method: config.method ?? 'GET', params,
        data: await toRequestBodyBytes(config.data), applicationCode: options.dpop.applicationCode,
        client, jti: crypto.randomUUID(),
      }))
      assertActive(config)
    }
    return config
  })

  /**
   * 登录态失败的处理。gateway.40001 表示必须重新登录，不刷新 token。
   * 其余认证失败在本请求尚未重试、且刷新代数仍等于发出时的 generation 时，才强制刷新并重放。
   * 代数已经前进，说明别的请求完成过刷新，这里只重放，避免把新 token 再次作废。
   */
  async function failure(error: unknown, config?: RequestConfig): Promise<AxiosResponse> {
    if (axios.isCancel(error)) throw error
    const normalized = normalize(error)
    if (withAuth && normalized.source === 'auth') {
      assertActive(config)
      if (normalized.code === 'gateway.40001') {
        await notify(() => options.authErrorHandler?.('NO_LOGIN', normalized))
        throw normalized
      }
      if (config && !config.__g2Retry && (options.maxAuthRetries ?? 1) === 1 && options.ensureAccessToken) {
        if (!options.authSessionProvider?.().isLogin) return requireLogin()
        config.__g2Retry = true
        // 代数未变才强制刷新；代数已前进说明同批请求的刷新已经完成，这里只重放。
        if (config.__g2Generation === generation) {
          options.authSessionProvider().setTokenExpired(true)
          await refreshToken(true)
        }
        assertActive(config)
        return instance.request(config)
      }
    }
    throw normalized
  }
  /** 后端统一包且 status 不是 0 或 200 时，按业务失败处理，而不是把 HTTP 200 当成成功。 */
  const responseId = instance.interceptors.response.use(response => {
    if (!options.isDirectResponse && isResult(response.data) && response.data.status !== 0 && response.data.status !== 200) {
      return failure(resultError(response.data), response.config)
    }
    return response
  }, error => failure(error, axios.isAxiosError(error) ? error.config : undefined))

  async function request<T, Body>(config: AxiosRequestConfig<Body>): Promise<HttpResponse<T, Direct>> {
    assertActive()
    try {
      const response = await instance.request(config)
      return response.data as HttpResponse<T, Direct>
    } catch (error) {
      if (axios.isCancel(error)) throw error
      const normalized = normalize(error)
      if (!disposed) await notify(() => options.onError?.(normalized))
      throw normalized
    }
  }
  const client: HttpClient<Direct> = {
    request,
    get: (url, params, config) => request({ ...config, url, method: 'GET', params }),
    delete: (url, params, config) => request({ ...config, url, method: 'DELETE', params }),
    post: (url, data, config) => request({ ...config, url, method: 'POST', data }),
    put: (url, data, config) => request({ ...config, url, method: 'PUT', data }),
    patch: (url, data, config) => request({ ...config, url, method: 'PATCH', data }),
  }
  return { axios: instance, client, dispose() { disposed = true; instance.interceptors.request.eject(requestId); instance.interceptors.response.eject(responseId) } }
}
