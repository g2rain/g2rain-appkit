import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import { createVueI18nEngine } from './vue-i18n.js'

describe('createVueI18nEngine', () => {
  it('reads and writes the vue-i18n locale', () => {
    const i18n = createI18n({
      legacy: false,
      locale: 'zh-CN',
      messages: {
        'zh-CN': { hello: '你好' },
        'en-US': { hello: 'Hello' },
      },
    })
    const engine = createVueI18nEngine(i18n)

    expect(engine.getLocale()).toBe('zh-CN')
    expect(engine.translate('hello')).toBe('你好')
    engine.setLocale('en-US')
    expect(engine.getLocale()).toBe('en-US')
    expect(engine.translate('hello')).toBe('Hello')
  })
})
