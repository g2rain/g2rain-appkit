import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import { G2rainUi, useG2rainUi } from '../src/context'

const Consumer = defineComponent({
  setup() {
    const context = useG2rainUi()
    return () => h('span', context.translate('hello', '你好'))
  },
})

describe('G2rainUi', () => {
  it('uses fallback text without plugin installation', () => {
    expect(mount(Consumer).text()).toBe('你好')
  })

  it('injects a host translator', () => {
    const wrapper = mount(Consumer, {
      global: {
        plugins: [[G2rainUi, { translate: (key: string) => `translated:${key}` }]],
      },
    })
    expect(wrapper.text()).toBe('translated:hello')
  })
})

