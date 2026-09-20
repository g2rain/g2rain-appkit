export { createSubDirectedMessage, resolveSubHostProps } from './host.js'
export type {
  ResolvedSubHost,
  SubDirectedMessage,
  SubHostDefaults,
  SubHostFields,
  SubHostProps,
  SubLegacyAuth,
  SubMessageIdentity,
} from './host.js'
export { createStandardSubPlatform } from './preset.js'
export type { StandardSubPlatform, StandardSubPlatformOptions } from './preset.js'
export { createSubPlatform } from '../kernel/definition.js'
export type { RuntimeScope } from '../kernel/scope.js'
export type {
  CreateSubPlatformOptions,
  PlatformMountInput,
  PlatformUpdateInput,
  RuntimeCapability,
  SubApplication,
  SubMountRequest,
  SubPlatform,
  SubPlatformLifecycle,
} from './types.js'
