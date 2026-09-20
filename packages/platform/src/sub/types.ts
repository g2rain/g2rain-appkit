import type { RuntimeContext, RuntimeContextUpdate } from '../contract/context.js'
import type { RuntimeScope } from '../kernel/scope.js'

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

export interface SubMountRequest {
  instanceId: string
  context: Readonly<RuntimeContext>
  container: HTMLElement
}

export interface SubApplication {
  mount(container: HTMLElement): void | Promise<void>
  update?(context: Readonly<RuntimeContext>): void | Promise<void>
  unmount(): void | Promise<void>
}

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
