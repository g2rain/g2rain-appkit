import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { createRuntimeScope } from '../kernel/scope.js'
import { createPermissionCapability } from './capability.js'

describe('createPermissionCapability', () => {
  it('keeps the provider and disposes with the definition scope', async () => {
    const dispose = vi.fn()
    const provider = {
      hasPageElementPermission: () => true,
      getPageElementStatus: () => 'VISIBLE' as const,
      hasApiPermission: () => true,
    }
    const capability = createPermissionCapability({ provider, dispose })
    const scope = createRuntimeScope()

    expect(capability.getProvider()).toBe(provider)
    await capability.bootstrap?.({ scope })
    expect(dispose).not.toHaveBeenCalled()
    await scope.dispose()
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('does not import Vue from the framework-agnostic entry', () => {
    const directory = dirname(fileURLToPath(import.meta.url))
    for (const file of ['index.ts', 'capability.ts']) {
      const source = readFileSync(resolve(directory, file), 'utf8')
      expect(source).not.toContain("from 'vue'")
      expect(source).not.toContain('from "vue"')
    }
  })
})
