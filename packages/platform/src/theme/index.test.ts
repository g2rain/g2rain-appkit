import { describe, expect, it, vi } from 'vitest'
import { createRuntimeScope } from '../kernel/scope.js'
import type { RuntimeContext } from '../contract/context.js'
import { createThemeCapability, createThemeController } from './index.js'

function context(mode: RuntimeContext['mode'], theme?: RuntimeContext['theme']): RuntimeContext {
  return {
    applicationCode: 'member',
    viewId: 'view',
    instanceId: 'inst',
    mode,
    contextPath: '/member',
    theme,
  }
}

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

describe('createThemeCapability', () => {
  it('does not write the document theme in integrated mode and keeps it after unmount', async () => {
    const root = document.createElement('div')
    root.dataset.g2Theme = 'light'
    const controller = createThemeController({ root })
    const setTheme = vi.spyOn(controller, 'setTheme')
    const capability = createThemeCapability({ controller, root })
    const input = {
      context: context('integrated', 'dark'),
      container: document.createElement('div'),
      scope: createRuntimeScope(),
    }

    await capability.mount?.(input)
    await capability.unmount?.(input)

    expect(setTheme).not.toHaveBeenCalled()
    expect(root.dataset.g2Theme).toBe('light')
  })

  it('applies a standalone theme and does not clear it on unmount', async () => {
    const root = document.createElement('div')
    const capability = createThemeCapability({ root })
    const input = {
      context: context('standalone', 'dark'),
      container: document.createElement('div'),
      scope: createRuntimeScope(),
    }

    await capability.mount?.(input)
    expect(root.dataset.g2Theme).toBe('dark')
    await capability.unmount?.(input)
    expect(root.dataset.g2Theme).toBe('dark')
  })
})
