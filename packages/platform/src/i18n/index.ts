import type { RuntimeCapability } from '../sub/types.js'
import type { RuntimeScope } from '../kernel/scope.js'

export interface I18nEngineAdapter {
  getLocale(): string
  setLocale(locale: string): void | Promise<void>
  translate(key: string, params?: Readonly<Record<string, unknown>>): string
  loadMessages?(locale: string): void | Promise<void>
  subscribe?(handler: (locale: string) => void): () => void
  dispose?(): void | Promise<void>
}

export interface UiLocaleAdapter {
  applyLocale(locale: string): void | Promise<void>
  dispose?(): void | Promise<void>
}

export interface I18nCapabilityOptions {
  engine: I18nEngineAdapter
  uiLocale?: UiLocaleAdapter
}

function present(value: string | undefined): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  return value
}

/** 先加载文案，再切换引擎 locale，最后同步组件库。空 locale 不产生副作用。 */
async function applyLocale(options: I18nCapabilityOptions, locale: string | undefined): Promise<void> {
  const next = present(locale)
  if (!next) return
  await options.engine.loadMessages?.(next)
  await options.engine.setLocale(next)
  await options.uiLocale?.applyLocale(next)
}

/**
 * bootstrap 时把引擎和 UI 适配器的 dispose 登记到 Definition Scope。
 * mount 与 update 都按当前 context.locale 应用；rollbackUpdate 改回 previous.locale。
 */
export function createI18nCapability(options: I18nCapabilityOptions): RuntimeCapability {
  return {
    id: 'i18n',
    bootstrap({ scope }) {
      registerDispose(scope, options.engine.dispose)
      registerDispose(scope, options.uiLocale?.dispose)
    },
    mount(input) {
      return applyLocale(options, input.context.locale)
    },
    update(input) {
      return applyLocale(options, input.context.locale)
    },
    rollbackUpdate(input) {
      return applyLocale(options, input.previous.locale)
    },
  }
}

function registerDispose(scope: RuntimeScope, dispose: (() => void | Promise<void>) | undefined) {
  if (dispose) scope.add(() => dispose())
}
