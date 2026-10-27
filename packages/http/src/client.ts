import axios, { CanceledError, type AxiosRequestConfig, type AxiosResponse, type GenericAbortSignal, type InternalAxiosRequestConfig } from 'axios'
import { G2rainHttpError } from './error.js'
import { defaultParamsSerializer } from './params-serializer.js'
import { prepareRequestBody, toRequestBodyBytes } from './request-body.js'
import { createDpopProof } from './dpop.js'
import type { HttpClient, HttpClientInstance, HttpClientOptions, HttpResponse, Result } from './types.js'

type RequestConfig = InternalAxiosRequestConfig & { __g2Retry?: boolean; __g2Token?: string }
function isResult(value: unknown): value is Result {
  return typeof value === 'object' && value !== null && 'status' in value && typeof value.status === 'number' && 'errorCode' in value && 'errorMessage' in value
}
function resultError(value: Result): G2rainHttpError {
  return new G2rainHttpError(value.errorMessage || 'Backend request failed', {
    source: ['gateway.40001', 'gateway.40002'].includes(value.errorCode) ? 'auth' : 'backend',
    errorCode: value.errorCode || 'BACKEND_REQUEST_FAILED',
    status: value.status,
    requestId: value.requestId,
    retryable: false,
    detail: value,
  })
}
function normalize(error: unknown): G2rainHttpError {
  if (error instanceof G2rainHttpError) return error
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    if (isResult(error.response?.data)) {
      const result = error.response.data
      if (status === 401) {
        return new G2rainHttpError(result.errorMessage || error.message, {
          source: 'auth',
          errorCode: result.errorCode || 'UNAUTHORIZED',
          status,
          requestId: result.requestId,
          cause: error,
          detail: result,
        })
      }
      return resultError(result)
    }
    return new G2rainHttpError(error.message, {
      errorCode: status === 401 ? 'UNAUTHORIZED' : error.code ?? 'HTTP_REQUEST_FAILED',
      source: status === 401 ? 'auth' : status == null ? 'network' : 'backend',
      status,
      cause: error,
    })
  }
  const message = error instanceof Error ? error.message : 'HTTP client failed'
  return new G2rainHttpError(message, { errorCode: 'HTTP_CLIENT_FAILED', source: 'client', cause: error })
}
/** 把流式响应体读出并按 JSON 解析，解析失败时保留原文。 */
async function parseStream(response: AxiosResponse): Promise<void> {
  const text = await new Response(response.data as ReadableStream).text()
  try { response.data = JSON.parse(text) } catch { response.data = text }
}
/**
 * 流式请求失败时响应体仍是流：读出并按 JSON 解析，交给 normalize 识别后端 Result 与登录态错误码。
 */
async function readStreamBody(error: unknown): Promise<void> {
  const response = axios.isAxiosError(error) ? error.response : undefined
  if (response?.data instanceof ReadableStream) await parseStream(response)
}
/**
 * 流式请求拿到的是 JSON 而不是事件流时（如 HTTP 200 里的失败 Result），读出后交给业务失败判断。
 * 事件流本身不读，留给 sse 逐段解析。
 */
async function readJsonStream(response: AxiosResponse): Promise<void> {
  if (!(response.data instanceof ReadableStream)) return
  const type = String((response.headers as Record<string, unknown> | undefined)?.['content-type'] ?? '')
  if (type.includes('json')) await parseStream(response)
}
/**
 * 按 SSE 格式以空行切分事件，合并每个事件的 data 行后按 JSON 交给回调。
 * 不是 JSON 的事件（如心跳文本、[DONE]）跳过并 console.warn，不中断整条流。
 * 返回末尾尚未收完的文本，与下一段数据拼接后继续解析。
 */
function dispatchEvents<T>(buffer: string, onEvent: (event: T) => void): string {
  let rest = buffer.replace(/\r\n/g, '\n')
  let separator: number
  while ((separator = rest.indexOf('\n\n')) >= 0) {
    const data = rest.slice(0, separator).split('\n')
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trimStart())
      .join('\n')
    rest = rest.slice(separator + 2)
    if (!data) continue
    let event: T
    try {
      event = JSON.parse(data) as T
    } catch {
      console.warn('[g2rain/http] 跳过非 JSON 的 SSE 事件:', data)
      continue
    }
    onEvent(event)
  }
  return rest
}
/** 通知失败不能替换原来的请求失败。 */
async function notify(callback: (() => void | Promise<void>) | undefined): Promise<void> {
  try { await callback?.() } catch { /* 通知失败不能替换原来的请求失败。 */ }
}

/** 等待共享的刷新；本请求被取消时立即放弃等待，刷新本身继续供其他请求使用。 */
function untilAborted<T>(promise: Promise<T>, signal?: GenericAbortSignal): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(new CanceledError())
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      cleanup()
      reject(new CanceledError())
    }
    const cleanup = () => {
      if (typeof signal.removeEventListener === 'function') signal.removeEventListener('abort', onAbort)
      else if (signal.onabort === onAbort) signal.onabort = null
    }
    if (typeof signal.addEventListener === 'function') signal.addEventListener('abort', onAbort)
    else signal.onabort = onAbort
    promise.then(
      value => { cleanup(); resolve(value) },
      error => { cleanup(); reject(error) },
    )
  })
}

/**
 * 创建带登录态和可选 DPoP 的 Axios 客户端。
 *
 * 同一时刻只有一次 token 刷新。发出时的 token 仍是当前 token 才强制刷新；token 已变说明别处刷新过，只重放。
 * 每个请求最多重试一次。
 * DPoP 的 htu 使用 config.url，不拼接 baseURL，与 Main Shell 现有验签协议一致。
 * 查询串在签名前序列化一次，并用恒等 serializer 固定下来，保证传输和 proof 使用同一份字符串。
 * dispose 后拒绝新请求并卸掉拦截器；进行中的请求在下一次检查点失败。
 */
export function createHttpClient<Direct extends boolean = false>(options: HttpClientOptions & { isDirectResponse?: Direct } = {}): HttpClientInstance<Direct> {
  const withAuth = options.withAuth ?? true
  let disposed = false
  let refresh: Promise<void> | undefined
  let refreshForced = false
  let noLoginNotified = false
  const instance = axios.create({ baseURL: options.baseURL, timeout: 10_000, paramsSerializer: { serialize: defaultParamsSerializer }, responseType: 'json' })

  function assertActive(config?: RequestConfig) {
    if (config?.signal?.aborted) throw new CanceledError()
    if (disposed) throw new G2rainHttpError('HTTP client has been disposed', { source: 'client', errorCode: 'HTTP_CLIENT_DISPOSED' })
  }
  /** 未登录只通知一次，直到后续请求重新拿到有效会话后再允许通知。 */
  async function requireLogin(): Promise<never> {
    const error = new G2rainHttpError('Authentication is required', { source: 'auth', errorCode: 'NO_LOGIN', status: 401 })
    if (!noLoginNotified && !disposed) {
      noLoginNotified = true
      await notify(() => options.authErrorHandler?.('NO_LOGIN', error))
    }
    throw error
  }
  /**
   * 合并并发刷新。成功后清掉 tokenExpired。
   * 要求强制刷新而在途的是普通刷新时不合并：等它结束后再强制刷新一次，保证拿到新 token。
   */
  function refreshToken(force: boolean): Promise<void> {
    assertActive()
    if (refresh && (refreshForced || !force)) return refresh
    const current: Promise<void> = (refresh ? refresh.then(() => runRefresh(true)) : runRefresh(force))
      .finally(() => {
        if (refresh === current) { refresh = undefined; refreshForced = false }
      })
    refresh = current
    refreshForced = force
    return current
  }
  function runRefresh(force: boolean): Promise<void> {
    return Promise.resolve().then(async () => {
      assertActive()
      if (!options.ensureAccessToken) throw new Error('ensureAccessToken is not configured')
      await options.ensureAccessToken({ force })
      assertActive()
      const session = options.authSessionProvider?.()
      if (!session?.isLogin || !session.isAccessTokenValid || !session.tokenString) throw new Error('Refresh returned no valid session')
      session.setTokenExpired(false)
    }).catch(async cause => {
      if (disposed) { assertActive(); return }
      const error = new G2rainHttpError('Access token refresh failed', { source: 'auth', errorCode: 'TOKEN_REFRESH_FAILED', status: 401, cause })
      await notify(() => options.authErrorHandler?.('TOKEN_REFRESH_FAILED', error))
      throw error
    })
  }

  const requestId = instance.interceptors.request.use(async (raw) => {
    const config = raw as RequestConfig
    assertActive(config)
    if (withAuth && options.authSessionProvider) {
      let session = options.authSessionProvider()
      if (!session.isLogin) await requireLogin()
      noLoginNotified = false
      if (refresh) await untilAborted(refresh, config.signal)
      // 服务端已判定失效（tokenExpired）时强制刷新；只是本地过期时按普通刷新
      else if (!session.isAccessTokenValid || session.tokenExpired) {
        await untilAborted(refreshToken(session.tokenExpired), config.signal)
      }
      assertActive(config)
      session = options.authSessionProvider()
      if (!session.tokenString) await requireLogin()
      config.headers.set('Authorization', `Bearer ${session.tokenString}`)
      config.__g2Token = session.tokenString ?? undefined
    }
    const locale = options.getLocale?.()
    if (locale && !config.headers.has('Accept-Language')) config.headers.set('Accept-Language', locale)
    await prepareRequestBody(config)
    assertActive(config)
    if (withAuth && options.dpop) {
      const client = options.authSessionProvider?.().client
      if (!client) throw new G2rainHttpError('DPoP client is required', { source: 'auth', errorCode: 'DPOP_CLIENT_REQUIRED' })
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
   * 其余认证失败在本请求尚未重试、且发出时的 token 仍是当前 token 时，才强制刷新并重放。
   * token 已变说明别处刷新过，这里只重放，避免把新 token 再次作废。
   */
  async function failure(error: unknown, config?: RequestConfig): Promise<AxiosResponse> {
    if (axios.isCancel(error)) throw error
    await readStreamBody(error)
    const normalized = normalize(error)
    if (withAuth && normalized.source === 'auth') {
      assertActive(config)
      if (normalized.errorCode === 'gateway.40001') {
        if (!noLoginNotified && !disposed) {
          noLoginNotified = true
          await notify(() => options.authErrorHandler?.('NO_LOGIN', normalized))
        }
        throw normalized
      }
      if (config && !config.__g2Retry && (options.maxAuthRetries ?? 1) === 1 && options.ensureAccessToken) {
        if (!options.authSessionProvider?.().isLogin) return requireLogin()
        config.__g2Retry = true
        // 发出时的 token 仍是当前 token 才强制刷新；已变说明别处刷新过，只重放。
        if (config.__g2Token === options.authSessionProvider().tokenString) {
          options.authSessionProvider().setTokenExpired(true)
          await untilAborted(refreshToken(true), config.signal)
        }
        assertActive(config)
        return instance.request(config)
      }
    }
    throw normalized
  }
  /** 后端统一包且 status 不是 0 或 200 时，按业务失败处理，而不是把 HTTP 200 当成成功。流式请求同样适用。 */
  const responseId = instance.interceptors.response.use(async response => {
    await readJsonStream(response)
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
  /**
   * SSE 流式请求：与普通请求共用拦截器（登录态、Bearer、语言、DPoP、401 刷新重放），
   * 只是改用 fetch 适配器读流，并关闭超时，由调用方的 signal 结束。默认 POST。
   */
  async function sse<T, Body>(url: string, data: Body | undefined, onEvent: (event: T) => void, config: AxiosRequestConfig<Body> = {}): Promise<void> {
    assertActive()
    try {
      const response = await instance.request<ReadableStream<BufferSource>>({
        method: 'POST', adapter: 'fetch', ...config, url, data,
        headers: { Accept: 'text/event-stream', ...config.headers },
        responseType: 'stream', timeout: 0,
      })
      const reader = response.data.pipeThrough(new TextDecoderStream()).getReader()
      let finished = false
      try {
        let buffer = ''
        for (;;) {
          assertActive()
          const { value, done } = await reader.read()
          if (done) { finished = true; break }
          // dispose 发生在等待下一段数据期间：丢弃这段，不再回调
          assertActive()
          buffer = dispatchEvents(buffer + value, onEvent)
        }
      } finally {
        // 出错、dispose 或回调抛错时取消底层流，释放连接；正常读完只需释放锁
        if (!finished) await reader.cancel().catch(() => undefined)
        reader.releaseLock()
      }
    } catch (error) {
      if (axios.isCancel(error) || config.signal?.aborted) throw new CanceledError()
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
    sse,
  }
  return { axios: instance, client, dispose() { disposed = true; instance.interceptors.request.eject(requestId); instance.interceptors.response.eject(responseId) } }
}
