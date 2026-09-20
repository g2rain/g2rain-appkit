import { PlatformError, type PlatformErrorSource } from '../contract/error.js'
import type { RuntimeCapability } from '../sub/types.js'

const SOURCES: readonly PlatformErrorSource[] = [
  'network',
  'backend',
  'auth',
  'client',
  'business',
  'runtime',
  'unknown',
]
const SEVERITIES = ['info', 'warning', 'error', 'fatal'] as const
const SENSITIVE = new Set([
  'token',
  'tokenKid',
  'client',
  'privateKey',
  'accessToken',
  'refreshToken',
])

export type StandardErrorAction = 'reauthenticate' | 'forbidden' | 'retry' | 'show-error-page'

export interface ErrorPresenter {
  present(error: PlatformError, message: string): void | Promise<void>
}

export interface ErrorReporter {
  report(error: PlatformError): void | Promise<void>
}

export interface ErrorResolution {
  messageKey?: string
  action?: StandardErrorAction
  present?: boolean
  report?: boolean
}

export interface ErrorPolicy {
  resolve(error: PlatformError): ErrorResolution
}

export interface ErrorActionHandler {
  handle(action: StandardErrorAction, error: PlatformError): void | Promise<void>
}

export interface ErrorCapabilityOptions {
  policy?: ErrorPolicy
  presenter?: ErrorPresenter
  reporter?: ErrorReporter
  actions?: ErrorActionHandler
  translate?: (key: string) => string | Promise<string>
  unknownMessage?: string
}

export interface ErrorCapability extends RuntimeCapability {
  handle(error: unknown): Promise<PlatformError>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function present(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  return value
}

function isSource(value: unknown): value is PlatformErrorSource {
  return typeof value === 'string' && SOURCES.includes(value as PlatformErrorSource)
}

function cleanContext(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!isRecord(value)) return undefined
  const next: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE.has(key)) continue
    next[key] = item
  }
  return Object.keys(next).length > 0 ? next : undefined
}

function hasHttpShape(record: Record<string, unknown>): boolean {
  return typeof record.code === 'string'
    && isSource(record.source)
    && ('status' in record || 'requestId' in record || 'retryable' in record || 'requestTime' in record || 'errorCode' in record)
}

function severityOf(value: unknown): PlatformError['severity'] {
  return typeof value === 'string' && SEVERITIES.includes(value as PlatformError['severity'])
    ? value as PlatformError['severity']
    : 'error'
}

function copyError(error: PlatformError): PlatformError {
  return new PlatformError({
    code: error.code,
    phase: error.phase,
    message: error.message,
    source: error.source,
    capabilityId: error.capabilityId,
    cause: error.cause,
    severity: error.severity,
    errors: error.errors,
    platformCode: error.platformCode,
    backendCode: error.backendCode,
    messageKey: error.messageKey,
    status: error.status,
    requestId: error.requestId,
    requestTime: error.requestTime,
    retryable: error.retryable,
    context: cleanContext(error.context),
  })
}

export function normalizeError(error: unknown): PlatformError {
  if (error instanceof PlatformError) return copyError(error)
  if (isRecord(error) && hasHttpShape(error)) {
    const code = error.code as string
    const source = error.source as PlatformErrorSource
    const backendCode = present(error.errorCode) ?? (source === 'backend' ? code : undefined)
    return new PlatformError({
      code,
      phase: 'mount',
      message: present(error.message) ?? (error instanceof Error ? error.message : ''),
      source,
      severity: severityOf(error.severity),
      backendCode,
      status: typeof error.status === 'number' ? error.status : undefined,
      requestId: present(error.requestId),
      requestTime: present(error.requestTime),
      retryable: typeof error.retryable === 'boolean' ? error.retryable : undefined,
      cause: error instanceof Error ? error : undefined,
      context: cleanContext(error.context),
    })
  }
  if (error instanceof Error) {
    return new PlatformError({
      code: 'unknown',
      phase: 'mount',
      message: error.message,
      source: 'unknown',
      cause: error,
    })
  }
  return new PlatformError({
    code: 'unknown',
    phase: 'mount',
    message: '',
    source: 'unknown',
  })
}

async function safe(task: () => void | Promise<void>): Promise<void> {
  try {
    await task()
  } catch {
    // Presenter, reporter, and action failures must not replace the original error.
  }
}

async function displayMessage(
  error: PlatformError,
  resolution: ErrorResolution,
  options: ErrorCapabilityOptions,
): Promise<string> {
  if (resolution.messageKey && options.translate) {
    try {
      const translated = present(await options.translate(resolution.messageKey))
      if (translated) return translated
    } catch {
      // Fall through to the fixed degradation order.
    }
  }
  return present(error.message)
    ?? present(error.backendCode)
    ?? (present(error.code) !== 'unknown' ? present(error.code) : undefined)
    ?? options.unknownMessage
    ?? 'Unknown error'
}

export function createErrorCapability(options: ErrorCapabilityOptions = {}): ErrorCapability {
  return {
    id: 'error',
    ...(options.translate ? { dependsOn: ['i18n'] } : {}),
    async handle(error) {
      const normalized = normalizeError(error)
      const resolution = options.policy?.resolve(normalized) ?? { present: true, report: true }
      const message = await displayMessage(normalized, resolution, options)
      if (resolution.present !== false && options.presenter) {
        await safe(() => options.presenter?.present(normalized, message))
      }
      if (resolution.report !== false && options.reporter) {
        await safe(() => options.reporter?.report(normalized))
      }
      if (resolution.action && options.actions) {
        const action = resolution.action
        await safe(() => options.actions?.handle(action, normalized))
      }
      return normalized
    },
  }
}
