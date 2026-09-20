import { describe, expect, it } from 'vitest'
import type { RuntimeContext } from '../contract/context.js'
import { PlatformError } from '../contract/error.js'
import { createSubPlatform } from '../sub/index.js'
import type { RuntimeCapability, SubApplication, SubMountRequest } from '../sub/types.js'

function context(instanceId: string, patch: Partial<RuntimeContext> = {}): RuntimeContext {
  return {
    applicationCode: 'member',
    viewId: instanceId,
    instanceId,
    mode: 'integrated',
    contextPath: '/member',
    locale: 'zh-CN',
    ...patch,
  }
}

function request(instanceId: string, patch: Partial<RuntimeContext> = {}): SubMountRequest {
  return {
    instanceId,
    context: context(instanceId, patch),
    container: document.createElement('div'),
  }
}

function application(hooks: Partial<SubApplication> = {}): SubApplication {
  return {
    mount() {
      return undefined
    },
    unmount() {
      return undefined
    },
    ...hooks,
  }
}

describe('createSubPlatform', () => {
  it('bootstraps once and does not create an application until mount', async () => {
    let bootstraps = 0
    let created = 0
    const platform = createSubPlatform({
      applicationCode: 'member',
      createApplication() {
        created += 1
        return application()
      },
      capabilities: [{
        id: 'boot',
        bootstrap() {
          bootstraps += 1
        },
      }],
    })

    await platform.bootstrap()
    await platform.bootstrap()
    expect(bootstraps).toBe(1)
    expect(created).toBe(0)

    await platform.mount(request('a'))
    expect(bootstraps).toBe(1)
    expect(created).toBe(1)
  })

  it('mounts different instance ids concurrently and keeps the other listeners after unmount', async () => {
    let release!: () => void
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    let active = 0
    let sessions = 0
    const platform = createSubPlatform({
      applicationCode: 'member',
      createApplication() {
        sessions += 1
        return application({
          async mount() {
            await gate
          },
        })
      },
      capabilities: [{
        id: 'listeners',
        mount({ scope }) {
          active += 1
          scope.add(() => {
            active -= 1
          })
        },
      }],
    })

    const first = platform.mount(request('a'))
    const second = platform.mount(request('b'))
    release()
    await Promise.all([first, second])
    expect(active).toBe(2)
    expect(sessions).toBe(2)

    await platform.unmount('a')
    expect(active).toBe(1)
    expect(sessions).toBe(2)

    await platform.mount(request('a'))
    expect(active).toBe(2)
    await platform.dispose()
    expect(active).toBe(0)
  })

  it('rejects a second mount of the same instance until it is unmounted', async () => {
    let release!: () => void
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    const platform = createSubPlatform({
      applicationCode: 'member',
      createApplication: () => application({
        mount: () => gate,
      }),
    })

    const first = platform.mount(request('a'))
    await expect(platform.mount(request('a'))).rejects.toMatchObject({
      name: 'PlatformError',
      code: 'runtime.instance.duplicate',
    })
    release()
    await first
    await platform.unmount('a')
    await platform.mount(request('a'))
  })

  it('rolls back completed capabilities without unmounting the failed one', async () => {
    const calls: string[] = []
    let fail = true
    const platform = createSubPlatform({
      applicationCode: 'member',
      createApplication: () => application(),
      capabilities: [
        {
          id: 'a',
          async mount() {
            calls.push('a.mount')
          },
          async unmount() {
            calls.push('a.unmount')
          },
        },
        {
          id: 'b',
          dependsOn: ['a'],
          async mount() {
            calls.push('b.mount')
            if (fail) throw new Error('boom')
          },
          async unmount() {
            calls.push('b.unmount')
          },
        },
      ],
    })

    await expect(platform.mount(request('a'))).rejects.toBeInstanceOf(PlatformError)
    expect(calls).toEqual(['a.mount', 'b.mount', 'a.unmount'])
    fail = false
    await platform.mount(request('a'))
  })

  it('mounts and unmounts capabilities by dependency order', async () => {
    const calls: string[] = []
    const platform = createSubPlatform({
      applicationCode: 'member',
      createApplication: () => application({
        mount() {
          calls.push('app.mount')
        },
        unmount() {
          calls.push('app.unmount')
        },
      }),
      capabilities: [
        {
          id: 'a',
          dependsOn: ['b'],
          mount() {
            calls.push('a.mount')
          },
          unmount() {
            calls.push('a.unmount')
          },
        },
        {
          id: 'b',
          mount() {
            calls.push('b.mount')
          },
          unmount() {
            calls.push('b.unmount')
          },
        },
      ],
    })

    await platform.mount(request('a'))
    await platform.unmount('a')
    expect(calls).toEqual(['b.mount', 'a.mount', 'app.mount', 'app.unmount', 'a.unmount', 'b.unmount'])
  })

  it('keeps the previous context when update fails and rolls back only successful capabilities', async () => {
    const calls: string[] = []
    let previousLocale = ''
    const platform = createSubPlatform({
      applicationCode: 'member',
      createApplication: () => application({
        update() {
          calls.push('app.update')
        },
      }),
      capabilities: [
        {
          id: 'a',
          update(input) {
            previousLocale = input.previous.locale ?? ''
            calls.push(`a.update:${input.context.locale}`)
          },
          rollbackUpdate() {
            calls.push('a.rollback')
          },
        },
        {
          id: 'b',
          dependsOn: ['a'],
          update(input) {
            calls.push(`b.update:${input.context.locale}`)
            if (input.context.locale === 'fr') throw new Error('no')
          },
          rollbackUpdate() {
            calls.push('b.rollback')
          },
        },
      ],
    })

    await platform.mount(request('a'))
    await platform.update('a', { locale: 'en' })
    await expect(platform.update('a', { locale: 'fr' })).rejects.toBeInstanceOf(PlatformError)
    await platform.update('a', { locale: 'de' })
    expect(previousLocale).toBe('en')
    expect(calls).toEqual([
      'a.update:en',
      'b.update:en',
      'app.update',
      'a.update:fr',
      'b.update:fr',
      'a.rollback',
      'a.update:de',
      'b.update:de',
      'app.update',
    ])
  })

  it('restores the application and capabilities when application update fails', async () => {
    const locales: string[] = []
    const rollbacks: string[] = []
    const platform = createSubPlatform({
      applicationCode: 'member',
      createApplication: () => application({
        update(next) {
          locales.push(next.locale ?? '')
          if (next.locale === 'fr') throw new Error('app')
        },
      }),
      capabilities: [{
        id: 'a',
        update() {
          return undefined
        },
        rollbackUpdate(input) {
          rollbacks.push(input.previous.locale ?? '')
        },
      }],
    })

    await platform.mount(request('a', { locale: 'en' }))
    await expect(platform.update('a', { locale: 'fr' })).rejects.toMatchObject({ phase: 'update' })
    expect(locales).toEqual(['fr', 'en'])
    expect(rollbacks).toEqual(['en'])
  })

  it('continues cleanup when unmount steps fail and aggregates the errors', async () => {
    const steps: string[] = []
    const platform = createSubPlatform({
      applicationCode: 'member',
      createApplication: () => application({
        unmount() {
          steps.push('app')
          throw new Error('app')
        },
      }),
      capabilities: [{
        id: 'a',
        mount({ scope }) {
          scope.add(() => {
            steps.push('scope')
            throw new Error('scope')
          })
        },
        unmount() {
          steps.push('cap')
          throw new Error('cap')
        },
      }],
    })

    await platform.mount(request('a'))
    const error = await platform.unmount('a').then(() => undefined, (reason: unknown) => reason)
    expect(error).toBeInstanceOf(PlatformError)
    expect(error).toMatchObject({ code: 'runtime.aggregate' })
    expect(steps).toEqual(['app', 'cap', 'scope'])
  })

  it('rejects cyclic and duplicate capabilities when the definition is created', () => {
    const cycle = () => createSubPlatform({
      applicationCode: 'member',
      createApplication: () => application(),
      capabilities: [
        { id: 'a', dependsOn: ['b'] },
        { id: 'b', dependsOn: ['a'] },
      ],
    })
    expect(cycle).toThrow(PlatformError)
    expect(cycle).toThrow(expect.objectContaining({ code: 'runtime.capability.cycle' }))

    expect(() => createSubPlatform({
      applicationCode: 'member',
      createApplication: () => application(),
      capabilities: [{ id: 'a' }, { id: 'a' }],
    })).toThrow(expect.objectContaining({ code: 'runtime.capability.duplicate' }))
  })

  it('rejects a mismatched context and stops after dispose', async () => {
    const disposed: string[] = []
    const capability: RuntimeCapability = {
      id: 'a',
      dispose() {
        disposed.push('a')
      },
    }
    const platform = createSubPlatform({
      applicationCode: 'member',
      createApplication: () => application(),
      capabilities: [
        { id: 'b', dispose() { disposed.push('b') } },
        { ...capability, dependsOn: ['b'] },
      ],
    })

    await expect(platform.mount({
      ...request('a'),
      context: context('other'),
    })).rejects.toMatchObject({ code: 'runtime.context.mismatch' })

    await platform.mount(request('a'))
    await platform.dispose()
    await platform.dispose()
    expect(disposed).toEqual(['a', 'b'])
    await expect(platform.mount(request('b'))).rejects.toMatchObject({ code: 'runtime.disposed' })
  })

  it('unmounts an application created before mount fails', async () => {
    const steps: string[] = []
    const platform = createSubPlatform({
      applicationCode: 'member',
      createApplication() {
        steps.push('create')
        return application({
          mount() {
            steps.push('mount')
            throw new Error('mount failed')
          },
          unmount() {
            steps.push('unmount')
          },
        })
      },
    })

    await expect(platform.mount(request('a'))).rejects.toMatchObject({ message: 'mount failed' })
    expect(steps).toEqual(['create', 'mount', 'unmount'])
  })

  it('does not unmount when createApplication fails', async () => {
    let unmounted = false
    const platform = createSubPlatform({
      applicationCode: 'member',
      createApplication() {
        const created = application({
          unmount() {
            unmounted = true
          },
        })
        void created
        throw new Error('create failed')
      },
    })

    await expect(platform.mount(request('a'))).rejects.toMatchObject({ message: 'create failed' })
    expect(unmounted).toBe(false)
  })

  it('keeps the original mount error when application unmount also fails', async () => {
    const platform = createSubPlatform({
      applicationCode: 'member',
      createApplication: () => application({
        mount() {
          throw new Error('mount failed')
        },
        unmount() {
          throw new Error('unmount failed')
        },
      }),
    })

    const error = await platform.mount(request('a')).then(() => undefined, (reason: unknown) => reason)
    expect(error).toMatchObject({
      code: 'runtime.aggregate',
      cause: expect.objectContaining({ message: 'mount failed' }),
    })
    expect(error).toBeInstanceOf(PlatformError)
    expect((error as PlatformError).errors?.[1]).toMatchObject({ message: 'unmount failed' })
  })

  it('stops an in-flight mount when dispose starts and does not create the application', async () => {
    let release!: () => void
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    const steps: string[] = []
    const platform = createSubPlatform({
      applicationCode: 'member',
      createApplication() {
        steps.push('create')
        return application({
          mount() {
            steps.push('app.mount')
          },
          unmount() {
            steps.push('app.unmount')
          },
        })
      },
      capabilities: [{
        id: 'slow',
        async mount() {
          steps.push('cap.start')
          await gate
          steps.push('cap.end')
        },
        unmount() {
          steps.push('cap.unmount')
        },
      }],
    })

    const mounting = platform.mount(request('a'))
    for (let attempt = 0; attempt < 10 && !steps.includes('cap.start'); attempt += 1) {
      await Promise.resolve()
    }
    expect(steps).toContain('cap.start')
    const disposing = platform.dispose()
    release()

    await expect(mounting).rejects.toMatchObject({ code: 'runtime.disposed' })
    await disposing
    expect(steps).toEqual(['cap.start', 'cap.end', 'cap.unmount'])
    await expect(platform.mount(request('b'))).rejects.toMatchObject({ code: 'runtime.disposed' })
  })

  it('unmounts an application when dispose overlaps application.mount', async () => {
    let release!: () => void
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    const steps: string[] = []
    const platform = createSubPlatform({
      applicationCode: 'member',
      createApplication() {
        steps.push('create')
        return application({
          async mount() {
            steps.push('app.mount.start')
            await gate
            steps.push('app.mount.end')
          },
          unmount() {
            steps.push('app.unmount')
          },
        })
      },
    })

    const mounting = platform.mount(request('a'))
    for (let attempt = 0; attempt < 10 && !steps.includes('app.mount.start'); attempt += 1) {
      await Promise.resolve()
    }
    expect(steps).toContain('app.mount.start')
    const disposing = platform.dispose()
    release()

    await expect(mounting).rejects.toMatchObject({ code: 'runtime.disposed' })
    await disposing
    expect(steps).toEqual(['create', 'app.mount.start', 'app.mount.end', 'app.unmount'])
  })
})
