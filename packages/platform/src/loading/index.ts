import type { RuntimeCapability } from '../sub/types.js'
import type { RuntimeScope } from '../kernel/scope.js'

export interface LoadingController {
  begin(key?: string): () => void
  readonly activeCount: number
  dispose(): void
}

export interface LoadingHandle {
  close(): void
}

/**
 * 引用计数的 Loading。第一次 begin 才打开界面，最后一次 end 才关闭。
 * 返回的结束函数可以重复调用。dispose 之后 begin 返回空操作。
 * key 目前被忽略，计数是全局的，不是按 key 分开。
 */
export function createLoadingController(options: { open(): LoadingHandle }): LoadingController {
  let activeCount = 0
  let currentHandle: LoadingHandle | undefined
  let disposed = false

  const close = (): void => {
    currentHandle?.close()
    currentHandle = undefined
  }

  return {
    begin() {
      if (disposed) return () => undefined
      activeCount += 1
      if (activeCount === 1) currentHandle = options.open()
      let ended = false
      return () => {
        if (ended) return
        ended = true
        activeCount = Math.max(0, activeCount - 1)
        if (activeCount === 0) close()
      }
    },
    get activeCount() {
      return activeCount
    },
    dispose() {
      disposed = true
      activeCount = 0
      close()
    },
  }
}

export interface LoadingCapability extends RuntimeCapability {
  begin(instanceId: string, key?: string): () => void
}

/**
 * 按 instanceId 隔离的 Loading。begin 把结束函数登记到该实例 Scope，
 * 实例卸载时尚未结束的 Loading 会关掉。未挂载或 Scope 已释放时 begin 返回空操作。
 */
export function createLoadingCapability(options: { open(): LoadingHandle }): LoadingCapability {
  const instances = new Map<string, { controller: LoadingController; scope: RuntimeScope }>()

  return {
    id: 'loading',
    mount(input) {
      const controller = createLoadingController({ open: options.open })
      const instanceId = input.context.instanceId
      instances.set(instanceId, { controller, scope: input.scope })
      input.scope.add(() => {
        instances.delete(instanceId)
        controller.dispose()
      })
    },
    begin(instanceId, key) {
      const current = instances.get(instanceId)
      if (!current || current.scope.disposed) return () => undefined
      const end = current.controller.begin(key)
      const remove = current.scope.add(end)
      return () => {
        end()
        remove()
      }
    },
  }
}
