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
  token?: string
  tokenKid?: string
  client?: unknown
  theme?: unknown
  metadata?: unknown
  mainAppInfo?: unknown
  paths?: unknown
}

export interface SubHostFields {
  activeRule?: string
  entryOrigin?: string
}

export interface SubLegacyAuth {
  token: string
  tokenKid: string
  client?: unknown
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
  shell: 'legacy' | 'current'
  instanceId: string
  context: Readonly<RuntimeContext>
  patch: Readonly<Pick<RuntimeContextUpdate, 'locale' | 'initialRoute'>>
  host: Readonly<SubHostFields>
  auth?: Readonly<SubLegacyAuth>
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

function readAuth(props: Readonly<SubHostProps>, shell: ResolvedSubHost['shell']): SubLegacyAuth | undefined {
  const token = present(props.token)
  const tokenKid = present(props.tokenKid)
  if (!token && !tokenKid) return undefined
  if (!token || !tokenKid) {
    throw new PlatformError({
      code: 'runtime.sub.partial-auth',
      phase: 'mount',
      message: 'Host auth requires both token and tokenKid.',
    })
  }
  if (shell === 'current') return undefined
  const auth: SubLegacyAuth = { token, tokenKid }
  if (props.client !== undefined) auth.client = props.client
  return auth
}

function readHost(props: Readonly<SubHostProps>): SubHostFields {
  const host: SubHostFields = {}
  const activeRule = present(props.activeRule)
  const entryOrigin = present(props.entryOrigin)
  if (activeRule) host.activeRule = activeRule
  if (entryOrigin) host.entryOrigin = entryOrigin
  return host
}

export function resolveSubHostProps(
  props: Readonly<SubHostProps>,
  defaults: Readonly<SubHostDefaults>,
): ResolvedSubHost {
  const applicationCode = requireText(defaults.applicationCode, 'defaults.applicationCode is required.')
  const contextPath = requireText(defaults.contextPath, 'defaults.contextPath is required.')
  const instanceId = present(props.instanceId)
  const locale = present(props.locale)
  const initialRoute = present(props.initialRoute)

  let shell: ResolvedSubHost['shell']
  let viewId: string
  let resolvedId: string
  let resolvedCode: string

  if (instanceId) {
    shell = 'current'
    resolvedCode = requireText(props.applicationCode, 'Current shell props require applicationCode.')
    if (resolvedCode !== applicationCode) {
      throw invalidHost('props.applicationCode must equal defaults.applicationCode.')
    }
    viewId = requireText(props.viewId, 'Current shell props require viewId.')
    resolvedId = instanceId
    const appKey = requireText(props.appKey, 'Current shell props require appKey.')
    if (appKey !== resolvedId) {
      throw invalidHost('props.appKey must equal instanceId.')
    }
  } else {
    shell = 'legacy'
    resolvedId = requireText(props.appKey, 'Legacy shell props require appKey.')
    viewId = present(props.viewId) ?? resolvedId
    resolvedCode = applicationCode
  }

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

  const resolved: ResolvedSubHost = {
    shell,
    instanceId: resolvedId,
    context,
    patch,
    host: readHost(props),
  }
  const auth = readAuth(props, shell)
  if (auth) resolved.auth = auth
  return resolved
}

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
