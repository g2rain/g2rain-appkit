import { createApp, defineComponent, h, resolveDirective, withDirectives } from 'vue'
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

  it('applies element status through v-permission', () => {
    const statuses: Record<string, 'VISIBLE' | 'ENABLED' | undefined> = { add: 'ENABLED', edit: 'VISIBLE' }
    const app = createApp(defineComponent({
      render: () => h('div', [
        withDirectives(h('button', { id: 'add' }), [[resolveDirective('permission')!, 'add']]),
        withDirectives(h('button', { id: 'edit' }), [[resolveDirective('permission')!, 'edit']]),
        withDirectives(h('span', { id: 'remove' }), [[resolveDirective('permission')!, 'remove']]),
        withDirectives(h('span', { id: 'view' }), [[resolveDirective('permission')!, 'edit']]),
      ]),
    }))
    app.use(createPermissionPlugin({
      provider: {
        hasPageElementPermission: code => code in statuses,
        getPageElementStatus: code => statuses[code],
        hasApiPermission: () => true,
      },
    }))
    const root = document.createElement('div')
    app.mount(root)
    expect(root.querySelector('#add')?.hasAttribute('disabled')).toBe(false)
    expect(root.querySelector('#edit')?.getAttribute('disabled')).toBe('disabled')
    expect((root.querySelector('#remove') as HTMLElement).style.display).toBe('none')
    expect((root.querySelector('#view') as HTMLElement).style.pointerEvents).toBe('none')
    app.unmount()
  })
})
