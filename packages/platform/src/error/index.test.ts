import { describe, expect, it, vi } from 'vitest'
import { PlatformError } from '../contract/error.js'
import { createErrorCapability, normalizeError } from './index.js'

describe('normalizeError', () => {
  it('keeps http fields and drops sensitive context', () => {
    const error = Object.assign(new Error('gateway failed'), {
      source: 'backend',
      code: 'DEMO_FAILED',
      status: 400,
      requestId: 'request-1',
      retryable: false,
      requestTime: '2026-09-19T00:00:00Z',
      errorCode: 'DEMO_FAILED',
      context: {
        token: 'secret-token',
        tokenKid: 'kid',
        client: { privateKey: 'do-not-keep' },
        accessToken: 'secret-token',
        organId: 'org-1',
      },
    })

    const normalized = normalizeError(error)

    expect(normalized).toMatchObject({
      source: 'backend',
      code: 'DEMO_FAILED',
      backendCode: 'DEMO_FAILED',
      status: 400,
      requestId: 'request-1',
      retryable: false,
      requestTime: '2026-09-19T00:00:00Z',
      message: 'gateway failed',
    })
    expect(normalized.context).toEqual({ organId: 'org-1' })
    expect(JSON.stringify(normalized)).not.toContain('secret-token')
    expect(JSON.stringify(normalized)).not.toContain('do-not-keep')
  })
})

describe('createErrorCapability', () => {
  it('degrades the message without i18n and does not replace the original when adapters fail', async () => {
    const presenter = vi.fn(() => {
      throw new Error('presenter failed')
    })
    const reporter = vi.fn(() => {
      throw new Error('reporter failed')
    })
    const actions = {
      handle: vi.fn(() => {
        throw new Error('action failed')
      }),
    }
    const capability = createErrorCapability({
      presenter: { present: presenter },
      reporter: { report: reporter },
      actions,
      policy: { resolve: () => ({ action: 'retry', present: true, report: true }) },
    })

    const result = await capability.handle(new Error(''))

    expect(result).toBeInstanceOf(PlatformError)
    expect(result.message).toBe('')
    expect(presenter).toHaveBeenCalledWith(result, 'Unknown error')
    expect(reporter).toHaveBeenCalledWith(result)
    expect(actions.handle).toHaveBeenCalledWith('retry', result)
  })

  it('uses backend code before the unknown text and translates when i18n is wired', async () => {
    const presenter = vi.fn()
    const coded = createErrorCapability({ presenter: { present: presenter } })
    await coded.handle({ source: 'backend', code: 'DEMO_FAILED', status: 400, message: '' })
    expect(presenter).toHaveBeenCalledWith(expect.any(PlatformError), 'DEMO_FAILED')

    const translated = vi.fn()
    const i18n = createErrorCapability({
      presenter: { present: translated },
      translate: key => (key === 'ERR_DEMO' ? '已翻译' : ''),
      policy: { resolve: () => ({ messageKey: 'ERR_DEMO' }) },
    })
    await i18n.handle(new Error('raw'))
    expect(translated).toHaveBeenCalledWith(expect.any(PlatformError), '已翻译')
    expect(i18n.dependsOn).toEqual(['i18n'])
  })
})
