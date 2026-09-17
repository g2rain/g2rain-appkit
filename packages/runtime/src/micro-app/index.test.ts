import { describe, expect, it, vi } from 'vitest'
import { createBrowserEventAdapter, type MicroAppMessage } from './index.js'

type Message = MicroAppMessage<'g2rain:main-app:theme-changed', { theme: 'light' | 'dark' }>

describe('createBrowserEventAdapter', () => {
  it('delivers supported messages, isolates handler errors, and removes listeners', async () => {
    const target = new EventTarget()
    const onHandlerError = vi.fn()
    const adapter = createBrowserEventAdapter<Message>({ target, onHandlerError })
    const listener = vi.fn()
    adapter.subscribe(listener)
    adapter.subscribe(() => { throw new Error('expected') })
    const message: Message = { type: 'g2rain:main-app:theme-changed', data: { theme: 'dark' }, timestamp: 1 }
    adapter.emit(message)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(listener).toHaveBeenCalledWith(message)
    expect(onHandlerError).toHaveBeenCalledTimes(1)
    adapter.dispose()
    target.dispatchEvent(new CustomEvent(message.type, { detail: message }))
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
