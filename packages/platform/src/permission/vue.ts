import { inject, type App, type InjectionKey, type Plugin } from 'vue'
import type { PermissionProvider } from './types.js'

const denyByDefault: PermissionProvider = {
  hasPageElementPermission: () => false,
  getPageElementStatus: () => undefined,
  hasApiPermission: () => false,
}

export const G2RAIN_PERMISSION_PROVIDER: InjectionKey<PermissionProvider> = Symbol('g2rain-permission-provider')

export interface PermissionPluginOptions {
  provider?: PermissionProvider
  onMissingProvider?: () => void
}

/** 未提供 provider 时安装全部拒绝的实现，避免组件在缺少插件时误放行。 */
export function createPermissionPlugin(options: PermissionPluginOptions = {}): Plugin {
  return {
    install(app: App) {
      if (!options.provider) options.onMissingProvider?.()
      app.provide(G2RAIN_PERMISSION_PROVIDER, options.provider ?? denyByDefault)
    },
  }
}

export const G2rainPermission: Plugin = createPermissionPlugin()

/** 返回注入的 provider。插件未安装时同样全部拒绝，不把缺失当成有权限。 */
export function usePermission(): PermissionProvider {
  return inject(G2RAIN_PERMISSION_PROVIDER, null) ?? denyByDefault
}
