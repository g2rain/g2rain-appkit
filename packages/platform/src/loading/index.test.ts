import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeContext } from '../contract/context.js'
import { createRuntimeScope } from '../kernel/scope.js'
import { createLoadingCapability, createLoadingController } from './index.js'

afterEach(() => { vi.useRealTimers() })

describe('createLoadingController', () => {
  it('uses reference counting and idempotent finish functions', () => {
    const close = vi.fn()
    const open = vi.fn(() => ({ close }))
    const controller = createLoadingController({ open, delay: 0, minDuration: 0 })
    const first = controller.begin()
    const second = controller.begin()
    first()
    first()
    expect(controller.activeCount).toBe(1)
    expect(close).not.toHaveBeenCalled()
    second()
    expect(open).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('does not open for requests that finish within the delay', () => {
    vi.useFakeTimers()
    const open = vi.fn(() => ({ close: vi.fn() }))
    const controller = createLoadingController({ open })
    const end = controller.begin()
    vi.advanceTimersByTime(199)
    end()
    vi.advanceTimersByTime(1000)
    expect(open).not.toHaveBeenCalled()
  })

  it('keeps the overlay for the minimum duration once shown', () => {
    vi.useFakeTimers()
    const close = vi.fn()
    const controller = createLoadingController({ open: () => ({ close }) })
    const end = controller.begin()
    vi.advanceTimersByTime(200)
    end()
    vi.advanceTimersByTime(299)
    expect(close).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('reuses the visible overlay when a new request starts before it closes', () => {
    vi.useFakeTimers()
    const close = vi.fn()
    const open = vi.fn(() => ({ close }))
    const controller = createLoadingController({ open })
    const first = controller.begin()
    vi.advanceTimersByTime(200)
    first()
    const second = controller.begin()
    vi.advanceTimersByTime(1000)
    expect(open).toHaveBeenCalledTimes(1)
    expect(close).not.toHaveBeenCalled()
    second()
    vi.advanceTimersByTime(1000)
    expect(close).toHaveBeenCalledTimes(1)
  })
})

describe('createLoadingCapability', () => {
  it('shares one overlay across instances and ends only the unmounted instance', async () => {
    const close = vi.fn()
    const open = vi.fn(() => ({ close }))
    const capability = createLoadingCapability({ open, delay: 0, minDuration: 0 })
    const scopeA = createRuntimeScope()
    const scopeB = createRuntimeScope()
    const base: RuntimeContext = {
      applicationCode: 'member',
      viewId: 'view',
      instanceId: 'a',
      mode: 'integrated',
      contextPath: '/member',
    }
    await capability.mount?.({ context: base, container: document.createElement('div'), scope: scopeA })
    await capability.mount?.({ context: { ...base, instanceId: 'b' }, container: document.createElement('div'), scope: scopeB })

    capability.begin('a')
    capability.begin('b')
    expect(open).toHaveBeenCalledTimes(1)
    await scopeA.dispose()
    expect(close).not.toHaveBeenCalled()
    await scopeB.dispose()
    expect(close).toHaveBeenCalledTimes(1)
    expect(capability.begin('a')).toBeTypeOf('function')
  })
})
