import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import type { JWK } from 'jose'

export interface Result<T = unknown> {
  requestId: string
  requestTime: string
  status: number
  errorCode: string
  errorMessage: string
  data: T
}

export type HttpClientType = 'default' | 'auth' | 'docs'

export interface EnsureAccessTokenOptions {
  force?: boolean
}

export interface HttpAuthSession {
  client: DpopClient | null
  isLogin: boolean
  isAccessTokenValid: boolean
  tokenExpired: boolean
  tokenString: string | null
  setTokenExpired(expired: boolean): void
}

export interface DpopClient {
  clientId: string
  publicKey: JWK
  privateKey: JWK
  isAuthenticated: boolean
}

export interface DpopSignInput {
  url: string
  method: string
  params?: unknown
  data?: unknown
  applicationCode: string
  client: DpopClient
  jti: string
}

export interface HttpClientOptions {
  /** Main-shell protocol: htu is config.url, without prepending baseURL. */
  dpop?: { applicationCode: string }
  baseURL?: string
  withAuth?: boolean
  isDirectResponse?: boolean
  authSessionProvider?: () => HttpAuthSession
  ensureAccessToken?: (options?: EnsureAccessTokenOptions) => Promise<void>
  authErrorHandler?: (
    reason: 'NO_LOGIN' | 'TOKEN_REFRESH_FAILED',
    error: unknown,
  ) => void | Promise<void>
  getLocale?: () => string | undefined
  maxAuthRetries?: 0 | 1
  onError?: (error: import('./error.js').G2rainHttpError) => void | Promise<void>
}

export type HttpResponse<T, Direct extends boolean> = Direct extends true ? T : Result<T>

export interface HttpClient<Direct extends boolean = false> {
  request<T = unknown, Body = unknown>(config: AxiosRequestConfig<Body>): Promise<HttpResponse<T, Direct>>
  get<T = unknown>(url: string, params?: Record<string, unknown>, config?: AxiosRequestConfig): Promise<HttpResponse<T, Direct>>
  post<T = unknown, Body = unknown>(url: string, data?: Body, config?: AxiosRequestConfig<Body>): Promise<HttpResponse<T, Direct>>
  put<T = unknown, Body = unknown>(url: string, data?: Body, config?: AxiosRequestConfig<Body>): Promise<HttpResponse<T, Direct>>
  patch<T = unknown, Body = unknown>(url: string, data?: Body, config?: AxiosRequestConfig<Body>): Promise<HttpResponse<T, Direct>>
  delete<T = unknown>(url: string, params?: Record<string, unknown>, config?: AxiosRequestConfig): Promise<HttpResponse<T, Direct>>
}

export interface HttpClientInstance<Direct extends boolean = false> {
  axios: AxiosInstance
  client: HttpClient<Direct>
  dispose(): void
}
