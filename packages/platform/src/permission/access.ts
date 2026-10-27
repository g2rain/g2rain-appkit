import type { PageElementPermissionProvider } from './types.js'

/** 元素可操作：状态为 ENABLED */
export function isPageElementEnabled(provider: PageElementPermissionProvider, elementCode: string): boolean {
  return provider.getPageElementStatus(elementCode) === 'ENABLED'
}

/** 元素可见：状态为 VISIBLE 或 ENABLED */
export function isPageElementVisible(provider: PageElementPermissionProvider, elementCode: string): boolean {
  const status = provider.getPageElementStatus(elementCode)
  return status === 'VISIBLE' || status === 'ENABLED'
}

/** 去掉查询串和 hash，并保证以 / 开头 */
function normalizePath(path: string): string {
  const pathname = path.split(/[?#]/)[0]
  return pathname.startsWith('/') ? pathname : `/${pathname}`
}

/**
 * 取出用于匹配接口权限的路径：完整 URL 取 pathname；相对路径结合 baseURL 解析；
 * 已是绝对路径时直接去掉查询串。解析失败时退回去掉查询串的原路径。
 */
export function resolveApiPath(url: string, baseURL?: string): string {
  try {
    if (/^https?:\/\//.test(url)) return new URL(url).pathname
    if (baseURL && !url.startsWith('/')) {
      const base = baseURL.endsWith('/') ? baseURL : `${baseURL}/`
      if (/^https?:\/\//.test(base)) return new URL(url, base).pathname
      return normalizePath(base + url)
    }
  } catch {
    // 解析失败时按原路径处理
  }
  return normalizePath(url)
}
