import { PlatformError } from '../contract/error.js'
import type { RuntimeCapability } from '../sub/types.js'

export function sortCapabilities(capabilities: readonly RuntimeCapability[]): RuntimeCapability[] {
  const byId = new Map<string, RuntimeCapability>()
  const registrationIndex = new Map<string, number>()

  capabilities.forEach((capability, index) => {
    if (!capability.id) {
      throw new PlatformError({
        code: 'runtime.capability.invalid',
        phase: 'bootstrap',
        message: 'Capability id is required.',
      })
    }
    if (byId.has(capability.id)) {
      throw new PlatformError({
        code: 'runtime.capability.duplicate',
        phase: 'bootstrap',
        message: `Duplicate capability id "${capability.id}".`,
        capabilityId: capability.id,
      })
    }
    byId.set(capability.id, capability)
    registrationIndex.set(capability.id, index)
  })

  for (const capability of capabilities) {
    for (const dependencyId of capability.dependsOn ?? []) {
      if (!byId.has(dependencyId)) {
        throw new PlatformError({
          code: 'runtime.capability.missing-dependency',
          phase: 'bootstrap',
          message: `Capability "${capability.id}" depends on missing "${dependencyId}".`,
          capabilityId: capability.id,
        })
      }
    }
  }

  const indegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()
  for (const capability of capabilities) {
    indegree.set(capability.id, 0)
    dependents.set(capability.id, [])
  }
  for (const capability of capabilities) {
    for (const dependencyId of capability.dependsOn ?? []) {
      indegree.set(capability.id, (indegree.get(capability.id) ?? 0) + 1)
      dependents.get(dependencyId)?.push(capability.id)
    }
  }

  const queue = capabilities
    .filter(capability => indegree.get(capability.id) === 0)
    .map(capability => capability.id)
  const sorted: RuntimeCapability[] = []

  while (queue.length > 0) {
    const id = queue.shift()
    if (!id) break
    const capability = byId.get(id)
    if (!capability) break
    sorted.push(capability)
    const ready: string[] = []
    for (const dependentId of dependents.get(id) ?? []) {
      const degree = (indegree.get(dependentId) ?? 0) - 1
      indegree.set(dependentId, degree)
      if (degree === 0) ready.push(dependentId)
    }
    ready.sort((left, right) => (registrationIndex.get(left) ?? 0) - (registrationIndex.get(right) ?? 0))
    queue.push(...ready)
  }

  if (sorted.length !== capabilities.length) {
    throw new PlatformError({
      code: 'runtime.capability.cycle',
      phase: 'bootstrap',
      message: 'Capability dependencies contain a cycle.',
    })
  }

  return sorted
}
