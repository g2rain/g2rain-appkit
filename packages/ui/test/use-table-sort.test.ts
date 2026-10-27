import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import SortableTable from '../src/table-sort/SortableTable.vue'
import TableColumn from '../src/table-sort/TableColumn.vue'
import SortDialog from '../src/table-sort/SortDialog.vue'
import { useTableSort } from '../src/table-sort/useTableSort'

const tableSetup = (wrapper: ReturnType<typeof mount>) =>
  (wrapper.findComponent(SortableTable).vm.$ as unknown as { setupState: Record<string, unknown> }).setupState

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

const tableStubs = {
  'el-table': { template: '<div><slot /></div>' },
  'el-table-column': true,
  'el-dialog': true,
  'el-row': true,
  'el-col': true,
  'el-select': true,
  'el-option': true,
  'el-button': true,
}

describe('TableColumn label sync', () => {
  it('replaces registered column label when the language-driven label changes', async () => {
    const label = ref('名称')
    const Host = defineComponent({
      setup: () => () =>
        h(SortableTable, null, {
          default: () => h(TableColumn, { prop: 'name', label: label.value }),
        }),
    })
    const wrapper = mount(Host, { global: { stubs: tableStubs } })
    await flushPromises()
    expect(wrapper.findComponent(SortDialog).props('columns')).toEqual([
      { prop: 'name', label: '名称', sortable: true },
    ])
    label.value = 'Name'
    await flushPromises()
    expect(wrapper.findComponent(SortDialog).props('columns')).toEqual([
      { prop: 'name', label: 'Name', sortable: true },
    ])
    wrapper.unmount()
  })
})

describe('SortableTable initialSort and header classes', () => {
  it('does not reset sortConfig when parent re-renders the same initialSort literal', async () => {
    const tick = ref(0)
    const Host = defineComponent({
      setup: () => () => {
        void tick.value
        return h(SortableTable, {
          initialSort: [{ prop: 'id', order: 'descending' as const }],
        })
      },
    })
    const wrapper = mount(Host, { global: { stubs: tableStubs } })
    await flushPromises()
    const sortConfig = tableSetup(wrapper).sortConfig as { value: { prop: string; order: string }[] }
    sortConfig.value = [{ prop: 'name', order: 'ascending' }]
    tick.value += 1
    await nextTick()
    expect(sortConfig.value).toEqual([{ prop: 'name', order: 'ascending' }])
    wrapper.unmount()
  })

  it('applies ascending/descending header classes and keeps caller class names', async () => {
    const wrapper = mount(SortableTable, {
      props: {
        initialSort: [
          { prop: 'id', order: 'ascending' },
          { prop: 'name', order: 'descending' },
        ],
      },
      attrs: { 'header-cell-class-name': 'extra' },
      global: { stubs: tableStubs },
    })
    const headerCellClassName = tableSetup(wrapper).headerCellClassName as (data: {
      column: { property?: string }
    }) => string
    expect(headerCellClassName({ column: { property: 'id' } })).toContain('ascending')
    expect(headerCellClassName({ column: { property: 'name' } })).toContain('descending')
    expect(headerCellClassName({ column: { property: 'other' } })).toBe('extra')
    expect(headerCellClassName({ column: { property: 'id' } })).toContain('extra')

    await wrapper.setProps({})
    wrapper.unmount()

    const withFn = mount(SortableTable, {
      props: { initialSort: [{ prop: 'id', order: 'ascending' }] },
      attrs: { headerCellClassName: () => 'from-fn' },
      global: { stubs: tableStubs },
    })
    const fnHeader = tableSetup(withFn).headerCellClassName as (data: {
      column: { property?: string }
    }) => string
    expect(fnHeader({ column: { property: 'id' } })).toBe('from-fn ascending')
    withFn.unmount()
  })
})

