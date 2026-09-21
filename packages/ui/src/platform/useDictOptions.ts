import { ref, watchEffect } from 'vue'
import { useG2rainPlatformUi } from './provide'
import type { DictLoader, DictQuery } from '../platform-data'
import type { RemoteSelectOption } from '../remote-select/types'

/**
 * 字典选项。调用方已经传入 options 时直接使用，不再请求。
 * loader、查询条件或 enabled 变化会作废上一次请求，避免旧响应覆盖新结果。
 * 没有 loader 时通知 onMissingProvider，不抛出异常。
 */
export function useDictOptions(source: () => {
  options?: readonly RemoteSelectOption[]
  loader?: DictLoader
  params: DictQuery
  enabled: boolean
}, onError: (error: unknown) => void) {
  const items = ref<readonly RemoteSelectOption[]>([])
  const platform = useG2rainPlatformUi()
  const loading = ref(false)
  watchEffect(onCleanup => {
    const state = source()
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    items.value = state.options ?? []
    loading.value = false
    if (state.options !== undefined || !state.enabled) return
    if (!state.loader) {
      platform.onMissingProvider?.('dict')
      return
    }
    loading.value = true
    Promise.resolve().then(() => state.loader!({ ...state.params, signal: controller.signal }))
      .then(result => { if (!controller.signal.aborted) items.value = result })
      .catch(error => { if (!controller.signal.aborted) onError(error) })
      .finally(() => { if (!controller.signal.aborted) loading.value = false })
  })
  return { items, loading }
}
