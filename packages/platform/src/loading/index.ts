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
