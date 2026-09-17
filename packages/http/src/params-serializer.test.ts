import { describe, expect, it } from 'vitest'
import { defaultParamsSerializer } from './params-serializer.js'

describe('defaultParamsSerializer', () => {
  it('sorts encoded values, repeats array keys, omits null values and retains colons', () => {
    expect(defaultParamsSerializer({ z: ['b', 'a'], ignored: null, time: '2026-09-13T10:00:00', a: '!'}))
      .toBe('a=%21&time=2026-09-13T10:00:00&z=a&z=b')
  })
})
