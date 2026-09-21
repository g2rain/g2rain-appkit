import type { App, InjectionKey } from 'vue'
import { inject } from 'vue'

export type G2rainTranslator = (key: string, fallback: string) => string

export interface G2rainUiOptions {
  translate?: G2rainTranslator
  locale?: () => string | undefined
}

export interface G2rainUiContext {
  translate: G2rainTranslator
  locale?: () => string | undefined
}

/** 未安装插件时翻译函数原样返回 fallback，组件仍可渲染。 */
const defaultContext: G2rainUiContext = {
  translate: (_key, fallback) => fallback,
}

export const G2RAIN_UI_CONTEXT: InjectionKey<G2rainUiContext> = Symbol(
  'g2rain-ui-context',
)

export const G2rainUi = {
  install(app: App, options: G2rainUiOptions = {}): void {
    app.provide(G2RAIN_UI_CONTEXT, {
      translate: options.translate ?? defaultContext.translate,
      locale: options.locale,
    })
  },
}

/** 未安装插件时返回只含 fallback 翻译的默认上下文，不要求每个组件都判断注入是否存在。 */
export function useG2rainUi(): G2rainUiContext {
  return inject(G2RAIN_UI_CONTEXT, defaultContext)
}
