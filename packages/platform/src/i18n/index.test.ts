import { describe, expect, it, vi } from 'vitest'
import type { RuntimeContext } from '../contract/context.js'
import { createRuntimeScope } from '../kernel/scope.js'
import { createI18nCapability, type I18nEngineAdapter } from './index.js'

function context(locale?: string): RuntimeContext {
  return {
    applicationCode: 'member',
    viewId: 'view',
    instanceId: 'inst',
    mode: 'integrated',
    contextPath: '/member',
    locale,
  }
}

function engine(): I18nEngineAdapter & { locales: string[] } {
  const locales: string[] = []
  let current = ''
  return {
    locales,
    getLocale: () => current,
    setLocale(locale) {
      current = locale
      locales.push(locale)
    },
    translate: key => key,
  }
}

describe('createI18nCapability', () => {
  it('applies locale on mount and restores the previous locale on rollback', async () => {
    const i18n = engine()
    const ui = { applyLocale: vi.fn() }
    const capability = createI18nCapability({ engine: i18n, uiLocale: ui })
    const scope = createRuntimeScope()
    const mounted = context('zh-CN')
    const next = context('en-US')

    await capability.mount?.({ context: mounted, container: document.createElement('div'), scope })
    await capability.update?.({ context: next, previous: mounted, scope })
    await capability.rollbackUpdate?.({ context: next, previous: mounted, scope })

    expect(i18n.locales).toEqual(['zh-CN', 'en-US', 'zh-CN'])
    expect(ui.applyLocale.mock.calls.map(call => call[0])).toEqual(['zh-CN', 'en-US', 'zh-CN'])
  })
})
