import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string) =>
  readFile(resolve(import.meta.dirname, '..', 'src', path), 'utf8')

describe('@g2rain/theme', () => {
  it('loads both themes in the stable order', async () => {
    const css = await source('styles.css')
    expect(css).toContain("@import './themes/light.css';")
    expect(css).toContain("@import './themes/dark.css';")
    expect(css.indexOf('light.css')).toBeLessThan(css.indexOf('dark.css'))
  })

  it('defines required semantic variables for both themes', async () => {
    for (const file of ['themes/light.css', 'themes/dark.css']) {
      const css = await source(file)
      expect(css).toContain('--g2-color-primary:')
      expect(css).toContain('--g2-text-primary:')
      expect(css).toContain('--g2-bg-page:')
      expect(css).toContain('--g2-bg-container:')
      expect(css).toContain('--g2-border-color:')
    }
  })
})

