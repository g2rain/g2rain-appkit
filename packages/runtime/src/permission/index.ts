export type PageElementStatus = 'VISIBLE' | 'ENABLED'

import { inject, type App, type InjectionKey, type Plugin } from 'vue'

export interface PageElementPermissionProvider {
  hasPageElementPermission(elementCode: string): boolean
  getPageElementStatus(elementCode: string): PageElementStatus | undefined
}

export interface ApiPermissionProvider {
  hasApiPermission(apiUrl: string, requestMethod: string): boolean
}

export type PermissionProvider = PageElementPermissionProvider & ApiPermissionProvider

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

/** Installs a permission provider owned by the consuming application. */
export function createPermissionPlugin(options: PermissionPluginOptions = {}): Plugin {
  return {
    install(app: App) {
      if (!options.provider) options.onMissingProvider?.()
      app.provide(G2RAIN_PERMISSION_PROVIDER, options.provider ?? denyByDefault)
    },
  }
}

export const G2rainPermission: Plugin = createPermissionPlugin()

/** Returns the injected provider, or a secure deny-all fallback outside plugin setup. */
export function usePermission(): PermissionProvider {
  return inject(G2RAIN_PERMISSION_PROVIDER, null) ?? denyByDefault
}
