import { describe, expect, it } from 'vitest'
import { createSubDirectedMessage, resolveSubHostProps, type SubHostDefaults, type SubHostProps } from './host.js'

const defaults: SubHostDefaults = {
  applicationCode: 'member',
  contextPath: '/member',
}

function legacyProps(patch: SubHostProps = {}): SubHostProps {
  return {
    appKey: 'menu-member',
    locale: 'zh-CN',
    initialRoute: '/dict',
    activeRule: '/member',
    entryOrigin: 'http://localhost:3001',
    token: 'secret-token',
    tokenKid: 'kid-1',
    client: { clientId: 'member', privateKey: 'do-not-keep' },
    theme: 'dark',
    metadata: { accessToken: 'secret-token' },
    mainAppInfo: { name: '主应用' },
    paths: ['/dict'],
    ...patch,
  }
}

describe('resolveSubHostProps', () => {
  it('maps a legacy shell onto one context and keeps auth beside it', () => {
    const resolved = resolveSubHostProps(legacyProps(), defaults)

    expect(resolved.shell).toBe('legacy')
    expect(resolved.instanceId).toBe('menu-member')
    expect(resolved.context).toEqual({
      applicationCode: 'member',
      viewId: 'menu-member',
      instanceId: 'menu-member',
      mode: 'integrated',
      contextPath: '/member',
      locale: 'zh-CN',
      initialRoute: '/dict',
    })
    expect(resolved.patch).toEqual({ locale: 'zh-CN', initialRoute: '/dict' })
    expect(resolved.host).toEqual({
      activeRule: '/member',
      entryOrigin: 'http://localhost:3001',
    })
    expect(resolved.auth).toEqual({
      token: 'secret-token',
      tokenKid: 'kid-1',
      client: { clientId: 'member', privateKey: 'do-not-keep' },
    })
    expect(resolved.context).not.toHaveProperty('theme')
    expect(resolved.context).not.toHaveProperty('metadata')
    expect(JSON.stringify(resolved.context)).not.toContain('secret-token')
    expect(JSON.stringify(resolved.context)).not.toContain('do-not-keep')
    expect(JSON.stringify(resolved.host)).not.toContain('secret-token')
  })

  it('lets a legacy viewId override the tab key without changing instanceId', () => {
    const resolved = resolveSubHostProps(legacyProps({ viewId: 'view-1', token: undefined, tokenKid: undefined, client: undefined }), defaults)

    expect(resolved.instanceId).toBe('menu-member')
    expect(resolved.context.viewId).toBe('view-1')
    expect(resolved.auth).toBeUndefined()
  })

  it('maps current shell props and drops any token', () => {
    const resolved = resolveSubHostProps(
      {
        applicationCode: 'member',
        viewId: 'view-1',
        instanceId: 'inst-1',
        appKey: 'inst-1',
        locale: 'en-US',
        initialRoute: '/organ',
        activeRule: '/member',
        entryOrigin: 'http://localhost:3001',
        token: 'secret-token',
        tokenKid: 'kid-1',
        client: { privateKey: 'do-not-keep' },
        theme: 'dark',
        metadata: { accessToken: 'secret-token' },
      },
      defaults,
    )

    expect(resolved.shell).toBe('current')
    expect(resolved.instanceId).toBe('inst-1')
    expect(resolved.context).toEqual({
      applicationCode: 'member',
      viewId: 'view-1',
      instanceId: 'inst-1',
      mode: 'integrated',
      contextPath: '/member',
      locale: 'en-US',
      initialRoute: '/organ',
    })
    expect(resolved.auth).toBeUndefined()
    expect(resolved.host).toEqual({
      activeRule: '/member',
      entryOrigin: 'http://localhost:3001',
    })
    expect(JSON.stringify(resolved)).not.toContain('secret-token')
    expect(JSON.stringify(resolved)).not.toContain('do-not-keep')
  })

  it('rejects a missing identity, a mixed shell, and a blank default', () => {
    expect(() => resolveSubHostProps({}, defaults)).toThrow(
      expect.objectContaining({ code: 'runtime.sub.invalid-host' }),
    )
    expect(() =>
      resolveSubHostProps({ instanceId: 'inst-1', appKey: 'menu-member', applicationCode: 'member', viewId: 'view-1' }, defaults),
    ).toThrow(expect.objectContaining({ code: 'runtime.sub.invalid-host' }))
    expect(() =>
      resolveSubHostProps(
        { instanceId: 'inst-1', appKey: 'inst-1', applicationCode: 'other', viewId: 'view-1' },
        defaults,
      ),
    ).toThrow(expect.objectContaining({ code: 'runtime.sub.invalid-host' }))
    expect(() => resolveSubHostProps(legacyProps(), { applicationCode: 'member', contextPath: '  ' })).toThrow(
      expect.objectContaining({ code: 'runtime.sub.invalid-host' }),
    )
  })

  it('rejects a partial token without echoing the secret', () => {
    expect(() => resolveSubHostProps(legacyProps({ tokenKid: undefined }), defaults)).toThrow(
      expect.objectContaining({
        code: 'runtime.sub.partial-auth',
        message: 'Host auth requires both token and tokenKid.',
      }),
    )
    expect(() =>
      resolveSubHostProps(
        {
          applicationCode: 'member',
          viewId: 'view-1',
          instanceId: 'inst-1',
          appKey: 'inst-1',
          token: 'secret-token',
        },
        defaults,
      ),
    ).toThrow(expect.objectContaining({ code: 'runtime.sub.partial-auth' }))
  })

  it('keeps host fields out of context and limits the update patch', () => {
    const resolved = resolveSubHostProps(
      legacyProps({
        locale: undefined,
        initialRoute: '  ',
        theme: 'light',
        metadata: { ignored: true },
      }),
      defaults,
    )

    expect(resolved.patch).toEqual({})
    expect(resolved.context).not.toHaveProperty('activeRule')
    expect(resolved.context).not.toHaveProperty('entryOrigin')
    expect(resolved.context).not.toHaveProperty('theme')
    expect(resolved.context).not.toHaveProperty('metadata')
    expect(Object.keys(resolved.patch)).toEqual([])
  })
})

describe('createSubDirectedMessage', () => {
  it('sets appKey to instanceId and leaves data unchanged', () => {
    const message = createSubDirectedMessage(
      { applicationCode: 'member', viewId: 'menu-member', instanceId: 'menu-member' },
      'g2rain:sub-app:route-change',
      { appKey: 'menu-member', path: '/dict', token: 'not-inspected' },
      100,
    )

    expect(message).toEqual({
      type: 'g2rain:sub-app:route-change',
      data: { appKey: 'menu-member', path: '/dict', token: 'not-inspected' },
      applicationCode: 'member',
      viewId: 'menu-member',
      instanceId: 'menu-member',
      appKey: 'menu-member',
      timestamp: 100,
    })
  })
})
