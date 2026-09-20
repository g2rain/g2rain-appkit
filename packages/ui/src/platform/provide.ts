import type { App, InjectionKey } from 'vue'
import { inject } from 'vue'
import type { G2rainDataProviders } from '../platform-data'

export interface G2rainPlatformUiOptions {
  dataProviders?: G2rainDataProviders
  onMissingProvider?: (name: 'organ' | 'dict') => void
}

const emptyOptions: G2rainPlatformUiOptions = {}

export const G2RAIN_PLATFORM_UI: InjectionKey<G2rainPlatformUiOptions> = Symbol(
  'g2rain-platform-ui',
)

/** 组织、字典和状态组件的数据注入。不进入通用 UI 根插件。 */
export const G2rainPlatformUi = {
  install(app: App, options: G2rainPlatformUiOptions = {}): void {
    app.provide(G2RAIN_PLATFORM_UI, options)
  },
}

export function useG2rainPlatformUi(): G2rainPlatformUiOptions {
  return inject(G2RAIN_PLATFORM_UI, emptyOptions)
}
