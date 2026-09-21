import { PlatformError, type PlatformPhase } from '../contract/error.js'
import type { RuntimeContext, RuntimeContextUpdate, RuntimeMode } from '../contract/context.js'
import { createRuntimeScope, type RuntimeScope } from './scope.js'
import { sortCapabilities } from './order.js'
import type {
  CreateSubPlatformOptions,
  PlatformMountInput,
  PlatformUpdateInput,
  RuntimeCapability,
  SubApplication,
  SubMountRequest,
  SubPlatform,
} from '../sub/types.js'

/** Definition 级状态。实例可以挂载多次，Definition 本身只 bootstrap 一次。 */
type DefinitionState = 'created' | 'bootstrapped' | 'disposing' | 'disposed'
/** 单个 instanceId 的状态。updating 仍可被卸载，mounting / unmounting 则视为忙碌。 */
type InstanceState = 'mounting' | 'mounted' | 'updating' | 'unmounting'

interface MountedCapability {
  capability: RuntimeCapability
  scope: RuntimeScope
  mountInput: PlatformMountInput
}

interface InstanceRecord {
  state: InstanceState
  context: RuntimeContext
  scope: RuntimeScope
  application?: SubApplication
  mounted: MountedCapability[]
}

/** 把未知异常收成带阶段的 PlatformError；已经是 PlatformError 的原样返回。 */
function asPlatformError(phase: PlatformPhase, error: unknown, capabilityId?: string): PlatformError {
  if (error instanceof PlatformError) return error
  const message = error instanceof Error ? error.message : 'Platform lifecycle failed.'
  return new PlatformError({
    code: 'runtime.failed',
    phase,
    message,
    cause: error,
    capabilityId,
  })
}

/** 多条失败合成 runtime.aggregate；只有一条时保持原错误，避免无意义包装。 */
function combine(phase: PlatformPhase, errors: readonly unknown[], capabilityId?: string): PlatformError {
  if (errors.length === 1) return asPlatformError(phase, errors[0], capabilityId)
  return new PlatformError({
    code: 'runtime.aggregate',
    phase,
    message: 'Platform lifecycle failed.',
    cause: errors[0],
    errors,
  })
}

function isRuntimeMode(value: unknown): value is RuntimeMode {
  return value === 'standalone' || value === 'integrated'
}

/** 拷贝上下文，避免调用方随后修改原对象影响已挂载实例。metadata 只做浅拷贝。 */
function snapshotContext(context: RuntimeContext): RuntimeContext {
  return {
    applicationCode: context.applicationCode,
    viewId: context.viewId,
    instanceId: context.instanceId,
    mode: context.mode,
    contextPath: context.contextPath,
    locale: context.locale,
    theme: context.theme,
    initialRoute: context.initialRoute,
    metadata: context.metadata ? { ...context.metadata } : undefined,
  }
}

/**
 * 只合并 locale、theme、initialRoute、metadata。
 * applicationCode、viewId、instanceId、mode、contextPath 在实例生命周期内不可变。
 * 字段出现在 patch 里且值为 undefined，表示清空，而不是保留旧值。
 */
function applyPatch(previous: RuntimeContext, patch: RuntimeContextUpdate): RuntimeContext {
  const next = snapshotContext(previous)
  if ('locale' in patch) next.locale = patch.locale
  if ('theme' in patch) next.theme = patch.theme
  if ('initialRoute' in patch) next.initialRoute = patch.initialRoute
  if ('metadata' in patch) next.metadata = patch.metadata ? { ...patch.metadata } : undefined
  return next
}

/** 按 mount 的逆序 unmount，并释放每个 Capability 自己的子 Scope。单个失败不中断其余清理。 */
async function rollbackMounted(mounted: readonly MountedCapability[], phase: PlatformPhase): Promise<void> {
  const errors: unknown[] = []
  for (let index = mounted.length - 1; index >= 0; index -= 1) {
    const item = mounted[index]
    if (!item) continue
    try {
      await item.capability.unmount?.(item.mountInput)
    } catch (error) {
      errors.push(error)
    }
    try {
      await item.scope.dispose()
    } catch (error) {
      errors.push(error)
    }
  }
  if (errors.length > 0) throw combine(phase, errors)
}

/** update 失败时，对已成功的 Capability 逆序调用 rollbackUpdate。 */
async function rollbackUpdates(
  updated: ReadonlyArray<MountedCapability & { updateInput: PlatformUpdateInput }>,
  phase: PlatformPhase,
): Promise<void> {
  const errors: unknown[] = []
  for (let index = updated.length - 1; index >= 0; index -= 1) {
    const item = updated[index]
    if (!item) continue
    try {
      await item.capability.rollbackUpdate?.(item.updateInput)
    } catch (error) {
      errors.push(error)
    }
  }
  if (errors.length > 0) throw combine(phase, errors)
}

/**
 * 创建子应用 Definition。一份 Definition 对应一次脚本加载，可按 instanceId 同时挂载多个实例。
 *
 * Capability 在构造时按 dependsOn 做一次拓扑排序，之后 bootstrap、mount、update 都沿这个顺序，
 * 卸载和 dispose 沿相反顺序。任一步失败都会回滚已经成功的步骤，再把全部失败合成一个 PlatformError。
 * dispose 先等进行中的生命周期结束，再释放仍挂着的实例和 Definition 级资源。
 */
export function createSubPlatform(options: CreateSubPlatformOptions): SubPlatform {
  if (!options.applicationCode?.trim()) {
    throw new PlatformError({
      code: 'runtime.application-code',
      phase: 'bootstrap',
      message: 'applicationCode is required.',
    })
  }
  if (typeof options.createApplication !== 'function') {
    throw new PlatformError({
      code: 'runtime.application.invalid',
      phase: 'bootstrap',
      message: 'createApplication is required.',
    })
  }

  const ordered = sortCapabilities(options.capabilities ?? [])
  const definitionScope = createRuntimeScope()
  const instances = new Map<string, InstanceRecord>()
  let state: DefinitionState = 'created'
  let bootstrapTask: Promise<void> | undefined
  let disposeTask: Promise<void> | undefined
  const operations = new Set<Promise<void>>()

  /** 登记生命周期操作供 dispose 排空。操作本身的成败仍原样返回给调用方。 */
  function track<T>(operation: Promise<T>): Promise<T> {
    const done = operation.then(() => undefined, () => undefined)
    operations.add(done)
    void done.finally(() => {
      operations.delete(done)
    })
    return operation
  }

  /** 等到当前已登记的操作结束。清理过程中新登记的操作也会被下一轮等完。 */
  async function drainOperations(): Promise<void> {
    while (operations.size > 0) {
      await Promise.all([...operations])
    }
  }

  /** disposing / disposed 之后拒绝新的 bootstrap、mount、update 和 unmount。 */
  function assertActive(phase: PlatformPhase): void {
    if (state === 'disposing' || state === 'disposed') {
      throw new PlatformError({
        code: 'runtime.disposed',
        phase,
        message: 'Platform definition has been disposed.',
      })
    }
  }

  /**
   * 每个 Capability 使用 Definition Scope 的子 Scope。
   * 失败时先释放当前子 Scope，再逆序释放已经 bootstrap 成功的 Scope。
   * 若 bootstrap 过程中进入 disposing，已启动的 Capability 也会回滚。
   */
  async function runBootstrap(): Promise<void> {
    const started: RuntimeScope[] = []
    try {
      for (const capability of ordered) {
        if (state === 'disposing' || state === 'disposed') {
          throw new PlatformError({
            code: 'runtime.disposed',
            phase: 'bootstrap',
            message: 'Platform definition has been disposed.',
          })
        }
        const scope = definitionScope.child()
        try {
          await capability.bootstrap?.({ scope })
          started.push(scope)
        } catch (error) {
          const errors: unknown[] = [error]
          try {
            await scope.dispose()
          } catch (disposeError) {
            errors.push(disposeError)
          }
          for (let index = started.length - 1; index >= 0; index -= 1) {
            try {
              await started[index]?.dispose()
            } catch (disposeError) {
              errors.push(disposeError)
            }
          }
          throw combine('bootstrap', errors, capability.id)
        }
      }
      if (state === 'created') state = 'bootstrapped'
    } catch (error) {
      bootstrapTask = undefined
      throw error instanceof PlatformError ? error : combine('bootstrap', [error])
    }
  }

  /** 已 bootstrap 直接返回。并发调用共享同一次 runBootstrap，失败后允许再次发起。 */
  function bootstrap(): Promise<void> {
    assertActive('bootstrap')
    if (state === 'bootstrapped') return Promise.resolve()
    bootstrapTask ??= track(runBootstrap())
    return bootstrapTask
  }

  function validateMount(input: SubMountRequest): void {
    if (!input.instanceId) {
      throw new PlatformError({
        code: 'runtime.instance.missing',
        phase: 'mount',
        message: 'instanceId is required.',
      })
    }
    if (!(input.container instanceof HTMLElement)) {
      throw new PlatformError({
        code: 'runtime.container.invalid',
        phase: 'mount',
        message: 'mount requires an HTMLElement container.',
      })
    }
    if (input.context.instanceId !== input.instanceId) {
      throw new PlatformError({
        code: 'runtime.context.mismatch',
        phase: 'mount',
        message: 'context.instanceId must equal instanceId.',
      })
    }
    if (input.context.applicationCode !== options.applicationCode) {
      throw new PlatformError({
        code: 'runtime.context.mismatch',
        phase: 'mount',
        message: 'context.applicationCode must equal the definition applicationCode.',
      })
    }
    if (!input.context.viewId || !input.context.contextPath || !isRuntimeMode(input.context.mode)) {
      throw new PlatformError({
        code: 'runtime.context.invalid',
        phase: 'mount',
        message: 'context is missing viewId, contextPath, or mode.',
      })
    }
  }

  /**
   * 先确保 bootstrap，再按依赖顺序 mount Capability，最后挂载应用。
   * 尚未 push 进 mounted 的子 Scope 记在 pendingScope，失败时单独释放。
   * 中途失败会卸载已创建的应用、逆序 unmount Capability，并删除实例记录。
   */
  async function runMount(input: SubMountRequest): Promise<void> {
    assertActive('mount')
    validateMount(input)
    if (instances.has(input.instanceId)) {
      throw new PlatformError({
        code: 'runtime.instance.duplicate',
        phase: 'mount',
        message: `Instance "${input.instanceId}" is already mounted.`,
      })
    }

    const scope = createRuntimeScope()
    const record: InstanceRecord = {
      state: 'mounting',
      context: snapshotContext(input.context),
      scope,
      mounted: [],
    }
    instances.set(input.instanceId, record)

    /** mount 途中 Definition 被 dispose，或这条记录已不是当前实例时，中止并走统一回滚。 */
    function assertMountContinues(): void {
      if (state !== 'bootstrapped' || record.state !== 'mounting' || instances.get(input.instanceId) !== record) {
        throw new PlatformError({
          code: 'runtime.disposed',
          phase: 'mount',
          message: 'Platform definition is no longer active.',
        })
      }
    }

    let pendingScope: RuntimeScope | undefined
    let failedCapabilityId: string | undefined
    try {
      await bootstrap()
      assertMountContinues()

      for (const capability of ordered) {
        failedCapabilityId = capability.id
        const child = scope.child()
        pendingScope = child
        const mountInput: PlatformMountInput = {
          context: record.context,
          container: input.container,
          scope: child,
        }
        await capability.mount?.(mountInput)
        record.mounted.push({ capability, scope: child, mountInput })
        pendingScope = undefined
        assertMountContinues()
      }
      failedCapabilityId = undefined

      const application = await options.createApplication(record.context)
      record.application = application
      assertMountContinues()
      await application.mount(input.container)
      assertMountContinues()
      record.state = 'mounted'
    } catch (error) {
      const errors: unknown[] = [error]
      if (record.application) {
        try {
          await record.application.unmount()
        } catch (unmountError) {
          errors.push(unmountError)
        }
      }
      if (pendingScope) {
        try {
          await pendingScope.dispose()
        } catch (disposeError) {
          errors.push(disposeError)
        }
      }
      try {
        await rollbackMounted(record.mounted, 'mount')
      } catch (rollbackError) {
        errors.push(rollbackError)
      }
      try {
        await scope.dispose()
      } catch (disposeError) {
        errors.push(disposeError)
      }
      instances.delete(input.instanceId)
      throw combine('mount', errors, failedCapabilityId)
    }
  }

  function mount(input: SubMountRequest): Promise<void> {
    return track(runMount(input))
  }

  async function rollbackSuccessfulUpdates(
    updated: ReadonlyArray<MountedCapability & { updateInput: PlatformUpdateInput }>,
  ): Promise<void> {
    await rollbackUpdates(updated, 'update')
  }

  /**
   * 只有 mounted 可以更新。全部 Capability 成功后才写回 context。
   * 应用 update 失败时，先用 previous 再调一次应用，再回滚已更新的 Capability。
   * 失败后实例仍保持 mounted，调用方可以重试或卸载。
   */
  async function runUpdate(instanceId: string, patch: RuntimeContextUpdate): Promise<void> {
    assertActive('update')
    const record = instances.get(instanceId)
    if (!record || record.state !== 'mounted') {
      throw new PlatformError({
        code: record ? 'runtime.instance.busy' : 'runtime.instance.missing',
        phase: 'update',
        message: record
          ? `Instance "${instanceId}" cannot be updated from "${record.state}".`
          : `Instance "${instanceId}" is not mounted.`,
      })
    }

    record.state = 'updating'
    const previous = record.context
    const next = applyPatch(previous, patch)
    const updated: Array<MountedCapability & { updateInput: PlatformUpdateInput }> = []

    try {
      for (const item of record.mounted) {
        const updateInput: PlatformUpdateInput = {
          context: next,
          previous,
          scope: item.scope,
        }
        try {
          await item.capability.update?.(updateInput)
          if (item.capability.update) updated.push({ ...item, updateInput })
        } catch (error) {
          const errors: unknown[] = [error]
          try {
            await rollbackSuccessfulUpdates(updated)
          } catch (rollbackError) {
            errors.push(rollbackError)
          }
          throw combine('update', errors, item.capability.id)
        }
      }

      if (record.application?.update) {
        try {
          await record.application.update(next)
        } catch (error) {
          const errors: unknown[] = [error]
          try {
            await record.application.update(previous)
          } catch (rollbackError) {
            errors.push(rollbackError)
          }
          try {
            await rollbackSuccessfulUpdates(updated)
          } catch (rollbackError) {
            errors.push(rollbackError)
          }
          throw combine('update', errors)
        }
      }

      record.context = next
      record.state = 'mounted'
    } catch (error) {
      record.state = 'mounted'
      throw error
    }
  }

  function update(instanceId: string, patch: RuntimeContextUpdate): Promise<void> {
    return track(runUpdate(instanceId, patch))
  }

  /** 正常卸载。只接受 mounted / updating：先卸应用，再逆序 unmount Capability，最后释放实例 Scope。 */
  async function releaseInstance(instanceId: string, phase: PlatformPhase): Promise<void> {
    const record = instances.get(instanceId)
    if (!record) {
      throw new PlatformError({
        code: 'runtime.instance.missing',
        phase,
        message: `Instance "${instanceId}" is not mounted.`,
      })
    }
    if (record.state !== 'mounted' && record.state !== 'updating') {
      throw new PlatformError({
        code: 'runtime.instance.busy',
        phase,
        message: `Instance "${instanceId}" cannot be unmounted from "${record.state}".`,
      })
    }

    record.state = 'unmounting'
    const errors: unknown[] = []
    try {
      await record.application?.unmount()
    } catch (error) {
      errors.push(error)
    }
    for (let index = record.mounted.length - 1; index >= 0; index -= 1) {
      const item = record.mounted[index]
      if (!item) continue
      try {
        await item.capability.unmount?.(item.mountInput)
      } catch (error) {
        errors.push(error)
      }
    }
    try {
      await record.scope.dispose()
    } catch (error) {
      errors.push(error)
    }
    instances.delete(instanceId)
    if (errors.length > 0) throw combine(phase, errors)
  }

  /** dispose 时用于 mounting、unmounting 等非稳定状态。不检查状态机，尽量把资源和记录清掉。 */
  async function forceCleanup(record: InstanceRecord, instanceId: string): Promise<void> {
    const errors: unknown[] = []
    try {
      await record.application?.unmount()
    } catch (error) {
      errors.push(error)
    }
    for (let index = record.mounted.length - 1; index >= 0; index -= 1) {
      const item = record.mounted[index]
      if (!item) continue
      try {
        await item.capability.unmount?.(item.mountInput)
      } catch (error) {
        errors.push(error)
      }
    }
    try {
      await record.scope.dispose()
    } catch (error) {
      errors.push(error)
    }
    instances.delete(instanceId)
    if (errors.length > 0) throw combine('dispose', errors)
  }

  function unmount(instanceId: string): Promise<void> {
    return track((async () => {
      assertActive('unmount')
      await releaseInstance(instanceId, 'unmount')
    })())
  }

  /**
   * 先排空进行中的 mount / update / unmount，再逐个释放实例。
   * 稳定实例走 releaseInstance；忙状态走 forceCleanup。最后逆序 dispose Capability 和 Definition Scope。
   * 无论成功失败，结束时状态都是 disposed。
   */
  async function runDispose(): Promise<void> {
    await drainOperations()
    const errors: unknown[] = []
    try {
      for (const instanceId of [...instances.keys()]) {
        const record = instances.get(instanceId)
        if (!record) continue
        try {
          if (record.state === 'mounted' || record.state === 'updating') {
            await releaseInstance(instanceId, 'dispose')
          } else {
            await forceCleanup(record, instanceId)
          }
        } catch (error) {
          errors.push(error)
          instances.delete(instanceId)
        }
      }

      for (let index = ordered.length - 1; index >= 0; index -= 1) {
        try {
          await ordered[index]?.dispose?.()
        } catch (error) {
          errors.push(error)
        }
      }

      try {
        await definitionScope.dispose()
      } catch (error) {
        errors.push(error)
      }

      if (errors.length > 0) throw combine('dispose', errors)
    } finally {
      state = 'disposed'
    }
  }

  /** 第一次调用进入 disposing 并启动清理；重复调用复用同一次 Promise。 */
  function dispose(): Promise<void> {
    if (state === 'disposed') return Promise.resolve()
    if (!disposeTask) {
      state = 'disposing'
      disposeTask = runDispose()
    }
    return disposeTask
  }

  return { bootstrap, mount, update, unmount, dispose }
}
