import { PlatformError } from '../contract/error.js'
import type { RuntimeContext, RuntimeContextUpdate } from '../contract/context.js'
import type { RuntimeMessage } from '../contract/message.js'

const AUTH_INVALID_TYPE = 'g2rain:sub-app:token-invalid'

export interface MainHostFields {
  activeRule?: string
  entryOrigin?: string
}

export interface MainPublicProps {
  applicationCode: string
  viewId: string
  instanceId: string
  locale?: string
  initialRoute?: string
  activeRule?: string
  entryOrigin?: string
  /** 迁移期定向键，固定等于 instanceId */
  appKey: string
}

export interface MainDirectedMessage<T = unknown> extends RuntimeMessage<T> {
  applicationCode: string
  viewId: string
  instanceId: string
  appKey: string
  timestamp: number
}

export interface MainPlatformRuntimePort {
  updateInstanceProps(instanceId: string, props: Readonly<MainPublicProps>): Promise<void>
  emit<T>(message: MainDirectedMessage<T>): void | Promise<void>
}

export interface MainPlatformCoordinator {
  buildPublicProps(
    context: Readonly<RuntimeContext>,
    host?: Readonly<MainHostFields>,
  ): Readonly<MainPublicProps>
  updatePublicContext(instanceId: string, patch: Readonly<RuntimeContextUpdate>): Promise<void>
  notifyLocale(instanceId: string, locale: string): Promise<void>
  notifyAuthInvalid(instanceId: string, data?: Readonly<Record<string, unknown>>): Promise<void>
  emitToInstance<T>(instanceId: string, type: string, data: T): Promise<void>
  releaseInstance(instanceId: string): void
}

export interface CreateMainPlatformOptions {
  runtimePort: MainPlatformRuntimePort
}

function requireIdentity(value: string | undefined, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new PlatformError({
      code: 'runtime.main.invalid-context',
      phase: 'mount',
      message: `Public props require a non-empty ${field}.`,
    })
  }
  return value
}

function copyProps(props: MainPublicProps): MainPublicProps {
  const copy: MainPublicProps = {
    applicationCode: props.applicationCode,
    viewId: props.viewId,
    instanceId: props.instanceId,
    appKey: props.appKey,
  }
  if (props.locale !== undefined) copy.locale = props.locale
  if (props.initialRoute !== undefined) copy.initialRoute = props.initialRoute
  if (props.activeRule !== undefined) copy.activeRule = props.activeRule
  if (props.entryOrigin !== undefined) copy.entryOrigin = props.entryOrigin
  return copy
}

/** 字段出现才覆盖。值为 undefined 表示从已下发 props 中删除该字段，而不是保留旧值。 */
function applyPublicPatch(current: MainPublicProps, patch: Readonly<RuntimeContextUpdate>): MainPublicProps {
  const next = copyProps(current)
  if ('locale' in patch) {
    if (patch.locale === undefined) delete next.locale
    else next.locale = patch.locale
  }
  if ('initialRoute' in patch) {
    if (patch.initialRoute === undefined) delete next.initialRoute
    else next.initialRoute = patch.initialRoute
  }
  return next
}

/**
 * Main Shell 侧的公开 props 协调器。不持有 qiankun 句柄，只缓存已经下发的 props。
 * appKey 固定写成 instanceId。updatePublicContext 只有在 runtimePort 成功后才提交快照。
 */
export function createMainPlatform(options: CreateMainPlatformOptions): MainPlatformCoordinator {
  const snapshots = new Map<string, MainPublicProps>()

  function snapshotOf(instanceId: string): MainPublicProps {
    const current = snapshots.get(instanceId)
    if (!current) {
      throw new PlatformError({
        code: 'runtime.main.missing-snapshot',
        phase: 'update',
        message: `Instance "${instanceId}" has no public props snapshot. Call buildPublicProps first.`,
      })
    }
    return current
  }

  function buildPublicProps(
    context: Readonly<RuntimeContext>,
    host?: Readonly<MainHostFields>,
  ): Readonly<MainPublicProps> {
    const applicationCode = requireIdentity(context.applicationCode, 'applicationCode')
    const viewId = requireIdentity(context.viewId, 'viewId')
    const instanceId = requireIdentity(context.instanceId, 'instanceId')
    const props: MainPublicProps = {
      applicationCode,
      viewId,
      instanceId,
      appKey: instanceId,
    }
    if (context.locale !== undefined) props.locale = context.locale
    if (context.initialRoute !== undefined) props.initialRoute = context.initialRoute
    if (host?.activeRule !== undefined) props.activeRule = host.activeRule
    if (host?.entryOrigin !== undefined) props.entryOrigin = host.entryOrigin
    const stored = copyProps(props)
    snapshots.set(instanceId, stored)
    return copyProps(stored)
  }

  async function updatePublicContext(
    instanceId: string,
    patch: Readonly<RuntimeContextUpdate>,
  ): Promise<void> {
    const next = applyPublicPatch(snapshotOf(instanceId), patch)
    await options.runtimePort.updateInstanceProps(instanceId, copyProps(next))
    snapshots.set(instanceId, next)
  }

  function notifyLocale(instanceId: string, locale: string): Promise<void> {
    return updatePublicContext(instanceId, { locale })
  }

  async function emitToInstance<T>(instanceId: string, type: string, data: T): Promise<void> {
    const current = snapshotOf(instanceId)
    const message: MainDirectedMessage<T> = {
      type,
      data,
      applicationCode: current.applicationCode,
      viewId: current.viewId,
      instanceId: current.instanceId,
      appKey: current.instanceId,
      timestamp: Date.now(),
    }
    await options.runtimePort.emit(message)
  }

  function notifyAuthInvalid(
    instanceId: string,
    data?: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    return emitToInstance(instanceId, AUTH_INVALID_TYPE, data ?? {})
  }

  function releaseInstance(instanceId: string): void {
    snapshots.delete(instanceId)
  }

  return {
    buildPublicProps,
    updatePublicContext,
    notifyLocale,
    notifyAuthInvalid,
    emitToInstance,
    releaseInstance,
  }
}
