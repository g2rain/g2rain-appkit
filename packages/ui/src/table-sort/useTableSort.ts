import { computed, reactive, ref } from 'vue'
import type { SortColumn, SortItem } from './types'

export function useTableSort(
  columns: SortColumn[],
  initialSort: SortItem[] = [],
) {
  const sortConfig = ref<SortItem[]>(initialSort.map((item) => ({ ...item })))
  const sortDialogVisible = ref(false)
  const newSort = reactive<SortItem>({ prop: '', order: 'ascending' })
  const sortableColumns = computed(() =>
    columns.filter((column) => column.sortable !== false),
  )

  const getColumnLabel = (prop: string): string =>
    columns.find((column) => column.prop === prop)?.label ?? prop

  const addSort = (): void => {
    if (!newSort.prop || sortConfig.value.some((item) => item.prop === newSort.prop)) {
      return
    }
    sortConfig.value.push({ ...newSort })
    newSort.prop = ''
    newSort.order = 'ascending'
  }

  const removeSort = (index: number): void => {
    sortConfig.value.splice(index, 1)
  }

  const openSortConfig = (): void => {
    sortDialogVisible.value = true
  }

  const closeSortConfig = (): void => {
    sortDialogVisible.value = false
  }

  const clearAllSort = (): void => {
    sortConfig.value = []
  }

  const toggleSortOrder = (prop: string): void => {
    const item = sortConfig.value.find((candidate) => candidate.prop === prop)
    if (item) {
      item.order = item.order === 'ascending' ? 'descending' : 'ascending'
    }
  }

  const getSortString = (): string =>
    sortConfig.value
      .map((item) => `${item.prop} ${item.order === 'ascending' ? 'asc' : 'desc'}`)
      .join(',')

  const getSortObject = (): Record<string, string> =>
    Object.fromEntries(
      sortConfig.value.map((item) => [
        item.prop,
        item.order === 'ascending' ? 'asc' : 'desc',
      ]),
    )

  return {
    sortConfig,
    sortDialogVisible,
    newSort,
    sortableColumns,
    getColumnLabel,
    addSort,
    removeSort,
    openSortConfig,
    closeSortConfig,
    clearAllSort,
    toggleSortOrder,
    getSortString,
    getSortObject,
  }
}

