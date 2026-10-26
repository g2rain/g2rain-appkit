import type { App, InjectionKey } from 'vue'
import { inject } from 'vue'
import type { G2rainDataProviders } from '../platform-data'

/** 页面元素权限：状态开关等按权限码判断能否操作，由应用注入 */
export interface G2rainPermissionProvider {
  isEnabled(code: string): boolean
}

export interface G2rainPlatformUiOptions {
  dataProviders?: G2rainDataProviders
  permission?: G2rainPermissionProvider
  onMissingProvider?: (name: 'organ' | 'dict' | 'permission') => void
}

const emptyOptions: G2rainPlatformUiOptions = {}

export const G2RAIN_PLATFORM_UI: InjectionKey<G2rainPlatformUiOptions> = Symbol(
  'g2rain-platform-ui',
)

/** 组织、字典、状态组件的数据与权限注入。不进入通用 UI 根插件。 */
export const G2rainPlatformUi = {
  install(app: App, options: G2rainPlatformUiOptions = {}): void {
    app.provide(G2RAIN_PLATFORM_UI, options)
  },
}

export function useG2rainPlatformUi(): G2rainPlatformUiOptions {
  return inject(G2RAIN_PLATFORM_UI, emptyOptions)
}
