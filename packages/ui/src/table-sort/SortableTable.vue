<template>
  <div class="g2-sortable-table">
    <el-table
      ref="tableRef"
      v-bind="$attrs"
      :header-cell-class-name="headerCellClassName"
      @sort-change="handleTableSortChange"
    >
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
import { provide, ref, useAttrs, watch } from 'vue'
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

const attrs = useAttrs()
const tableRef = ref<unknown>()
const dialogRef = ref<{ openSortConfig(): void }>()
const registeredColumns = ref<SortColumn[]>([])
const { sortConfig, sortDialogVisible, getSortObject, getSortString } = useTableSort(
  [],
  props.initialSort,
)

/** 表头按多列排序状态加 ascending / descending 类，并保留调用方传入的 header-cell-class-name。 */
function headerCellClassName(data: { column: { property?: string } } & Record<string, unknown>): string {
  const own = attrs.headerCellClassName ?? attrs['header-cell-class-name']
  const base = typeof own === 'function' ? own(data) : (own ?? '')
  const order = sortConfig.value.find((item) => item.prop === data.column.property)?.order ?? ''
  return [base, order].filter(Boolean).join(' ')
}

/** 列注册进多列排序对话框。同 prop 替换（语言切换会改 label），卸载时移除。 */
function registerColumn(column: SortColumn): void {
  const index = registeredColumns.value.findIndex((item) => item.prop === column.prop)
  if (index >= 0) registeredColumns.value[index] = column
  else registeredColumns.value.push(column)
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

/** 表头排序并入多列状态：order 为空则移除该列，否则更新或追加，再抛出完整排序对象。 */
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
  () => props.initialSort.map((item) => `${item.prop},${item.order}`).join(';'),
  () => {
    sortConfig.value = props.initialSort.map((item) => ({ ...item }))
  },
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

