import { describe, expect, it, vi } from 'vitest'
import type { RuntimeContext } from '../contract/context.js'
import { createRuntimeScope } from '../kernel/scope.js'
import { createLoadingCapability, createLoadingController } from './index.js'

describe('createLoadingController', () => {
  it('uses reference counting and idempotent finish functions', () => {
    const close = vi.fn()
    const open = vi.fn(() => ({ close }))
    const controller = createLoadingController({ open })
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
})

describe('createLoadingCapability', () => {
  it('ends only the unmounted instance', async () => {
    const closes = [vi.fn(), vi.fn()]
    let opened = 0
    const capability = createLoadingCapability({
      open: () => ({ close: closes[opened++] ?? vi.fn() }),
    })
    const scopeA = createRuntimeScope()
    const scopeB = createRuntimeScope()
    const base: RuntimeContext = {
      applicationCode: 'member',
      viewId: 'view',
      instanceId: 'a',
      mode: 'integrated',
      contextPath: '/member',
    }
    await capability.mount?.({
      context: base,
      container: document.createElement('div'),
      scope: scopeA,
    })
    await capability.mount?.({
      context: { ...base, instanceId: 'b' },
      container: document.createElement('div'),
      scope: scopeB,
    })

    capability.begin('a')
    capability.begin('b')
    await scopeA.dispose()

    expect(closes[0]).toHaveBeenCalledTimes(1)
    expect(closes[1]).not.toHaveBeenCalled()
    capability.begin('b')
    expect(closes[1]).not.toHaveBeenCalled()
    await scopeB.dispose()
    expect(closes[1]).toHaveBeenCalledTimes(1)
  })
})
