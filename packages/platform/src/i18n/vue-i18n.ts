import type { I18n } from 'vue-i18n'
import type { I18nEngineAdapter } from './index.js'

export function createVueI18nEngine<
  Messages extends Record<string, unknown>,
  DateTimeFormats extends Record<string, unknown>,
  NumberFormats extends Record<string, unknown>,
  OptionLocale extends string,
  Legacy extends boolean,
>(
  i18n: I18n<Messages, DateTimeFormats, NumberFormats, OptionLocale, Legacy>,
): I18nEngineAdapter {
  const global = i18n.global as {
    locale: string | { value: string }
    t: (key: string, named?: Record<string, unknown>) => unknown
  }
  return {
    getLocale() {
      return typeof global.locale === 'string' ? global.locale : global.locale.value
    },
    setLocale(next) {
      if (typeof global.locale === 'string') {
        global.locale = next
        return
      }
      global.locale.value = next
    },
    translate(key, params) {
      const result = global.t(key, params ? { ...params } : undefined)
      return typeof result === 'string' ? result : String(result)
    },
  }
}
