<template>
  <RemoteSelect
    v-model="innerValue"
    :fetch-data="fetchData"
    :value-key="valueKey"
    :label-key="labelKey"
    :placeholder="resolvedPlaceholder"
    :clearable="clearable"
    :disabled="disabled"
    :width="width"
    :debounce-delay="debounceDelay"
    :prefetch-on-open="prefetchOnOpen"
    @change="emit('change', $event)"
    @clear="emit('clear')"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useG2rainUi } from '../context'
import RemoteSelect from './RemoteSelect.vue'
import type {
  FetchDataFunction,
  RemoteSelectFetchParams,
  RemoteSelectOption,
  RemoteSelectValue,
} from './types'

defineOptions({ name: 'G2ApiSelect' })

const props = withDefaults(
  defineProps<{
    modelValue?: RemoteSelectValue
    apiMethod: (params: RemoteSelectFetchParams) => Promise<readonly RemoteSelectOption[]>
    valueKey?: string
    labelKey?: string
    placeholder?: string
    clearable?: boolean
    disabled?: boolean
    width?: string
    debounceDelay?: number
    allowEmptyKeyword?: boolean
    prefetchOnOpen?: boolean
  }>(),
  {
    modelValue: undefined,
    valueKey: 'id',
    labelKey: 'name',
    placeholder: undefined,
    clearable: true,
    disabled: false,
    width: '200px',
    debounceDelay: 300,
    allowEmptyKeyword: false,
    prefetchOnOpen: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: RemoteSelectValue]
  change: [value: RemoteSelectValue]
  clear: []
}>()

const { translate } = useG2rainUi()
const resolvedPlaceholder = computed(
  () => props.placeholder ?? translate('G2_PH_SELECT', '请选择'),
)
const innerValue = computed({
  get: () => props.modelValue,
  set: (value: RemoteSelectValue) => emit('update:modelValue', value),
})

const fetchData: FetchDataFunction = async (params) => {
  const hasQuery = Boolean(params.key?.trim()) || params.value !== undefined
  if (!hasQuery && !props.allowEmptyKeyword && !props.prefetchOnOpen) return []
  return props.apiMethod(params)
}
</script>

