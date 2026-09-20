import { describe, expect, it, vi } from 'vitest'
import type { RuntimeContext } from '../contract/context.js'
import { createRuntimeScope } from '../kernel/scope.js'
import { createBrowserEventAdapter, createMessageCapability, type MicroAppMessage } from './index.js'

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

describe('createMessageCapability', () => {
  it('delivers a message only to the addressed instance and keeps the session handler', async () => {
    const target = new EventTarget()
    const adapter = createBrowserEventAdapter<MicroAppMessage>({
      target,
      eventTypes: ['g2rain:sub-app:route-change'],
    })
    const capability = createMessageCapability(adapter)
    const definition = createRuntimeScope()
    await capability.bootstrap?.({ scope: definition })
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
    await capability.mount?.({
      context: { ...base, instanceId: 'b' },
      container: document.createElement('div'),
      scope: scopeB,
    })
    const session = vi.fn()
    const first = vi.fn()
    const second = vi.fn()
    capability.subscribeSession(session)
    capability.subscribeInstance('a', first)
    capability.subscribeInstance('b', second)

    const flush = () => new Promise(resolve => setTimeout(resolve, 0))
    const emit = async (patch: Partial<MicroAppMessage>) => {
      adapter.emit({
        type: 'g2rain:sub-app:route-change',
        data: { path: '/dict' },
        timestamp: 1,
        ...patch,
      })
      await flush()
    }

    await emit({ appKey: 'a' })
    await emit({ instanceId: 'b', appKey: 'a' })
    await emit({})
    await scopeA.dispose()
    await emit({ appKey: 'a' })

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    expect(session).toHaveBeenCalledTimes(4)
  })
})
