export type PageElementStatus = 'VISIBLE' | 'ENABLED'

export interface PageElementPermissionProvider {
  hasPageElementPermission(elementCode: string): boolean
  getPageElementStatus(elementCode: string): PageElementStatus | undefined
}

export interface ApiPermissionProvider {
  hasApiPermission(apiUrl: string, requestMethod: string): boolean
}

export type PermissionProvider = PageElementPermissionProvider & ApiPermissionProvider
