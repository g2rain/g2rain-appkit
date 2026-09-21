import { PlatformError } from '../contract/error.js'
import type { RuntimeScope } from '../kernel/scope.js'
import type { RuntimeCapability } from '../sub/types.js'

export const MICRO_APP_EVENT_TYPES = [
  'g2rain:sub-app:request-token',
  'g2rain:main-app:token-response',
  'g2rain:sub-app:token-invalid',
  'g2rain:sub-app:route-change',
  'g2rain:main-app:theme-changed',
] as const

export type MicroAppEventType = typeof MICRO_APP_EVENT_TYPES[number]

export interface MicroAppMessage<T extends string = MicroAppEventType, D = unknown> {
  type: T
  data: D
  requestId?: string
  timestamp: number
  applicationCode?: string
  viewId?: string
  instanceId?: string
  appKey?: string
}

export interface EventAdapter<Message> {
  emit(message: Message): void
  subscribe(handler: (message: Message) => void | Promise<void>): () => void
  dispose(): void
}

export interface BrowserEventAdapterOptions<Message extends MicroAppMessage> {
  target?: EventTarget
  eventTypes?: readonly Message['type'][]
  onHandlerError?: (error: unknown, message: Message) => void
}

function present(value: string | undefined): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  return value
}

/**
 * 实例订阅的定向规则：优先比较 instanceId，否则比较 appKey。
 * 两者都没有的消息视为广播，不投递给实例订阅，避免串到其他实例。
 */
function directedTo(message: MicroAppMessage, instanceId: string): boolean {
  const directedId = present(message.instanceId)
  if (directedId) return directedId === instanceId
  const appKey = present(message.appKey)
  if (appKey) return appKey === instanceId
  return false
}

function isMessage(value: unknown): value is MicroAppMessage {
  return typeof value === 'object' && value !== null
    && 'type' in value && typeof value.type === 'string'
    && 'timestamp' in value && typeof value.timestamp === 'number'
    && 'data' in value
}

/**
 * 用 CustomEvent 收发微前端消息。单个监听器抛错交给 onHandlerError，不中断其余监听器。
 * 非浏览器环境必须传入 target。dispose 后不再派发，也不再接收。
 */
export function createBrowserEventAdapter<Message extends MicroAppMessage = MicroAppMessage>(
  options: BrowserEventAdapterOptions<Message> = {},
): EventAdapter<Message> {
  const target = options.target ?? (typeof window === 'undefined' ? undefined : window)
  if (!target) throw new Error('createBrowserEventAdapter requires an EventTarget outside a browser environment.')
  const eventTypes = options.eventTypes ?? MICRO_APP_EVENT_TYPES as readonly Message['type'][]
  const handlers = new Set<(message: Message) => void | Promise<void>>()
  let disposed = false

  const receive = (event: Event): void => {
    const detail = event instanceof CustomEvent ? event.detail : undefined
    if (disposed || !isMessage(detail) || !eventTypes.includes(detail.type as Message['type'])) return
    for (const handler of handlers) {
      Promise.resolve()
        .then(() => handler(detail as Message))
        .catch(error => options.onHandlerError?.(error, detail as Message))
    }
  }
  eventTypes.forEach(type => target.addEventListener(type, receive))

  return {
    emit(message) {
      if (!disposed) target.dispatchEvent(new CustomEvent(message.type, { detail: message }))
    },
    subscribe(handler) {
      if (disposed) return () => undefined
      handlers.add(handler)
      return () => handlers.delete(handler)
    },
    dispose() {
      if (disposed) return
      disposed = true
      eventTypes.forEach(type => target.removeEventListener(type, receive))
      handlers.clear()
    },
  }
}

export interface MessageCapability<Message extends MicroAppMessage = MicroAppMessage> extends RuntimeCapability {
  subscribeSession(handler: (message: Message) => void | Promise<void>): () => void
  subscribeInstance(instanceId: string, handler: (message: Message) => void | Promise<void>): () => void
}

/**
 * bootstrap 之后可订会话级消息；mount 之后可按 instanceId 订定向消息。
 * 退订会同时从适配器和 Scope 移除，实例或 Definition 释放时订阅自动失效。
 * 适配器在 Definition Scope dispose 时释放，不跟随单个实例卸载。
 */
export function createMessageCapability<Message extends MicroAppMessage = MicroAppMessage>(
  adapter: EventAdapter<Message>,
): MessageCapability<Message> {
  let session: RuntimeScope | undefined
  const instances = new Map<string, RuntimeScope>()

  function subscribe(
    scope: RuntimeScope | undefined,
    inactive: string,
    handler: (message: Message) => void | Promise<void>,
  ) {
    if (!scope || scope.disposed) {
      throw new PlatformError({
        code: 'runtime.message.inactive',
        phase: 'mount',
        message: inactive,
      })
    }
    const unsubscribe = adapter.subscribe(handler)
    const remove = scope.add(unsubscribe)
    return () => {
      unsubscribe()
      remove()
    }
  }

  return {
    id: 'message',
    bootstrap({ scope }) {
      session = scope
      scope.add(() => {
        session = undefined
      })
      scope.add(() => adapter.dispose())
    },
    mount(input) {
      const instanceId = input.context.instanceId
      instances.set(instanceId, input.scope)
      input.scope.add(() => {
        instances.delete(instanceId)
      })
    },
    subscribeSession(handler) {
      return subscribe(session, 'Session handlers require a bootstrapped message capability.', handler)
    },
    subscribeInstance(instanceId, handler) {
      return subscribe(
        instances.get(instanceId),
        `Instance "${instanceId}" is not mounted.`,
        message => {
          if (!directedTo(message, instanceId)) return undefined
          return handler(message)
        },
      )
    },
  }
}
