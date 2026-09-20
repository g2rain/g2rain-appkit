export type RuntimeMode = 'standalone' | 'integrated'

export type G2rainTheme = 'light' | 'dark'

export interface RuntimeContext {
  /** 实际子应用稳定标识 */
  applicationCode: string
  /** Main Shell 工作区页面视图标识 */
  viewId: string
  /** Main Shell RuntimeInstance 的唯一实例键 */
  instanceId: string
  mode: RuntimeMode
  contextPath: string
  locale?: string
  theme?: G2rainTheme
  initialRoute?: string
  metadata?: Readonly<Record<string, unknown>>
}

export type RuntimeContextUpdate = Partial<
  Pick<RuntimeContext, 'locale' | 'theme' | 'initialRoute' | 'metadata'>
>
