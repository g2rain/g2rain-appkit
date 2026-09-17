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
