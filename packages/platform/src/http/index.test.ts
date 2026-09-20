import { describe, expect, it, vi } from 'vitest'
import type { RuntimeContext } from '../contract/context.js'
import { createRuntimeScope } from '../kernel/scope.js'
import { createHttpCapability } from './index.js'

function context(patch: Partial<RuntimeContext> = {}): RuntimeContext {
  return {
    applicationCode: 'member',
    viewId: 'view',
    instanceId: 'inst',
    mode: 'integrated',
    contextPath: '/member',
    locale: 'zh-CN',
    theme: 'dark',
    metadata: { token: 'secret-token' },
    ...patch,
  }
}

describe('createHttpCapability', () => {
  it('forwards only locale and does not dispose the binding on unmount', async () => {
    const updates: unknown[] = []
    const clientDispose = vi.fn()
    const bindingDispose = vi.fn()
    const capability = createHttpCapability({
      attach: () => ({
        updatePublicContext(patch) {
          updates.push(patch)
        },
        dispose: bindingDispose,
      }),
    })
    const scope = createRuntimeScope()
    const previous = context()
    const next = context({ locale: 'en-US' })

    await capability.bootstrap?.({ scope })
    await capability.mount?.({
      context: previous,
      container: document.createElement('div'),
      scope,
    })
    await capability.update?.({
      context: next,
      previous,
      scope,
    })
    await capability.mount?.({
      context: context({ instanceId: 'other', locale: 'zh-CN' }),
      container: document.createElement('div'),
      scope: createRuntimeScope(),
    })
    await capability.unmount?.({
      context: next,
      container: document.createElement('div'),
      scope,
    })

    expect(updates).toEqual([{ locale: 'zh-CN' }, { locale: 'en-US' }, { locale: 'zh-CN' }])
    expect(bindingDispose).not.toHaveBeenCalled()
    expect(clientDispose).not.toHaveBeenCalled()
    await scope.dispose()
    expect(bindingDispose).toHaveBeenCalledTimes(1)
    expect(clientDispose).not.toHaveBeenCalled()
  })
})
