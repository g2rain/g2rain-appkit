/** 主子应用消息的最小信封。定向字段可选，缺省表示不是发往单个实例。 */
export interface RuntimeMessage<T = unknown> {
  type: string
  data: T
  applicationCode?: string
  viewId?: string
  instanceId?: string
  requestId?: string
  timestamp: number
}
