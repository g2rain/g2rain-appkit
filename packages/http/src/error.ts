export type HttpErrorSource = 'network' | 'backend' | 'auth' | 'client'

export interface G2rainHttpErrorOptions {
  source: HttpErrorSource
  code: string
  status?: number
  requestId?: string
  retryable?: boolean
  cause?: unknown
}

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
