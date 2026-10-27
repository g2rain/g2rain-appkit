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

  it('prefers an existing light/dark data-g2-theme over initialTheme', () => {
    const root = document.createElement('div')
    root.dataset.g2Theme = 'light'
    const controller = createThemeController({ root, initialTheme: 'dark' })
    expect(controller.getTheme()).toBe('light')
    expect(root.dataset.g2Theme).toBe('light')
  })

  it('swallows persist rejection without unhandled rejection', async () => {
    const root = document.createElement('div')
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const controller = createThemeController({
      root,
      persist: async () => {
        throw new Error('persist failed')
      },
    })
    controller.setTheme('dark')
    await vi.waitFor(() => expect(error).toHaveBeenCalled())
    error.mockRestore()
  })

  it('keeps notifying other listeners when one throws', () => {
    const root = document.createElement('div')
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const second = vi.fn()
    const controller = createThemeController({ root })
    controller.subscribe(() => {
      throw new Error('listener failed')
    })
    controller.subscribe(second)
    controller.setTheme('dark')
    expect(second).toHaveBeenCalledWith('dark')
    expect(error).toHaveBeenCalled()
    error.mockRestore()
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

  it('rolls back to the previous standalone theme on rollbackUpdate', async () => {
    const root = document.createElement('div')
    const capability = createThemeCapability({ root })
    const scope = createRuntimeScope()
    const previous = context('standalone', 'light')
    const next = context('standalone', 'dark')
    await capability.mount?.({ context: previous, container: document.createElement('div'), scope })
    await capability.update?.({ context: next, previous, scope })
    expect(root.dataset.g2Theme).toBe('dark')
    await capability.rollbackUpdate?.({ context: next, previous, scope })
    expect(root.dataset.g2Theme).toBe('light')
  })
})
