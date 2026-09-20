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

export function useG2rainUi(): G2rainUiContext {
  return inject(G2RAIN_UI_CONTEXT, defaultContext)
}
