import { flushPromises, mount } from '@vue/test-utils'
import { ElSwitch } from 'element-plus'
import { defineComponent, h, ref, shallowRef } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { G2rainUi } from '../src/context'
import { G2rainPlatformUi } from '../src/platform/provide'
import OrganSelect from '../src/platform/OrganSelect.vue'
import StatusSwitch from '../src/platform/StatusSwitch.vue'
import ApiSelect from '../src/remote-select/ApiSelect.vue'
import DictSelect from '../src/remote-select/DictSelect.vue'
import RemoteSelect from '../src/remote-select/RemoteSelect.vue'
import QueryForm from '../src/query-form/QueryForm.vue'
import type { RemoteSelectFetchParams, RemoteSelectOption } from '../src/remote-select/types'
import type { QueryFormData, QueryFormExpose } from '../src/query-form/types'

type Pending = { params: RemoteSelectFetchParams; resolve: (rows: RemoteSelectOption[]) => void }

/** 记录每次请求，由测试决定返回顺序 */
function deferredFetch() {
  const calls: Pending[] = []
  const fetchData = vi.fn((params: RemoteSelectFetchParams) => new Promise<RemoteSelectOption[]>(resolve => {
    calls.push({ params, resolve })
  }))
  return { calls, fetchData }
}

const rows = [{ value: 1, label: '一' }, { value: 2, label: '二' }]
/** 读取组件内部状态：el-select 在测试里未注册，只能直接看 setup 里的值 */
const setupState = (wrapper: ReturnType<typeof mount>) =>
  (wrapper.findComponent(RemoteSelect).vm.$ as unknown as { setupState: Record<string, unknown> }).setupState
const optionValues = (wrapper: ReturnType<typeof mount>) =>
  (setupState(wrapper).options as RemoteSelectOption[]).map(item => item.value)

/** 直接调用组件传给 el-select 的 remote-method */
const remoteSearch = (wrapper: ReturnType<typeof mount>) =>
  setupState(wrapper).handleRemoteSearch as (query: string) => void

afterEach(() => { vi.useRealTimers() })

describe('RemoteSelect request channels', () => {
  it('keeps the prefetch when the initial value is echoed at mount', async () => {
    const { calls, fetchData } = deferredFetch()
    const wrapper = mount(RemoteSelect, { props: { modelValue: 2, fetchData, prefetchOnOpen: true } })
    expect(calls.map(call => call.params.value)).toEqual([undefined, 2])
    expect(calls[0].params.signal?.aborted).toBe(false)
    calls[1].resolve([rows[1]])
    calls[0].resolve(rows)
    await flushPromises()
    expect(optionValues(wrapper)).toEqual([1, 2])
    wrapper.unmount()
  })

  it('does not cancel the prefetch on the empty search fired when opening', async () => {
    vi.useFakeTimers()
    const { calls, fetchData } = deferredFetch()
    const wrapper = mount(RemoteSelect, { props: { fetchData, prefetchOnOpen: true } })
    remoteSearch(wrapper)('')
    vi.advanceTimersByTime(300)
    expect(calls[0].params.signal?.aborted).toBe(false)
    calls[0].resolve(rows)
    await flushPromises()
    expect(optionValues(wrapper)).toEqual([1, 2])
    wrapper.unmount()
  })

  it('reloads options when the locale changes', async () => {
    const locale = ref('zh')
    const fetchData = vi.fn(async () => rows)
    const wrapper = mount(RemoteSelect, {
      props: { fetchData, prefetchOnOpen: true },
      global: { plugins: [[G2rainUi, { locale: () => locale.value }]] },
    })
    await flushPromises()
    locale.value = 'en'
    await flushPromises()
    expect(fetchData).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('keeps the selected label while locale reload is in flight', async () => {
    const locale = ref('zh')
    const requests: { resolve: (rows: RemoteSelectOption[]) => void }[] = []
    const fetchData = vi.fn(
      () => new Promise<RemoteSelectOption[]>(resolve => { requests.push({ resolve }) }),
    )
    const wrapper = mount(RemoteSelect, {
      props: { modelValue: 2, fetchData, prefetchOnOpen: true },
      global: { plugins: [[G2rainUi, { locale: () => locale.value }]] },
    })
    // 挂载：预取 + 回显
    await vi.waitFor(() => expect(requests).toHaveLength(2))
    requests[1].resolve([{ value: 2, label: '二' }])
    requests[0].resolve(rows)
    await flushPromises()
    expect(optionValues(wrapper)).toContain(2)
    expect((setupState(wrapper).options as RemoteSelectOption[]).find(item => item.value === 2)?.label).toBe('二')

    locale.value = 'en'
    await flushPromises()
    // 新回显尚未返回时仍显示旧标签
    expect((setupState(wrapper).options as RemoteSelectOption[]).find(item => item.value === 2)?.label).toBe('二')
    const echo = requests.at(-1)
    echo?.resolve([{ value: 2, label: 'Two' }])
    await flushPromises()
    expect((setupState(wrapper).options as RemoteSelectOption[]).find(item => item.value === 2)?.label).toBe('Two')
    wrapper.unmount()
  })

  it('selects the first default option again after the value is cleared', async () => {
    const fetchData = vi.fn(async () => rows)
    const wrapper = mount(RemoteSelect, { props: { modelValue: 2, fetchData, prefetchOnOpen: true, autoSelectFirstWhenEmpty: true } })
    await flushPromises()
    await wrapper.setProps({ modelValue: null })
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([1])
    wrapper.unmount()
  })
})

describe('ApiSelect', () => {
  it('requires both allowEmptyKeyword and prefetchOnOpen for empty keyword fetch', async () => {
    const apiMethod = vi.fn(async () => rows)
    const prefetchOnly = mount(ApiSelect, {
      props: { apiMethod, prefetchOnOpen: true },
      global: { stubs: { RemoteSelect: true } },
    })
    await prefetchOnly.findComponent(RemoteSelect).props('fetchData')({ key: '' })
    expect(apiMethod).not.toHaveBeenCalled()
    prefetchOnly.unmount()

    const both = mount(ApiSelect, {
      props: { apiMethod, allowEmptyKeyword: true, prefetchOnOpen: true },
      global: { stubs: { RemoteSelect: true } },
    })
    await both.findComponent(RemoteSelect).props('fetchData')({ key: '' })
    expect(apiMethod).toHaveBeenCalledTimes(1)
    both.unmount()
  })
})

describe('DictSelect', () => {
  it('does not prefetch without usageCode and searches numbers by keyword', async () => {
    vi.useFakeTimers()
    const apiMethod = vi.fn(async (_params: RemoteSelectFetchParams & { usageCode?: string }) => [])
    const wrapper = mount(DictSelect, { props: { apiMethod } })
    await flushPromises()
    expect(apiMethod).not.toHaveBeenCalled()

    await wrapper.setProps({ usageCode: 'status' })
    await flushPromises()
    apiMethod.mockClear()
    remoteSearch(wrapper)('12')
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(apiMethod).toHaveBeenCalledWith(expect.objectContaining({ key: '12', usageCode: 'status' }))
    expect(apiMethod.mock.calls[0][0]).not.toHaveProperty('value')
    wrapper.unmount()
  })

  it('uses dataProviders.dict when apiMethod is omitted, and prefers explicit apiMethod', async () => {
    const loadOptions = vi.fn(async () => [{ code: 'a', name: 'A' }])
    const onMissingProvider = vi.fn()
    const viaProvider = mount(DictSelect, {
      props: { usageCode: 'status' },
      global: {
        stubs: { RemoteSelect: true },
        plugins: [[G2rainUi], [G2rainPlatformUi, { dataProviders: { dict: { loadOptions } }, onMissingProvider }]],
      },
    })
    await viaProvider.findComponent(RemoteSelect).props('fetchData')({ key: 'x' })
    expect(loadOptions).toHaveBeenCalledWith(expect.objectContaining({ usageCode: 'status', key: 'x' }))
    viaProvider.unmount()

    const apiMethod = vi.fn(async () => [])
    const viaProp = mount(DictSelect, {
      props: { usageCode: 'status', apiMethod },
      global: {
        stubs: { RemoteSelect: true },
        plugins: [[G2rainUi], [G2rainPlatformUi, { dataProviders: { dict: { loadOptions } } }]],
      },
    })
    loadOptions.mockClear()
    await viaProp.findComponent(RemoteSelect).props('fetchData')({ key: 'y' })
    expect(apiMethod).toHaveBeenCalled()
    expect(loadOptions).not.toHaveBeenCalled()
    viaProp.unmount()
  })
})

describe('OrganSelect', () => {
  it('does not fill the policy default when defaultValue is explicitly null', () => {
    const wrapper = mount(OrganSelect, {
      props: { defaultValue: null, apiMethod: vi.fn(async () => []) },
      global: {
        stubs: { RemoteSelect: true },
        plugins: [[G2rainPlatformUi, { dataProviders: { organ: { loadOptions: vi.fn(), getPolicy: () => ({ defaultValue: 9 }) } } }]],
      },
    })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })
})

describe('StatusSwitch', () => {
  it('does not submit the change el-switch emits at mount for an unknown value', async () => {
    const apiMethod = vi.fn(async () => {})
    const Host = defineComponent(() => () => h(StatusSwitch, { modelValue: 'LOCKED', apiMethod }))
    const wrapper = mount(Host)
    await flushPromises()
    expect(apiMethod).not.toHaveBeenCalled()
    wrapper.findComponent(ElSwitch).vm.$emit('change', 'ACTIVE')
    await flushPromises()
    expect(apiMethod).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})

describe('QueryForm', () => {
  it('resets query fields but keeps sorts when the parent binds a plain object through shallowRef', async () => {
    const stubs = {
      'el-form': { template: '<form><slot /></form>' },
      'el-form-item': { template: '<div><slot /></div>' },
      'el-input': { template: '<input />' },
      'el-date-picker': { template: '<div />' },
      'el-button': { template: '<button><slot /></button>' },
    }
    const model = shallowRef<QueryFormData>({ id: 7, createTime: ['2026-01-01', '2026-01-02'], updateTime: ['2026-01-01', '2026-01-02'], sorts: ['id,desc'], name: 'kept' })
    const form = ref<QueryFormExpose>()
    const Host = defineComponent(() => () => h(QueryForm, {
      ref: form,
      modelValue: model.value,
      'onUpdate:modelValue': (value: QueryFormData) => { model.value = value },
    }))
    const wrapper = mount(Host, { global: { stubs } })
    form.value?.reset()
    await flushPromises()
    expect(model.value).toEqual({ id: undefined, createTime: undefined, updateTime: undefined, sorts: ['id,desc'], name: 'kept' })
    wrapper.unmount()
  })
})
