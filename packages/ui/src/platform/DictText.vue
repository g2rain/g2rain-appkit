<template>
  <span><slot :text="text" :loading="loading">{{ text }}</slot></span>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useG2rainUi } from '../context'
import { useG2rainPlatformUi } from './provide'
import type { DictLoader } from '../platform-data'
import type { RemoteSelectOption } from '../remote-select/types'
import { useDictOptions } from './useDictOptions'
const props = withDefaults(defineProps<{
  value?: string | number | boolean | null
  usageCode?: string
  dictCode?: string
  apiMethod?: DictLoader
  options?: readonly RemoteSelectOption[]
  valueKey?: string
  labelKey?: string
  placeholder?: string
}>(), { valueKey: 'code', labelKey: 'name', placeholder: '-' })
const emit = defineEmits<{ error: [error: unknown] }>()
const ui = useG2rainUi()
const platform = useG2rainPlatformUi()
const { items, loading } = useDictOptions(() => ({
  options: props.options,
  loader: props.apiMethod ?? platform.dataProviders?.dict?.loadOptions,
  enabled: props.value != null && props.value !== '',
  params: { code: typeof props.value === 'boolean' || props.value == null ? undefined : String(props.value).trim(), usageCode: props.usageCode, dictCode: props.dictCode, locale: ui.locale?.() },
}), error => emit('error', error))
/** 布尔值按 true/1/yes 与 false/0/no 匹配字典 code，其余值按去空格后的字符串相等匹配。 */
const text = computed(() => {
  if (props.value == null || props.value === '') return props.placeholder
  const match = items.value.find(item => {
    const code = String(item[props.valueKey]).trim()
    if (typeof props.value !== 'boolean') return code === String(props.value).trim()
    return (props.value ? ['true', '1', 'yes', 'y'] : ['false', '0', 'no', 'n']).includes(code.toLowerCase())
  })
  return String(match?.[props.labelKey] ?? props.value)
})
</script>
