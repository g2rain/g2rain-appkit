import { PlatformError } from '../contract/error.js'

/**
 * 可嵌套的释放域。add 返回取消登记的函数；dispose 按登记的逆序执行，并收集全部失败。
 * child() 把子域的 dispose 登记到父域，父域释放时子域一并释放。
 */
export interface RuntimeScope {
  add(dispose: () => void | Promise<void>): () => void
  child(): RuntimeScope
  dispose(): Promise<void>
  readonly disposed: boolean
}

interface ScopeEntry {
  dispose: () => void | Promise<void>
}

/** 已释放的 Scope 拒绝再登记。重复 dispose 是空操作，多条清理失败会合成 runtime.aggregate。 */
export function createRuntimeScope(): RuntimeScope {
  const entries: ScopeEntry[] = []
  let disposed = false

  const scope: RuntimeScope = {
    get disposed() {
      return disposed
    },
    add(dispose) {
      if (disposed) {
        throw new PlatformError({
          code: 'runtime.scope.disposed',
          phase: 'dispose',
          message: 'Cannot register a disposer on a disposed scope.',
        })
      }
      const entry: ScopeEntry = { dispose }
      entries.push(entry)
      let removed = false
      return () => {
        if (removed) return
        removed = true
        const index = entries.indexOf(entry)
        if (index >= 0) entries.splice(index, 1)
      }
    },
    child() {
      const child = createRuntimeScope()
      scope.add(() => child.dispose())
      return child
    },
    async dispose() {
      if (disposed) return
      disposed = true
      const pending = entries.splice(0).reverse()
      const errors: unknown[] = []
      for (const entry of pending) {
        try {
          await entry.dispose()
        } catch (error) {
          errors.push(error)
        }
      }
      if (errors.length === 1) {
        throw errors[0]
      }
      if (errors.length > 1) {
        throw new PlatformError({
          code: 'runtime.aggregate',
          phase: 'dispose',
          message: 'Scope dispose failed.',
          cause: errors[0],
          errors,
        })
      }
    },
  }

  return scope
}
