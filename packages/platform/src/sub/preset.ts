import type { PlatformError } from '../contract/error.js'
import { createErrorCapability, type ErrorCapabilityOptions } from '../error/index.js'
import { createI18nCapability, type I18nEngineAdapter, type UiLocaleAdapter } from '../i18n/index.js'
import { createSubPlatform } from '../kernel/definition.js'
import type { CreateSubPlatformOptions, RuntimeCapability, SubPlatform } from './types.js'

export interface StandardSubPlatformOptions {
  applicationCode: string
  createApplication: CreateSubPlatformOptions['createApplication']
  i18n: {
    engine: I18nEngineAdapter
    uiLocale?: UiLocaleAdapter
  }
  error: ErrorCapabilityOptions
  capabilities?: readonly RuntimeCapability[]
}

export interface StandardSubPlatform extends SubPlatform {
  handleError(error: unknown): Promise<PlatformError>
}

/**
 * 子应用标准装配：先 i18n，再 error，然后是调用方追加的 Capability。
 * error 在提供 translate 时依赖 i18n，因此必须排在 i18n 之后，不能让调用方插到它们前面。
 * handleError 直接进入错误 Capability，不经过 mount 状态机。
 */
export function createStandardSubPlatform(options: StandardSubPlatformOptions): StandardSubPlatform {
  const errors = createErrorCapability({
    ...options.error,
    translate: key => options.i18n.engine.translate(key),
  })
  const platform = createSubPlatform({
    applicationCode: options.applicationCode,
    createApplication: options.createApplication,
    capabilities: [
      createI18nCapability(options.i18n),
      errors,
      ...(options.capabilities ?? []),
    ],
  })
  return {
    bootstrap: () => platform.bootstrap(),
    mount: input => platform.mount(input),
    update: (instanceId, patch) => platform.update(instanceId, patch),
    unmount: instanceId => platform.unmount(instanceId),
    dispose: () => platform.dispose(),
    handleError: input => errors.handle(input),
  }
}
