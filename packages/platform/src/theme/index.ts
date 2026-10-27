import type { G2rainTheme, RuntimeContext } from '../contract/context.js'
import type { RuntimeCapability } from '../sub/types.js'

export type { G2rainTheme } from '../contract/context.js'

export interface ThemeController {
  getTheme(): G2rainTheme
  setTheme(theme: G2rainTheme): void
  subscribe(listener: (theme: G2rainTheme) => void): () => void
  dispose(): void
}

/**
 * 把主题写到根节点的 data-g2-theme。初始值：根已有 light/dark 用它，否则 initialTheme，再否则 light。
 * 非浏览器环境必须传入 root。相同主题或已 dispose 时 setTheme 不产生副作用。
 */
export function createThemeController(options: {
  root?: HTMLElement
  initialTheme?: G2rainTheme
  persist?: (theme: G2rainTheme) => void | Promise<void>
} = {}): ThemeController {
  const root = options.root ?? (typeof document === 'undefined' ? undefined : document.documentElement)
  if (!root) throw new Error('createThemeController requires a root outside a browser environment.')
  let disposed = false
  const fromRoot = root.dataset.g2Theme
  let currentTheme: G2rainTheme =
    fromRoot === 'light' || fromRoot === 'dark' ? fromRoot : options.initialTheme ?? 'light'
  const listeners = new Set<(theme: G2rainTheme) => void>()
  root.dataset.g2Theme = currentTheme

  return {
    getTheme: () => currentTheme,
    setTheme(theme) {
      if (disposed || theme === currentTheme) return
      currentTheme = theme
      root.dataset.g2Theme = theme
      // 包一层 Promise：persist 同步抛错和异步失败都在这里接住，不影响 setTheme
      void new Promise<void>(resolve => resolve(options.persist?.(theme))).catch(error => {
        console.error(error)
      })
      listeners.forEach(listener => {
        try {
          listener(theme)
        } catch (error) {
          console.error(error)
        }
      })
    },
    subscribe(listener) {
      if (disposed) return () => undefined
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose() {
      disposed = true
      listeners.clear()
    },
  }
}

/**
 * 只在独立模式且 context.theme 有值时改主题。集成模式的主题由 Main Shell 负责。
 * 未注入 controller 时，第一次需要应用主题才创建，并在 Capability dispose 时释放。
 */
export function createThemeCapability(options: {
  controller?: ThemeController
  root?: HTMLElement
  persist?: (theme: G2rainTheme) => void | Promise<void>
} = {}): RuntimeCapability {
  let owned: ThemeController | undefined

  function apply(context: Readonly<RuntimeContext>) {
    if (context.mode !== 'standalone' || !context.theme) return
    const theme = context.theme
    const controller = options.controller ?? (owned ??= createThemeController({
      root: options.root,
      initialTheme: theme,
      persist: options.persist,
    }))
    controller.setTheme(theme)
  }

  return {
    id: 'theme',
    mount(input) {
      apply(input.context)
    },
    update(input) {
      apply(input.context)
    },
    rollbackUpdate(input) {
      apply(input.previous)
    },
    dispose() {
      owned?.dispose()
      owned = undefined
    },
  }
}
