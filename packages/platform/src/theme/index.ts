import type { G2rainTheme, RuntimeContext } from '../contract/context.js'
import type { RuntimeCapability } from '../sub/types.js'

export type { G2rainTheme } from '../contract/context.js'

export interface ThemeController {
  getTheme(): G2rainTheme
  setTheme(theme: G2rainTheme): void
  subscribe(listener: (theme: G2rainTheme) => void): () => void
  dispose(): void
}

export function createThemeController(options: {
  root?: HTMLElement
  initialTheme?: G2rainTheme
  persist?: (theme: G2rainTheme) => void | Promise<void>
} = {}): ThemeController {
  const root = options.root ?? (typeof document === 'undefined' ? undefined : document.documentElement)
  if (!root) throw new Error('createThemeController requires a root outside a browser environment.')
  let disposed = false
  let currentTheme: G2rainTheme = root.dataset.g2Theme === 'dark' ? 'dark' : options.initialTheme ?? 'light'
  const listeners = new Set<(theme: G2rainTheme) => void>()
  root.dataset.g2Theme = currentTheme

  return {
    getTheme: () => currentTheme,
    setTheme(theme) {
      if (disposed || theme === currentTheme) return
      currentTheme = theme
      root.dataset.g2Theme = theme
      void options.persist?.(theme)
      listeners.forEach(listener => listener(theme))
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
    dispose() {
      owned?.dispose()
      owned = undefined
    },
  }
}
