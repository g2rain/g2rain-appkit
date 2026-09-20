<template>
  <RemoteSelect ref="select" :key="dataVersion" :model-value="modelValue" :fetch-data="fetchData"
    :value-key="valueKey" :label-key="labelKey" :placeholder="placeholder ?? ui.translate('G2_PH_ORGAN', '请选择所属机构')"
    :clearable="clearable ?? policy.clearable ?? true" :auto-select-first-when-empty="autoSelectFirstWhenEmpty ?? policy.autoSelectFirstWhenEmpty ?? false"
    :disabled="disabled" :width="width" :debounce-delay="debounceDelay" :prefetch-on-open="prefetchOnOpen"
    @update:model-value="emit('update:modelValue', normalize($event))" @change="emit('change', normalize($event))" @clear="emit('clear')" />
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import RemoteSelect from '../remote-select/RemoteSelect.vue'
import type { RemoteSelectExpose, RemoteSelectValue } from '../remote-select/types'
import type { EntityDataProvider } from '../platform-data'
import { useG2rainUi } from '../context'
import { useG2rainPlatformUi } from './provide'
const props = withDefaults(defineProps<{
  modelValue?: number | null
  apiMethod?: EntityDataProvider['loadOptions']
  query?: Readonly<Record<string, unknown>>
  defaultValue?: number | null
  clearable?: boolean
  autoSelectFirstWhenEmpty?: boolean
  valueKey?: string
  labelKey?: string
  placeholder?: string
  disabled?: boolean
  width?: string
  debounceDelay?: number
  prefetchOnOpen?: boolean
}>(), { clearable: undefined, autoSelectFirstWhenEmpty: undefined, valueKey: 'organId', labelKey: 'organName', width: '200px', debounceDelay: 300, prefetchOnOpen: true })
const emit = defineEmits<{ 'update:modelValue': [value: number | null | undefined]; change: [value: number | null | undefined]; clear: []; error: [error: unknown] }>()
const ui = useG2rainUi()
const platform = useG2rainPlatformUi()
const select = ref<RemoteSelectExpose>()
const dataVersion = ref(0)
watch(() => [props.apiMethod, props.query, ui.locale?.(), platform.dataProviders?.organ?.loadOptions], () => { dataVersion.value++ }, { deep: true })
const policy = computed(() => platform.dataProviders?.organ?.getPolicy?.() ?? {})
const normalize = (value: RemoteSelectValue) => value == null ? value : Number.isFinite(Number(value)) ? Number(value) : null
watch(() => [props.modelValue, props.defaultValue ?? policy.value.defaultValue] as const, ([current, fallback]) => {
  if (current == null && fallback != null) { emit('update:modelValue', fallback); emit('change', fallback) }
}, { immediate: true })
const fetchData: EntityDataProvider['loadOptions'] = async params => {
  const loader = props.apiMethod ?? platform.dataProviders?.organ?.loadOptions
  if (!loader) {
    platform.onMissingProvider?.('organ')
    return []
  }
  try { return await loader({ ...params, query: props.query, locale: ui.locale?.() }) }
  catch (error) { if (!params.signal?.aborted) emit('error', error); return [] }
}
defineExpose({ focus: () => select.value?.focus(), openDropdown: () => select.value?.openDropdown() })
</script>
