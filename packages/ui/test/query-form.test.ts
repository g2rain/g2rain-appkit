import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QueryForm from '../src/query-form/QueryForm.vue'
import type { QueryFormData, QueryFormExpose } from '../src/query-form/types'

const stubs = {
  'el-form': { template: '<form><slot /></form>' },
  'el-form-item': { template: '<div><slot /></div>' },
  'el-input': { template: '<input />' },
  'el-date-picker': { template: '<div />' },
  'el-button': { template: '<button @click="$emit(\'click\')"><slot /></button>' },
}

describe('QueryForm', () => {
  it('preserves extension fields when reset', async () => {
    const model: QueryFormData = {
      id: 7,
      createTime: ['2026-01-01', '2026-01-02'],
      sorts: ['id,desc'],
      name: 'kept',
    }
    const wrapper = mount(QueryForm, {
      props: {
        modelValue: model,
        'onUpdate:modelValue': (value: QueryFormData) => Object.assign(model, value),
      },
      global: { stubs },
    })

    ;(wrapper.vm as unknown as QueryFormExpose).reset()
    await wrapper.vm.$nextTick()

    expect(model.name).toBe('kept')
    expect(model.id).toBeUndefined()
    expect(wrapper.emitted('search')).toHaveLength(1)
  })
})

