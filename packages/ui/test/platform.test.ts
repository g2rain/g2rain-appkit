import { flushPromises, mount } from '@vue/test-utils'
import { ref, type Plugin } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { G2rainUi } from '../src/context'
import { G2rainPlatformUi, type G2rainPlatformUiOptions } from '../src/platform/provide'
import DictText from '../src/platform/DictText.vue'
import OrganSelect from '../src/platform/OrganSelect.vue'
import StatusSwitch from '../src/platform/StatusSwitch.vue'
import RemoteSelect from '../src/remote-select/RemoteSelect.vue'
import { ElSwitch } from 'element-plus'

function plugins(options: G2rainPlatformUiOptions & { locale?: () => string | undefined } = {}): Array<Plugin | [Plugin, ...unknown[]]> {
  return [
    [G2rainUi, { locale: options.locale }],
    [G2rainPlatformUi, {
      dataProviders: options.dataProviders,
      onMissingProvider: options.onMissingProvider,
    }],
  ]
}

describe('platform components', () => {
  it('preserves numeric/boolean dictionary matching, placeholders and explicit options precedence', async () => {
    const loadOptions = vi.fn()
    const wrapper = mount(DictText, { props: { value: true, options: [{ code: '1', name: '是' }] }, global: { plugins: plugins({ dataProviders: { dict: { loadOptions } } }) } })
    expect(wrapper.text()).toBe('是')
    await wrapper.setProps({ value: false })
    expect(wrapper.text()).toBe('false')
    await wrapper.setProps({ value: null })
    expect(wrapper.text()).toBe('-')
    expect(loadOptions).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('reloads locale, cancels stale results and cancels on unmount', async () => {
    const locale = ref('zh')
    const requests: { resolve: (items: { code: string; name: string }[]) => void; signal: AbortSignal }[] = []
    const loadOptions = vi.fn((params: { signal?: AbortSignal }) => new Promise<readonly { code: string; name: string }[]>(resolve => {
      requests.push({ resolve, signal: params.signal as AbortSignal })
    }))
    const wrapper = mount(DictText, { props: { value: '1', usageCode: 'status' }, global: { plugins: plugins({ locale: () => locale.value, dataProviders: { dict: { loadOptions } } }) } })
    await flushPromises()
    locale.value = 'en'
    await flushPromises()
    expect(requests[0].signal.aborted).toBe(true)
    requests[1].resolve([{ code: '1', name: 'Enabled' }])
    await flushPromises()
    requests[0].resolve([{ code: '1', name: '旧值' }])
    await flushPromises()
    expect(wrapper.text()).toBe('Enabled')
    wrapper.unmount()
    expect(requests[1].signal.aborted).toBe(true)
  })
  it('uses injected organization policy with explicit prop and loader overrides', async () => {
    const providerLoader = vi.fn(async () => [])
    const apiMethod = vi.fn(async () => [{ organId: 9, organName: '机构' }])
    const wrapper = mount(OrganSelect, { props: { apiMethod, clearable: true }, global: { stubs: { RemoteSelect: true }, plugins: plugins({ dataProviders: { organ: { loadOptions: providerLoader, getPolicy: () => ({ defaultValue: 9, clearable: false }) } } }) } })
    expect(wrapper.emitted('update:modelValue')).toEqual([[9]])
    const child = wrapper.findComponent(RemoteSelect)
    expect(child.props('clearable')).toBe(true)
    await child.props('fetchData')({ value: 9 })
    expect(apiMethod).toHaveBeenCalled()
    expect(providerLoader).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('commits once after success and prevents duplicate submissions', async () => {
    let finish!: () => void
    const apiMethod = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
    const wrapper = mount(StatusSwitch, { props: { modelValue: 'INACTIVE', apiMethod }, global: { stubs: { ElSwitch: true } } })
    const child = wrapper.findComponent(ElSwitch)
    child.vm.$emit('change', 'ACTIVE')
    child.vm.$emit('change', 'ACTIVE')
    expect(apiMethod).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    finish()
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toEqual([['ACTIVE']])
    wrapper.unmount()
  })
  it('preserves the model after failure and never submits on external model updates', async () => {
    const apiMethod = vi.fn(async () => { throw new Error('failed') })
    const wrapper = mount(StatusSwitch, { props: { modelValue: false, activeValue: true, inactiveValue: false, apiMethod }, global: { stubs: { ElSwitch: true } } })
    wrapper.findComponent(ElSwitch).vm.$emit('change', true)
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('error')).toHaveLength(1)
    await wrapper.setProps({ modelValue: true })
    expect(apiMethod).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
