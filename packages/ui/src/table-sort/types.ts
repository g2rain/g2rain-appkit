import type { InjectionKey } from 'vue'

export type SortOrder = 'ascending' | 'descending'

export interface SortItem {
  prop: string
  order: SortOrder
}

export interface SortColumn {
  prop: string
  label: string
  sortable?: boolean
}

export interface TableSortContext {
  registerColumn(column: SortColumn): void
  unregisterColumn(prop: string): void
  openSortConfig(): void
  getSortParams(): Record<string, string>
}

export interface SortableTableExpose {
  openSortConfig(): void
  getSortParams(): Record<string, string>
  getSortString(): string
  tableRef: unknown
}

export const TABLE_SORT_CONTEXT: InjectionKey<TableSortContext> = Symbol(
  'g2rain-table-sort-context',
)

