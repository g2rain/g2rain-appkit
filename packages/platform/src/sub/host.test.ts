import { describe, expect, it } from 'vitest'
import { createSubDirectedMessage, resolveSubHostProps, type SubHostDefaults, type SubHostProps } from './host.js'

const defaults: SubHostDefaults = {
  applicationCode: 'member',
  contextPath: '/member',
}

function currentProps(patch: SubHostProps = {}): SubHostProps {
  return {
    applicationCode: 'member',
    viewId: 'view-1',
    instanceId: 'inst-1',
    appKey: 'inst-1',
    locale: 'zh-CN',
    initialRoute: '/dict',
    activeRule: '/member',
    entryOrigin: 'http://localhost:3001',
    ...patch,
  }
}

describe('resolveSubHostProps', () => {
  it('maps host props into context without auth fields', () => {
    const resolved = resolveSubHostProps(currentProps(), defaults)

    expect(resolved.instanceId).toBe('inst-1')
    expect(resolved.context).toEqual({
      applicationCode: 'member',
      viewId: 'view-1',
      instanceId: 'inst-1',
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
    expect(resolved).not.toHaveProperty('shell')
    expect(resolved).not.toHaveProperty('auth')
  })

  it('rejects missing instanceId and other invalid identity', () => {
    expect(() => resolveSubHostProps({}, defaults)).toThrow(
      expect.objectContaining({ code: 'runtime.sub.invalid-host' }),
    )
    expect(() =>
      resolveSubHostProps({ appKey: 'menu-member', applicationCode: 'member', viewId: 'view-1' }, defaults),
    ).toThrow(expect.objectContaining({ code: 'runtime.sub.invalid-host' }))
    expect(() =>
      resolveSubHostProps(
        { instanceId: 'inst-1', appKey: 'menu-member', applicationCode: 'member', viewId: 'view-1' },
        defaults,
      ),
    ).toThrow(expect.objectContaining({ code: 'runtime.sub.invalid-host' }))
    expect(() =>
      resolveSubHostProps(
        { instanceId: 'inst-1', appKey: 'inst-1', applicationCode: 'other', viewId: 'view-1' },
        defaults,
      ),
    ).toThrow(expect.objectContaining({ code: 'runtime.sub.invalid-host' }))
    expect(() =>
      resolveSubHostProps(currentProps(), { applicationCode: 'member', contextPath: '  ' }),
    ).toThrow(expect.objectContaining({ code: 'runtime.sub.invalid-host' }))
  })

  it('keeps host fields out of context and limits the update patch', () => {
    const resolved = resolveSubHostProps(
      currentProps({
        locale: undefined,
        initialRoute: '  ',
      }),
      defaults,
    )

    expect(resolved.patch).toEqual({})
    expect(resolved.context).not.toHaveProperty('activeRule')
    expect(resolved.context).not.toHaveProperty('entryOrigin')
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
