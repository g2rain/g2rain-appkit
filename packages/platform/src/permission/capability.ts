import type { RuntimeCapability } from '../sub/types.js'
import type { PermissionProvider } from './types.js'

export interface PermissionCapability extends RuntimeCapability {
  getProvider(): PermissionProvider | undefined
}

/**
 * 持有应用注入的 PermissionProvider。本能力不解释权限，只负责随 Definition 释放调用方给出的 dispose。
 */
export function createPermissionCapability(options: {
  provider?: PermissionProvider
  dispose?: () => void | Promise<void>
} = {}): PermissionCapability {
  return {
    id: 'permission',
    getProvider: () => options.provider,
    bootstrap({ scope }) {
      if (options.dispose) scope.add(() => options.dispose?.())
    },
  }
}
