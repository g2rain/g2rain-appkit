import type { RuntimeContext, RuntimeContextUpdate } from '../contract/context.js'
import type { RuntimeScope } from '../kernel/scope.js'

/**
 * 平台能力单元。id 在同一份 Definition 内唯一，dependsOn 只引用其他 Capability 的 id。
 * 钩子都可选。Kernel 按 bootstrap、mount、update 的依赖顺序调用，卸载和 dispose 相反。
 * mount 收到的 scope 是实例 Scope 的子 Scope，随该 Capability 卸载而释放。
 * rollbackUpdate 收到的 input.context 仍是更新后的上下文，input.previous 才是回滚目标。
 */
export interface RuntimeCapability {
  readonly id: string
  readonly dependsOn?: readonly string[]
  bootstrap?(input: { scope: RuntimeScope }): void | Promise<void>
  mount?(input: PlatformMountInput): void | Promise<void>
  update?(input: PlatformUpdateInput): void | Promise<void>
  rollbackUpdate?(input: PlatformUpdateInput): void | Promise<void>
  unmount?(input: PlatformMountInput): void | Promise<void>
  dispose?(): void | Promise<void>
}

export interface PlatformMountInput {
  context: Readonly<RuntimeContext>
  container: HTMLElement
  scope: RuntimeScope
}

export interface PlatformUpdateInput {
  context: Readonly<RuntimeContext>
  previous: Readonly<RuntimeContext>
  scope: RuntimeScope
}

/** 一次 mount 请求。context.instanceId 必须等于 instanceId，context.applicationCode 必须等于 Definition。 */
export interface SubMountRequest {
  instanceId: string
  context: Readonly<RuntimeContext>
  container: HTMLElement
}

/**
 * 业务应用句柄，由 createApplication 创建，并且在全部 Capability mount 成功之后才 mount。
 * update 可选；提供时若失败，Kernel 会再用更新前的上下文调用一次，作为应用自身的回滚。
 */
export interface SubApplication {
  mount(container: HTMLElement): void | Promise<void>
  update?(context: Readonly<RuntimeContext>): void | Promise<void>
  unmount(): void | Promise<void>
}

/** Definition 对外生命周期。bootstrap 可提前单独调用；未调用时，第一次 mount 会先触发它。 */
export interface SubPlatformLifecycle {
  bootstrap(): Promise<void>
  mount(input: SubMountRequest): Promise<void>
  update(instanceId: string, patch: Readonly<RuntimeContextUpdate>): Promise<void>
  unmount(instanceId: string): Promise<void>
}

export interface CreateSubPlatformOptions {
  applicationCode: string
  createApplication: (context: Readonly<RuntimeContext>) => SubApplication | Promise<SubApplication>
  capabilities?: readonly RuntimeCapability[]
}

export interface SubPlatform extends SubPlatformLifecycle {
  dispose(): Promise<void>
}
