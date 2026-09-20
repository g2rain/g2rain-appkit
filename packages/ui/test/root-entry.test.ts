import { describe, expect, it } from 'vitest'
import * as root from '../src/index'

describe('ui root entry', () => {
  it('does not export organization, dictionary or status components', () => {
    const names = Object.keys(root)
    for (const name of ['OrganSelect', 'DictText', 'StatusSwitch', 'DictSelect', 'G2rainDataProviders', 'G2rainPlatformUi']) {
      expect(names).not.toContain(name)
    }
  })
})
