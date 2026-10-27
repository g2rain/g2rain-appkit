<template>
  <el-switch :model-value="modelValue" :disabled="disabled || loading || !permitted" :loading="loading"
    :active-value="activeValue" :inactive-value="inactiveValue" :inline-prompt="inlinePrompt"
    :active-text="label(activeValue)" :inactive-text="label(inactiveValue)" @change="change" />
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
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
  /** 页面元素权限码；有值时按注入的权限判断能否操作，build:config 扫描收集 */
  permission?: string
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
/** 未传 permission 不受控；传了但应用未注入权限时一律不可操作 */
const permitted = computed(() => {
  if (!props.permission) return true
  if (!platform.permission) {
    platform.onMissingProvider?.('permission')
    return false
  }
  return platform.permission.isEnabled(props.permission)
})
let disposed = false
/** el-switch 在挂载时发现值不等于开/关值会自动发 change，挂载前的 change 不是用户操作，不提交 */
let mounted = false
onMounted(() => { mounted = true })
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
/** 请求成功后才改 v-model。已卸载直接返回；外部已改值则跳过回写，但 success 仍发出。 */
async function change(nextValue: StatusValue) {
  if (!mounted || props.disabled || !permitted.value || loading.value || nextValue === props.modelValue) return
  const prevValue = props.modelValue
  loading.value = true
  try {
    if (props.submit) await props.submit(nextValue, prevValue)
    else await props.apiMethod?.({ nextValue, prevValue })
    if (disposed) return
    if (props.modelValue === prevValue) {
      emit('update:modelValue', nextValue)
      emit('change', nextValue)
    }
    emit('success', { nextValue, prevValue })
  } catch (error) { if (!disposed) emit('error', { nextValue, prevValue, error }) }
  finally { loading.value = false }
}
</script>
