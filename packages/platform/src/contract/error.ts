export type PlatformErrorSource =
  | 'network'
  | 'backend'
  | 'auth'
  | 'client'
  | 'business'
  | 'runtime'
  | 'unknown'

export type PlatformPhase = 'bootstrap' | 'mount' | 'update' | 'unmount' | 'dispose'

export class PlatformError extends Error {
  readonly code: string
  readonly source: PlatformErrorSource
  readonly severity: 'info' | 'warning' | 'error' | 'fatal'
  readonly phase: PlatformPhase
  readonly capabilityId?: string
  readonly errors?: readonly unknown[]
  readonly platformCode?: string
  readonly backendCode?: string
  readonly messageKey?: string
  readonly status?: number
  readonly requestId?: string
  readonly requestTime?: string
  readonly retryable?: boolean
  readonly context?: Readonly<Record<string, unknown>>

  constructor(init: {
    code: string
    phase: PlatformPhase
    message: string
    source?: PlatformErrorSource
    capabilityId?: string
    cause?: unknown
    severity?: 'info' | 'warning' | 'error' | 'fatal'
    errors?: readonly unknown[]
    platformCode?: string
    backendCode?: string
    messageKey?: string
    status?: number
    requestId?: string
    requestTime?: string
    retryable?: boolean
    context?: Readonly<Record<string, unknown>>
  }) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause })
    this.name = 'PlatformError'
    this.code = init.code
    this.source = init.source ?? 'runtime'
    this.phase = init.phase
    this.severity = init.severity ?? 'error'
    this.capabilityId = init.capabilityId
    this.errors = init.errors
    this.platformCode = init.platformCode
    this.backendCode = init.backendCode
    this.messageKey = init.messageKey
    this.status = init.status
    this.requestId = init.requestId
    this.requestTime = init.requestTime
    this.retryable = init.retryable
    this.context = init.context
  }
}
