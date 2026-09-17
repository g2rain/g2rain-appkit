<template>
  <el-table-column v-bind="$attrs" :sortable="computedSortable" :sort-by="sortBy" :sort-orders="sortOrders">
    <template v-if="$slots.default" #default="scope">
      <slot v-bind="scope" />
    </template>
    <template v-if="$slots.header" #header="scope">
      <slot name="header" v-bind="scope" />
    </template>
  </el-table-column>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, useAttrs } from 'vue'
import { TABLE_SORT_CONTEXT } from './types'
import type { SortOrder } from './types'

defineOptions({ name: 'G2TableColumn', inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    sortable?: boolean | 'custom'
    sortBy?: string | ((row: unknown) => unknown)
    sortOrders?: Array<SortOrder | null>
  }>(),
  {
    sortable: true,
    sortBy: undefined,
    sortOrders: () => ['ascending', 'descending', null],
  },
)

const attrs = useAttrs()
const context = inject(TABLE_SORT_CONTEXT, undefined)
const prop = computed(() => {
  if (typeof attrs.prop === 'string') return attrs.prop
  return typeof props.sortBy === 'string' ? props.sortBy : ''
})
const label = computed(() => String(attrs.label ?? prop.value))
/** 保留 Element Plus 的 'custom'（仅触发 sort-change，不做本地排序） */
const computedSortable = computed(() => {
  if (props.sortable === false) return false
  if (props.sortable === 'custom') return 'custom'
  return true
})

onMounted(() => {
  if (prop.value && props.sortable !== false) {
    context?.registerColumn({ prop: prop.value, label: label.value, sortable: true })
  }
})

onUnmounted(() => {
  if (prop.value) context?.unregisterColumn(prop.value)
})

defineExpose({
  sortable: computedSortable,
  sortBy: props.sortBy,
  sortOrders: props.sortOrders,
})
</script>
