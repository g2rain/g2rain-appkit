import { ref, watchEffect } from 'vue'
import { useG2rainPlatformUi } from './provide'
import type { DictLoader, DictQuery } from '../platform-data'
import type { RemoteSelectOption } from '../remote-select/types'

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
