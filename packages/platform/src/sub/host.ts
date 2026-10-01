import type { RuntimeContext, RuntimeContextUpdate } from '../contract/context.js'
import { PlatformError } from '../contract/error.js'
import type { RuntimeMessage } from '../contract/message.js'

export interface SubHostDefaults {
  applicationCode: string
  contextPath: string
}

export interface SubHostProps {
  applicationCode?: string
  viewId?: string
  instanceId?: string
  appKey?: string
  locale?: string
  initialRoute?: string
  activeRule?: string
  entryOrigin?: string
}

export interface SubHostFields {
  activeRule?: string
  entryOrigin?: string
}

export interface SubMessageIdentity {
  applicationCode: string
  viewId: string
  instanceId: string
}

export interface SubDirectedMessage<T = unknown> extends RuntimeMessage<T> {
  applicationCode: string
  viewId: string
  instanceId: string
  appKey: string
  timestamp: number
}

export interface ResolvedSubHost {
  instanceId: string
  context: Readonly<RuntimeContext>
  patch: Readonly<Pick<RuntimeContextUpdate, 'locale' | 'initialRoute'>>
  host: Readonly<SubHostFields>
}

function present(value: string | undefined): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  return value
}

function invalidHost(message: string): PlatformError {
  return new PlatformError({
    code: 'runtime.sub.invalid-host',
    phase: 'mount',
    message,
  })
}

function requireText(value: string | undefined, message: string): string {
  const text = present(value)
  if (!text) throw invalidHost(message)
  return text
}

function readHost(props: Readonly<SubHostProps>): SubHostFields {
  const host: SubHostFields = {}
  const activeRule = present(props.activeRule)
  const entryOrigin = present(props.entryOrigin)
  if (activeRule) host.activeRule = activeRule
  if (entryOrigin) host.entryOrigin = entryOrigin
  return host
}

/**
 * 把 qiankun props 解析成 RuntimeContext。
 *
 * 必须提供 applicationCode、viewId、instanceId、appKey；
 * appKey 必须等于 instanceId，applicationCode 必须等于应用默认值。
 * Token 不经 props；locale 和 initialRoute 同时写入 context 与 patch。
 */
export function resolveSubHostProps(
  props: Readonly<SubHostProps>,
  defaults: Readonly<SubHostDefaults>,
): ResolvedSubHost {
  const applicationCode = requireText(defaults.applicationCode, 'defaults.applicationCode is required.')
  const contextPath = requireText(defaults.contextPath, 'defaults.contextPath is required.')
  const resolvedId = requireText(props.instanceId, 'Host props require instanceId.')
  const resolvedCode = requireText(props.applicationCode, 'Host props require applicationCode.')
  if (resolvedCode !== applicationCode) {
    throw invalidHost('props.applicationCode must equal defaults.applicationCode.')
  }
  const viewId = requireText(props.viewId, 'Host props require viewId.')
  const appKey = requireText(props.appKey, 'Host props require appKey.')
  if (appKey !== resolvedId) {
    throw invalidHost('props.appKey must equal instanceId.')
  }

  const locale = present(props.locale)
  const initialRoute = present(props.initialRoute)

  const context: RuntimeContext = {
    applicationCode: resolvedCode,
    viewId,
    instanceId: resolvedId,
    mode: 'integrated',
    contextPath,
  }
  const patch: Pick<RuntimeContextUpdate, 'locale' | 'initialRoute'> = {}
  if (locale) {
    context.locale = locale
    patch.locale = locale
  }
  if (initialRoute) {
    context.initialRoute = initialRoute
    patch.initialRoute = initialRoute
  }

  return {
    instanceId: resolvedId,
    context,
    patch,
    host: readHost(props),
  }
}

/** 构造发往单个实例的消息。appKey 固定等于 instanceId，供仍按 appKey 过滤的宿主识别。 */
export function createSubDirectedMessage<T>(
  identity: Readonly<SubMessageIdentity>,
  type: string,
  data: T,
  timestamp = Date.now(),
): SubDirectedMessage<T> {
  const applicationCode = requireText(identity.applicationCode, 'Message identity requires applicationCode.')
  const viewId = requireText(identity.viewId, 'Message identity requires viewId.')
  const instanceId = requireText(identity.instanceId, 'Message identity requires instanceId.')
  return {
    type,
    data,
    applicationCode,
    viewId,
    instanceId,
    appKey: instanceId,
    timestamp,
  }
}
