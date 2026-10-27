import { inject, type App, type Directive, type InjectionKey, type Plugin } from 'vue'
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

function isButton(el: HTMLElement): boolean {
  return el.tagName === 'BUTTON' || el.classList.contains('el-button') || el.getAttribute('data-component') === 'el-button'
}

/** 按页面元素状态改写元素：没有状态隐藏；VISIBLE 显示但禁用；ENABLED 可用 */
function applyElementStatus(el: HTMLElement, status: string | undefined): void {
  if (!status) {
    el.style.display = 'none'
    return
  }
  el.style.display = ''
  const enabled = status === 'ENABLED'
  if (isButton(el)) {
    if (enabled) {
      el.removeAttribute('disabled')
      el.classList.remove('is-disabled')
    } else {
      el.setAttribute('disabled', 'disabled')
      el.classList.add('is-disabled')
    }
    return
  }
  el.style.pointerEvents = enabled ? '' : 'none'
  el.style.opacity = enabled ? '' : '0.6'
  el.style.cursor = enabled ? '' : 'not-allowed'
}

/**
 * v-permission="'elementCode'"：按页面元素状态控制显示和可用性。
 * 状态开关不走本指令，StatusSwitch 通过 permission 属性自行计算 disabled。
 */
export function createPermissionDirective(provider: PermissionProvider): Directive<HTMLElement, string> {
  return {
    mounted(el, binding) { applyElementStatus(el, provider.getPageElementStatus(binding.value)) },
    updated(el, binding) { applyElementStatus(el, provider.getPageElementStatus(binding.value)) },
  }
}

/**
 * 注入 provider 并注册 v-permission 指令。
 * 未提供 provider 时安装全部拒绝的实现，避免组件在缺少插件时误放行。
 */
export function createPermissionPlugin(options: PermissionPluginOptions = {}): Plugin {
  return {
    install(app: App) {
      if (!options.provider) options.onMissingProvider?.()
      const provider = options.provider ?? denyByDefault
      app.provide(G2RAIN_PERMISSION_PROVIDER, provider)
      app.directive('permission', createPermissionDirective(provider))
    },
  }
}

export const G2rainPermission: Plugin = createPermissionPlugin()

/** 返回注入的 provider。插件未安装时同样全部拒绝，不把缺失当成有权限。 */
export function usePermission(): PermissionProvider {
  return inject(G2RAIN_PERMISSION_PROVIDER, null) ?? denyByDefault
}
