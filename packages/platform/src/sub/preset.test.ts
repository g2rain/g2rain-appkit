import { describe, expect, it, vi } from 'vitest'
import { createErrorCapability } from '../error/index.js'
import { createSubPlatform } from './index.js'
import { createStandardSubPlatform } from './preset.js'

describe('createStandardSubPlatform', () => {
  it('runs i18n before capabilities that depend on error', async () => {
    const order: string[] = []
    const platform = createStandardSubPlatform({
      applicationCode: 'member',
      createApplication: () => ({
        mount() {
          return undefined
        },
        unmount() {
          return undefined
        },
      }),
      i18n: {
        engine: {
          getLocale: () => 'zh-CN',
          setLocale() {
            order.push('i18n')
          },
          translate: key => key,
        },
      },
      error: {},
      capabilities: [{
        id: 'probe',
        dependsOn: ['error'],
        mount() {
          order.push('probe')
        },
      }],
    })

    await platform.mount({
      instanceId: 'inst',
      container: document.createElement('div'),
      context: {
        applicationCode: 'member',
        viewId: 'view',
        instanceId: 'inst',
        mode: 'integrated',
        contextPath: '/member',
        locale: 'zh-CN',
      },
    })

    expect(order).toEqual(['i18n', 'probe'])
  })

  it('rejects an error capability that translates without i18n', async () => {
    expect(() => createSubPlatform({
      applicationCode: 'member',
      createApplication: () => ({
        mount() {
          return undefined
        },
        unmount() {
          return undefined
        },
      }),
      capabilities: [createErrorCapability({ translate: () => 'text' })],
    })).toThrow(expect.objectContaining({ code: 'runtime.capability.missing-dependency' }))
  })

  it('keeps an explicit error.translate instead of overriding with the i18n engine', async () => {
    const custom = vi.fn((key: string) => `custom:${key}`)
    const engine = vi.fn((key: string) => `engine:${key}`)
    const presenter = vi.fn()
    const platform = createStandardSubPlatform({
      applicationCode: 'member',
      createApplication: () => ({
        mount() { return undefined },
        unmount() { return undefined },
      }),
      i18n: {
        engine: {
          getLocale: () => 'zh-CN',
          setLocale() { return undefined },
          translate: engine,
        },
      },
      error: {
        translate: custom,
        presenter: { present: presenter },
        policy: { resolve: () => ({ messageKey: 'ERR_X' }) },
      },
    })
    await platform.handleError(new Error('raw'))
    expect(custom).toHaveBeenCalledWith('ERR_X')
    expect(engine).not.toHaveBeenCalled()
    expect(presenter).toHaveBeenCalledWith(expect.anything(), 'custom:ERR_X')
  })
})
