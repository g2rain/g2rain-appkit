import { describe, expect, it } from 'vitest'
import { PlatformError } from '../contract/error.js'
import { createRuntimeScope } from './scope.js'

describe('RuntimeScope', () => {
  it('runs disposers in reverse order and skips removed ones', async () => {
    const scope = createRuntimeScope()
    const order: string[] = []
    scope.add(() => {
      order.push('first')
    })
    const remove = scope.add(() => {
      order.push('second')
    })
    scope.add(() => {
      order.push('third')
    })
    remove()
    await scope.dispose()
    expect(order).toEqual(['third', 'first'])
    expect(scope.disposed).toBe(true)
  })

  it('disposes child scopes with the parent', async () => {
    const scope = createRuntimeScope()
    const child = scope.child()
    let released = false
    child.add(() => {
      released = true
    })
    await scope.dispose()
    expect(released).toBe(true)
    expect(child.disposed).toBe(true)
  })

  it('rejects registration after dispose and aggregates disposer failures', async () => {
    const scope = createRuntimeScope()
    scope.add(() => {
      throw new Error('one')
    })
    scope.add(() => {
      throw new Error('two')
    })
    await expect(scope.dispose()).rejects.toMatchObject({
      code: 'runtime.aggregate',
      errors: [expect.any(Error), expect.any(Error)],
    })
    expect(() => scope.add(() => undefined)).toThrow(PlatformError)
    await scope.dispose()
  })
})
