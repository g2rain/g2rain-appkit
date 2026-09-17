import { describe, expect, it, vi } from 'vitest'
import { createThemeController } from './index.js'

describe('createThemeController', () => {
  it('updates the root once per change and stops notifications after dispose', () => {
    const root = document.createElement('div')
    const persist = vi.fn()
    const listener = vi.fn()
    const controller = createThemeController({ root, persist })
    controller.subscribe(listener)
    controller.setTheme('dark')
    controller.setTheme('dark')
    controller.dispose()
    controller.setTheme('light')
    expect(root.dataset.g2Theme).toBe('dark')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(persist).toHaveBeenCalledWith('dark')
  })
})
