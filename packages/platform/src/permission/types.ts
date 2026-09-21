export type PageElementStatus = 'VISIBLE' | 'ENABLED'

export interface PageElementPermissionProvider {
  hasPageElementPermission(elementCode: string): boolean
  getPageElementStatus(elementCode: string): PageElementStatus | undefined
}

export interface ApiPermissionProvider {
  hasApiPermission(apiUrl: string, requestMethod: string): boolean
}

/** 页面元素权限与接口权限的合集。未安装插件时，usePermission 返回全部拒绝的实现。 */
export type PermissionProvider = PageElementPermissionProvider & ApiPermissionProvider
