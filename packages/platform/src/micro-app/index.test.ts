import { describe, expect, it, vi } from 'vitest'
import type { RuntimeContext } from '../contract/context.js'
import { createSubPlatform } from '../kernel/definition.js'
import { createRuntimeScope } from '../kernel/scope.js'
import { createBrowserEventAdapter, createMessageCapability, type MicroAppMessage } from './index.js'

type Message = MicroAppMessage<'g2rain:main-app:theme-changed', { theme: 'light' | 'dark' }>

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('createBrowserEventAdapter', () => {
  it('delivers supported messages, isolates handler errors, and removes listeners', async () => {
    const target = new EventTarget()
    const onHandlerError = vi.fn()
    const adapter = createBrowserEventAdapter<Message>({ target, onHandlerError })
    const listener = vi.fn()
    adapter.subscribe(listener)
    adapter.subscribe(() => { throw new Error('expected') })
    const message: Message = { type: 'g2rain:main-app:theme-changed', data: { theme: 'dark' }, timestamp: 1 }
    // 外部派发（非本适配器 emit）才能被本适配器收到
    target.dispatchEvent(new CustomEvent(message.type, { detail: message }))
    await flush()
    expect(listener).toHaveBeenCalledWith(message)
    expect(onHandlerError).toHaveBeenCalledTimes(1)
    adapter.dispose()
    target.dispatchEvent(new CustomEvent(message.type, { detail: message }))
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('does not deliver its own emit to local handlers; another adapter on the same target receives it', async () => {
    const target = new EventTarget()
    const a = createBrowserEventAdapter<Message>({ target })
    const b = createBrowserEventAdapter<Message>({ target })
    const local = vi.fn()
    const peer = vi.fn()
    a.subscribe(local)
    b.subscribe(peer)
    const message: Message = { type: 'g2rain:main-app:theme-changed', data: { theme: 'light' }, timestamp: 2 }
    a.emit(message)
    await flush()
    expect(local).not.toHaveBeenCalled()
    expect(peer).toHaveBeenCalledWith(message)
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

    const emit = async (patch: Partial<MicroAppMessage>) => {
      // 用另一适配器发出，避免自过滤
      const peer = createBrowserEventAdapter<MicroAppMessage>({
        target,
        eventTypes: ['g2rain:sub-app:route-change'],
      })
      peer.emit({
        type: 'g2rain:sub-app:route-change',
        data: { path: '/dict' },
        timestamp: 1,
        ...patch,
      })
      peer.dispose()
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

  it('keeps the adapter after a failed bootstrap retry and disposes it with the definition', async () => {
    const target = new EventTarget()
    const adapter = createBrowserEventAdapter<MicroAppMessage>({
      target,
      eventTypes: ['g2rain:sub-app:route-change'],
    })
    const message = createMessageCapability(adapter)
    let failOnce = true
    const platform = createSubPlatform({
      applicationCode: 'member',
      createApplication: () => ({
        mount() { return undefined },
        unmount() { return undefined },
      }),
      capabilities: [
        message,
        {
          id: 'flaky',
          dependsOn: ['message'],
          bootstrap() {
            if (failOnce) {
              failOnce = false
              throw new Error('bootstrap failed')
            }
          },
        },
      ],
    })

    await expect(platform.bootstrap()).rejects.toBeTruthy()
    await platform.bootstrap()
    const session = vi.fn()
    message.subscribeSession(session)
    const peer = createBrowserEventAdapter<MicroAppMessage>({
      target,
      eventTypes: ['g2rain:sub-app:route-change'],
    })
    peer.emit({ type: 'g2rain:sub-app:route-change', data: {}, timestamp: 1 })
    peer.dispose()
    await flush()
    expect(session).toHaveBeenCalledTimes(1)

    await platform.dispose()
    const after = vi.fn()
    // adapter 已随 Definition dispose；subscribe 为空操作
    adapter.subscribe(after)
    const outsider = createBrowserEventAdapter<MicroAppMessage>({
      target,
      eventTypes: ['g2rain:sub-app:route-change'],
    })
    outsider.emit({ type: 'g2rain:sub-app:route-change', data: {}, timestamp: 2 })
    outsider.dispose()
    await flush()
    expect(after).not.toHaveBeenCalled()
  })
})
