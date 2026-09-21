<template>
  <el-switch :model-value="modelValue" :disabled="disabled || loading" :loading="loading"
    :active-value="activeValue" :inactive-value="inactiveValue" :inline-prompt="inlinePrompt"
    :active-text="label(activeValue)" :inactive-text="label(inactiveValue)" @change="change" />
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { ElSwitch } from 'element-plus'
import { useG2rainUi } from '../context'
import { useG2rainPlatformUi } from './provide'
import type { DictLoader } from '../platform-data'
import { useDictOptions } from './useDictOptions'
type StatusValue = string | number | boolean
const props = withDefaults(defineProps<{
  modelValue: StatusValue
  activeValue?: StatusValue
  inactiveValue?: StatusValue
  usageCode?: string
  dictCode?: string
  options?: readonly { label: string; value: StatusValue }[]
  fetchOptions?: DictLoader
  disabled?: boolean
  inlinePrompt?: boolean
  apiMethod?: (params: { nextValue: StatusValue; prevValue: StatusValue }) => Promise<void>
  submit?: (next: StatusValue, previous: StatusValue) => Promise<void>
}>(), { activeValue: 'ACTIVE', inactiveValue: 'INACTIVE', inlinePrompt: true })
const emit = defineEmits<{
  'update:modelValue': [value: StatusValue]
  change: [value: StatusValue]
  success: [payload: { nextValue: StatusValue; prevValue: StatusValue }]
  error: [payload: { nextValue: StatusValue; prevValue: StatusValue; error: unknown }]
  'load-error': [error: unknown]
}>()
const ui = useG2rainUi()
const platform = useG2rainPlatformUi()
const loading = ref(false)
let disposed = false
onBeforeUnmount(() => { disposed = true })
const { items } = useDictOptions(() => ({
  options: props.options?.map(item => ({ code: item.value, name: item.label })),
  loader: props.fetchOptions ?? platform.dataProviders?.dict?.loadOptions,
  params: { usageCode: props.usageCode, dictCode: props.dictCode, locale: ui.locale?.() },
  enabled: Boolean(props.usageCode || props.dictCode),
}), error => emit('load-error', error))
function label(value: StatusValue) {
  const hit = items.value.find(item => String(item.code) === String(value))
  return String(hit?.name ?? (value === 'ACTIVE' ? ui.translate('G2_OPT_ACTIVE', '有效') : value === 'INACTIVE' ? ui.translate('G2_OPT_INACTIVE', '无效') : value))
}
/** 请求成功后才改 v-model。期间外部已改值，或组件已卸载，则不再回写，避免覆盖更新的状态。 */
async function change(nextValue: StatusValue) {
  if (props.disabled || loading.value || nextValue === props.modelValue) return
  const prevValue = props.modelValue
  loading.value = true
  try {
    if (props.submit) await props.submit(nextValue, prevValue)
    else await props.apiMethod?.({ nextValue, prevValue })
    if (disposed || props.modelValue !== prevValue) return
    emit('update:modelValue', nextValue)
    emit('change', nextValue)
    emit('success', { nextValue, prevValue })
  } catch (error) { if (!disposed) emit('error', { nextValue, prevValue, error }) }
  finally { loading.value = false }
}
</script>
