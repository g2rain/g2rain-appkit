export type RuntimeMode = 'standalone' | 'integrated'

export type G2rainTheme = 'light' | 'dark'

export interface RuntimeContext {
  /** 实际子应用稳定标识 */
  applicationCode: string
  /** Main Shell 工作区页面视图标识 */
  viewId: string
  /** Main Shell RuntimeInstance 的唯一实例键 */
  instanceId: string
  /** standalone 由应用自己管主题等宿主状态；integrated 表示运行在 Main Shell 中。 */
  mode: RuntimeMode
  /** 应用路由前缀，不随单次 update 改变。 */
  contextPath: string
  locale?: string
  theme?: G2rainTheme
  initialRoute?: string
  metadata?: Readonly<Record<string, unknown>>
}

export type RuntimeContextUpdate = Partial<
  Pick<RuntimeContext, 'locale' | 'theme' | 'initialRoute' | 'metadata'>
>
