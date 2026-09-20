import type { RuntimeContextUpdate } from '../contract/context.js'
import type { RuntimeCapability } from '../sub/types.js'

export interface PlatformHttpBinding {
  updatePublicContext?(patch: Readonly<RuntimeContextUpdate>): void | Promise<void>
  dispose(): void | Promise<void>
}

export interface PlatformHttpAdapter {
  attach(): PlatformHttpBinding | Promise<PlatformHttpBinding>
}

/**
 * 一份 Definition 只有一个 Binding。locale 在所有实例之间共享，后一次 mount 或 update 覆盖前一次。
 * 单个 unmount 不释放 Binding，也不销毁调用方的 Client。
 */
export function createHttpCapability(adapter: PlatformHttpAdapter): RuntimeCapability {
  let binding: PlatformHttpBinding | undefined

  async function syncLocale(locale: string | undefined): Promise<void> {
    if (locale === undefined) return
    await binding?.updatePublicContext?.({ locale })
  }

  return {
    id: 'http',
    async bootstrap({ scope }) {
      binding = await adapter.attach()
      scope.add(async () => {
        const current = binding
        binding = undefined
        await current?.dispose()
      })
    },
    mount(input) {
      return syncLocale(input.context.locale)
    },
    update(input) {
      return syncLocale(input.context.locale)
    },
    unmount() {
      return undefined
    },
  }
}
