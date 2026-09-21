export type HttpErrorSource = 'network' | 'backend' | 'auth' | 'client'

export interface G2rainHttpErrorOptions {
  source: HttpErrorSource
  code: string
  status?: number
  requestId?: string
  retryable?: boolean
  cause?: unknown
}

/**
 * HTTP 层错误。网络失败默认可重试，其余来源默认不可重试。
 * source 区分网络、后端业务包、登录态和客户端自身故障。
 */
export class G2rainHttpError extends Error {
  readonly code: string
  readonly source: HttpErrorSource
  readonly status?: number
  readonly requestId?: string
  readonly retryable: boolean

  constructor(message: string, options: G2rainHttpErrorOptions) {
    super(message, { cause: options.cause })
    this.name = 'G2rainHttpError'
    this.code = options.code
    this.source = options.source
    this.status = options.status
    this.requestId = options.requestId
    this.retryable = options.retryable ?? options.source === 'network'
  }
}
