import { describe, expect, it } from 'vitest'
import { useTableSort } from '../src/table-sort/useTableSort'

describe('useTableSort', () => {
  it('produces API sort formats without mutating the initial input', () => {
    const initial = [{ prop: 'name', order: 'ascending' as const }]
    const sort = useTableSort([], initial)
    sort.sortConfig.value[0].order = 'descending'

    expect(initial[0].order).toBe('ascending')
    expect(sort.getSortObject()).toEqual({ name: 'desc' })
    expect(sort.getSortString()).toBe('name desc')
  })
})

