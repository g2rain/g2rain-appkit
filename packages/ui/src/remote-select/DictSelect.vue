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
    prefetch-on-open
    @change="handleChange"
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

defineOptions({ name: 'G2DictSelect' })

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    usageCode?: string
    apiMethod: (
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

const { translate } = useG2rainUi()
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

const fetchData: FetchDataFunction = (params) =>
  props.apiMethod({ ...params, usageCode: props.usageCode })

function handleChange(value: RemoteSelectValue): void {
  emit('change', normalize(value))
}
</script>

