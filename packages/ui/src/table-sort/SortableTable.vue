<template>
  <div class="g2-sortable-table">
    <el-table ref="tableRef" v-bind="$attrs" @sort-change="handleTableSortChange">
      <slot />
    </el-table>

    <SortDialog
      v-if="enableMultiSort"
      ref="dialogRef"
      v-model="sortConfig"
      v-model:visible="sortDialogVisible"
      :columns="registeredColumns"
      :show-in-action-column="false"
      @sort-change="handleDialogSortChange"
    />
  </div>
</template>

<script setup lang="ts">
import { provide, ref, watch } from 'vue'
import SortDialog from './SortDialog.vue'
import { TABLE_SORT_CONTEXT } from './types'
import type { SortColumn, SortItem, SortOrder } from './types'
import { useTableSort } from './useTableSort'

defineOptions({ name: 'G2SortableTable', inheritAttrs: false })

const props = withDefaults(
  defineProps<{ enableMultiSort?: boolean; initialSort?: SortItem[] }>(),
  { enableMultiSort: true, initialSort: () => [] },
)

const emit = defineEmits<{
  'sort-change': [sortParams: Record<string, string>]
}>()

const tableRef = ref<unknown>()
const dialogRef = ref<{ openSortConfig(): void }>()
const registeredColumns = ref<SortColumn[]>([])
const { sortConfig, sortDialogVisible, getSortObject, getSortString } = useTableSort(
  [],
  props.initialSort,
)

function registerColumn(column: SortColumn): void {
  if (!registeredColumns.value.some((item) => item.prop === column.prop)) {
    registeredColumns.value.push(column)
  }
}

function unregisterColumn(prop: string): void {
  registeredColumns.value = registeredColumns.value.filter((item) => item.prop !== prop)
}

function openSortConfig(): void {
  dialogRef.value?.openSortConfig()
}

provide(TABLE_SORT_CONTEXT, {
  registerColumn,
  unregisterColumn,
  openSortConfig,
  getSortParams: getSortObject,
})

function isSortOrder(value: unknown): value is SortOrder {
  return value === 'ascending' || value === 'descending'
}

function handleTableSortChange(value: { prop?: string; order?: unknown }): void {
  if (!value.prop) return
  const index = sortConfig.value.findIndex((item) => item.prop === value.prop)
  if (!isSortOrder(value.order)) {
    if (index >= 0) sortConfig.value.splice(index, 1)
  } else if (index >= 0) {
    sortConfig.value[index] = { prop: value.prop, order: value.order }
  } else {
    sortConfig.value.push({ prop: value.prop, order: value.order })
  }
  emit('sort-change', getSortObject())
}

function handleDialogSortChange(): void {
  emit('sort-change', getSortObject())
}

watch(
  () => props.initialSort,
  (value) => {
    sortConfig.value = value.map((item) => ({ ...item }))
  },
  { deep: true },
)

defineExpose({
  openSortConfig,
  getSortParams: getSortObject,
  getSortString,
  tableRef,
})
</script>

<style scoped>
.g2-sortable-table {
  width: 100%;
}

:deep(.el-table__header th.ascending .caret-wrapper .sort-caret.ascending),
:deep(.el-table__header th.descending .caret-wrapper .sort-caret.descending) {
  color: var(--g2-color-primary);
}
</style>

