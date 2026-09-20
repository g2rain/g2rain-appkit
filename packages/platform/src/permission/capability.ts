import type { RuntimeCapability } from '../sub/types.js'
import type { PermissionProvider } from './types.js'

export interface PermissionCapability extends RuntimeCapability {
  getProvider(): PermissionProvider | undefined
}

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
