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

export interface LoadingOptions {
  open(): LoadingHandle
  /** 超过这个时长仍未结束才显示，短请求不闪遮罩；默认 200ms */
  delay?: number
  /** 显示后至少保持的时长，避免一闪而过；默认 300ms */
  minDuration?: number
}

/**
 * 引用计数的 Loading。第一次 begin 后延迟 delay 才打开，最后一次 end 才关闭；
 * 已显示时至少保持 minDuration。结束函数可以重复调用，dispose 之后 begin 返回空操作。
 * key 目前被忽略，计数是全局的，不是按 key 分开。
 */
export function createLoadingController(options: LoadingOptions): LoadingController {
  const delay = options.delay ?? 200
  const minDuration = options.minDuration ?? 300
  let activeCount = 0
  let handle: LoadingHandle | undefined
  let openedAt = 0
  let openTimer: ReturnType<typeof setTimeout> | undefined
  let closeTimer: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  const show = (): void => {
    openTimer = undefined
    handle = options.open()
    openedAt = Date.now()
  }
  const hide = (): void => {
    closeTimer = undefined
    handle?.close()
    handle = undefined
  }

  /** 按当前计数决定打开、保持或关闭遮罩 */
  const settle = (): void => {
    if (activeCount > 0) {
      if (closeTimer) {
        clearTimeout(closeTimer)
        closeTimer = undefined
      }
      if (handle || openTimer) return
      if (delay > 0) openTimer = setTimeout(show, delay)
      else show()
      return
    }
    if (openTimer) {
      clearTimeout(openTimer)
      openTimer = undefined
    }
    if (!handle || closeTimer) return
    const rest = minDuration - (Date.now() - openedAt)
    if (rest > 0) closeTimer = setTimeout(hide, rest)
    else hide()
  }

  return {
    begin() {
      if (disposed) return () => undefined
      activeCount += 1
      settle()
      let ended = false
      return () => {
        if (ended || disposed) return
        ended = true
        activeCount = Math.max(0, activeCount - 1)
        settle()
      }
    },
    get activeCount() {
      return activeCount
    },
    dispose() {
      disposed = true
      activeCount = 0
      if (openTimer) clearTimeout(openTimer)
      if (closeTimer) clearTimeout(closeTimer)
      openTimer = undefined
      hide()
    },
  }
}

export interface LoadingCapability extends RuntimeCapability {
  begin(instanceId: string, key?: string): () => void
}

/**
 * 所有实例共用一个计数：全屏遮罩只有一个，各实例分开计数会让一个实例结束时关掉别的实例还在用的遮罩。
 * begin 把结束函数登记到该实例 Scope，实例卸载时它尚未结束的 Loading 一并结束。
 * 未挂载或 Scope 已释放时 begin 返回空操作。
 */
export function createLoadingCapability(options: LoadingOptions): LoadingCapability {
  const controller = createLoadingController(options)
  const scopes = new Map<string, RuntimeScope>()

  return {
    id: 'loading',
    mount(input) {
      const instanceId = input.context.instanceId
      scopes.set(instanceId, input.scope)
      input.scope.add(() => {
        scopes.delete(instanceId)
      })
    },
    begin(instanceId, key) {
      const scope = scopes.get(instanceId)
      if (!scope || scope.disposed) return () => undefined
      const end = controller.begin(key)
      const remove = scope.add(end)
      return () => {
        end()
        remove()
      }
    },
  }
}
