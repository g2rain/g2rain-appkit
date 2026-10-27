<template>
  <RemoteSelect
    :key="usageCode ?? ''"
    v-model="innerValue"
    :fetch-data="fetchData"
    :value-key="valueKey"
    :label-key="labelKey"
    :placeholder="resolvedPlaceholder"
    :clearable="clearable"
    :disabled="disabled"
    :width="width"
    :debounce-delay="debounceDelay"
    :prefetch-on-open="Boolean(usageCode)"
    @change="handleChange"
    @clear="emit('clear')"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useG2rainUi } from '../context'
import { useG2rainPlatformUi } from '../platform/provide'
import RemoteSelect from './RemoteSelect.vue'
import type {
  FetchDataFunction,
  RemoteSelectFetchParams,
  RemoteSelectOption,
  RemoteSelectValue,
} from './types'

defineOptions({ name: 'G2DictSelect' })

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    usageCode?: string
    apiMethod?: (
      params: RemoteSelectFetchParams & { usageCode?: string },
    ) => Promise<readonly RemoteSelectOption[]>
    valueKey?: string
    labelKey?: string
    placeholder?: string
    clearable?: boolean
    disabled?: boolean
    width?: string
    debounceDelay?: number
  }>(),
  {
    modelValue: undefined,
    usageCode: undefined,
    apiMethod: undefined,
    valueKey: 'code',
    labelKey: 'name',
    placeholder: undefined,
    clearable: true,
    disabled: false,
    width: '200px',
    debounceDelay: 300,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | null | undefined]
  change: [value: string | null | undefined]
  clear: []
}>()

const { translate, locale } = useG2rainUi()
const platform = useG2rainPlatformUi()
const resolvedPlaceholder = computed(
  () => props.placeholder ?? translate('G2_PH_DICT_ITEM', '请选择字典项'),
)

function normalize(value: RemoteSelectValue): string | null | undefined {
  return value === null || value === undefined ? value : String(value)
}

const innerValue = computed({
  get: () => props.modelValue,
  set: (value: RemoteSelectValue) => emit('update:modelValue', normalize(value)),
})

/**
 * 字典按名称关键字搜索：纯数字也当作关键字，不按 value 查。
 * 没有 usageCode 且没有关键字时不请求，避免拉全量字典。
 * 显式 apiMethod 优先；否则走 dataProviders.dict。
 */
const fetchData: FetchDataFunction = async (params) => {
  const key = params.key ?? (params.value !== undefined ? String(params.value) : undefined)
  if (!props.usageCode && !key) return []
  if (props.apiMethod) {
    return props.apiMethod({ key, signal: params.signal, usageCode: props.usageCode })
  }
  const loadOptions = platform.dataProviders?.dict?.loadOptions
  if (!loadOptions) {
    platform.onMissingProvider?.('dict')
    return []
  }
  return loadOptions({
    usageCode: props.usageCode,
    key,
    signal: params.signal,
    locale: locale?.(),
  })
}

function handleChange(value: RemoteSelectValue): void {
  emit('change', normalize(value))
}
</script>

