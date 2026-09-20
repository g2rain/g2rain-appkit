import { createApp, defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createPermissionPlugin, usePermission } from './vue.js'

describe('permission vue binding', () => {
  it('uses a secure deny-all fallback when no plugin is installed', () => {
    const result = vi.fn()
    const app = createApp(defineComponent({
      setup() {
        const provider = usePermission()
        result(provider.hasApiPermission('/users', 'GET'), provider.getPageElementStatus('user.create'))
        return () => h('div')
      },
    }))
    app.mount(document.createElement('div'))
    expect(result).toHaveBeenCalledWith(false, undefined)
    app.unmount()
  })

  it('exposes the consuming application provider through usePermission', () => {
    const result = vi.fn()
    const app = createApp(defineComponent({
      setup() {
        result(usePermission().hasPageElementPermission('user.create'))
        return () => h('div')
      },
    }))
    app.use(createPermissionPlugin({
      provider: {
        hasPageElementPermission: code => code === 'user.create',
        getPageElementStatus: () => 'ENABLED',
        hasApiPermission: () => true,
      },
    }))
    app.mount(document.createElement('div'))
    expect(result).toHaveBeenCalledWith(true)
    app.unmount()
  })
})
