export interface QueryFormData {
  id?: number
  createTime?: [string, string]
  updateTime?: [string, string]
  sorts?: string[]
  [key: string]: unknown
}

export interface TableSortChange {
  prop?: string
  order?: 'ascending' | 'descending' | null
}

export interface QueryFormExpose {
  updateSorts(sortParams: Record<string, string>): void
  updateSortFromTable(sort: TableSortChange): void
  reset(): void
}

