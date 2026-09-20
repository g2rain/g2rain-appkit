export interface RuntimeMessage<T = unknown> {
  type: string
  data: T
  applicationCode?: string
  viewId?: string
  instanceId?: string
  requestId?: string
  timestamp: number
}
