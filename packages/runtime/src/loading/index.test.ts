import { describe, expect, it, vi } from 'vitest'
import { createLoadingController } from './index.js'

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
