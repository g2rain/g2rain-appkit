import { describe, expect, it, vi } from 'vitest'
import type { RuntimeContext } from '../contract/context.js'
import { PlatformError } from '../contract/error.js'
import { createMainPlatform, type MainDirectedMessage, type MainPublicProps } from './index.js'

function context(patch: Partial<RuntimeContext> = {}): RuntimeContext {
  return {
    applicationCode: 'member',
    viewId: 'menu-member',
    instanceId: 'menu-member',
    mode: 'integrated',
    contextPath: '/member',
    locale: 'zh-CN',
    theme: 'dark',
    initialRoute: '/dict',
    metadata: { accessToken: 'secret', tokenKid: 'kid' },
    ...patch,
  }
}

function port() {
  const updates: MainPublicProps[] = []
  const messages: MainDirectedMessage<unknown>[] = []
  return {
    updates,
    messages,
    runtimePort: {
      updateInstanceProps: vi.fn(async (_instanceId: string, props: Readonly<MainPublicProps>) => {
        updates.push({ ...props })
      }),
      emit: vi.fn(async <T>(message: MainDirectedMessage<T>) => {
        messages.push(message)
      }),
    },
  }
}

describe('createMainPlatform', () => {
  it('builds an allowlisted snapshot and sets appKey to instanceId', () => {
    const main = createMainPlatform({ runtimePort: port().runtimePort })
    const props = main.buildPublicProps(context(), {
      activeRule: '/member',
      entryOrigin: 'http://localhost:8080',
    })

    expect(props).toEqual({
      applicationCode: 'member',
      viewId: 'menu-member',
      instanceId: 'menu-member',
      locale: 'zh-CN',
      initialRoute: '/dict',
      activeRule: '/member',
      entryOrigin: 'http://localhost:8080',
      appKey: 'menu-member',
    })
    expect(props).not.toHaveProperty('theme')
    expect(props).not.toHaveProperty('metadata')
    expect(props).not.toHaveProperty('accessToken')
    expect(JSON.stringify(props)).not.toContain('secret')
  })

  it('omits host fields that were not provided', () => {
    const main = createMainPlatform({ runtimePort: port().runtimePort })
    const props = main.buildPublicProps(context())
    expect(props).not.toHaveProperty('activeRule')
    expect(props).not.toHaveProperty('entryOrigin')
    expect(props.appKey).toBe(props.instanceId)
  })

  it('rejects a blank application, view, or instance id', () => {
    const main = createMainPlatform({ runtimePort: port().runtimePort })
    expect(() => main.buildPublicProps(context({ applicationCode: '  ' }))).toThrow(PlatformError)
    expect(() => main.buildPublicProps(context({ viewId: '' }))).toThrow(PlatformError)
    expect(() => main.buildPublicProps(context({ instanceId: '' }))).toThrow(expect.objectContaining({
      code: 'runtime.main.invalid-context',
    }))
  })

  it('updates only locale and initialRoute and drops theme', async () => {
    const harness = port()
    const main = createMainPlatform({ runtimePort: harness.runtimePort })
    main.buildPublicProps(context())

    await main.updatePublicContext('menu-member', {
      locale: 'en',
      theme: 'light',
      metadata: { accessToken: 'later' },
    })
    await main.notifyLocale('menu-member', 'fr')

    expect(harness.updates).toEqual([
      expect.objectContaining({ locale: 'en', initialRoute: '/dict', appKey: 'menu-member' }),
      expect.objectContaining({ locale: 'fr' }),
    ])
    for (const update of harness.updates) {
      expect(update).not.toHaveProperty('theme')
      expect(update).not.toHaveProperty('metadata')
      expect(JSON.stringify(update)).not.toContain('secret')
      expect(JSON.stringify(update)).not.toContain('later')
    }
  })

  it('emits auth-invalid and directed messages from the public snapshot', async () => {
    const harness = port()
    const main = createMainPlatform({ runtimePort: harness.runtimePort })
    main.buildPublicProps(context())

    await main.notifyAuthInvalid('menu-member', { reason: 'expired' })
    await main.emitToInstance('menu-member', 'g2rain:main-app:token-response', { ok: true })

    expect(harness.messages[0]).toMatchObject({
      type: 'g2rain:sub-app:token-invalid',
      data: { reason: 'expired' },
      applicationCode: 'member',
      viewId: 'menu-member',
      instanceId: 'menu-member',
      appKey: 'menu-member',
    })
    expect(harness.messages[0]?.timestamp).toEqual(expect.any(Number))
    expect(harness.messages[1]).toMatchObject({
      type: 'g2rain:main-app:token-response',
      applicationCode: 'member',
      appKey: 'menu-member',
      data: { ok: true },
    })
    expect(harness.messages.map(message => message.type)).not.toContain('g2rain:main-app:theme-changed')
  })

  it('rejects update and emit before buildPublicProps and does not swallow port errors', async () => {
    const main = createMainPlatform({ runtimePort: port().runtimePort })
    await expect(main.updatePublicContext('missing', { locale: 'en' })).rejects.toMatchObject({
      code: 'runtime.main.missing-snapshot',
    })
    await expect(main.notifyAuthInvalid('missing')).rejects.toBeInstanceOf(PlatformError)

    const failing = createMainPlatform({
      runtimePort: {
        updateInstanceProps: async () => {
          throw new Error('queue failed')
        },
        emit: async () => {
          throw new Error('emit failed')
        },
      },
    })
    failing.buildPublicProps(context())
    await expect(failing.notifyLocale('menu-member', 'en')).rejects.toThrow('queue failed')
    await expect(failing.emitToInstance('menu-member', 'custom', {})).rejects.toThrow('emit failed')
  })

  it('drops one snapshot on release and leaves the other instance', async () => {
    const harness = port()
    const main = createMainPlatform({ runtimePort: harness.runtimePort })
    main.buildPublicProps(context())
    main.buildPublicProps(context({ viewId: 'other', instanceId: 'other' }))

    main.releaseInstance('menu-member')
    main.releaseInstance('menu-member')

    await expect(main.emitToInstance('menu-member', 'custom', { ok: true })).rejects.toMatchObject({
      code: 'runtime.main.missing-snapshot',
    })
    await main.emitToInstance('other', 'custom', { ok: true })
    expect(harness.runtimePort.updateInstanceProps).not.toHaveBeenCalled()
    expect(harness.messages).toEqual([
      expect.objectContaining({ instanceId: 'other', appKey: 'other' }),
    ])
  })
})
