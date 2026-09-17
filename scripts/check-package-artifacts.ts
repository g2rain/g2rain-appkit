import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

type ExportValue = string | { types?: string; import?: string; default?: string }

const packages = ['theme', 'ui', 'http', 'runtime'] as const
const failures: string[] = []

for (const packageName of packages) {
  const packageRoot = resolve(process.cwd(), 'packages', packageName)
  const manifestPath = resolve(packageRoot, 'package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    exports?: Record<string, ExportValue>
  }

  for (const [entry, value] of Object.entries(manifest.exports ?? {})) {
    const targets = typeof value === 'string'
      ? [value]
      : [value.types, value.import, value.default].filter(
          (target): target is string => typeof target === 'string',
        )

    for (const target of targets) {
      const targetPath = resolve(packageRoot, target)
      try {
        await stat(targetPath)
      } catch {
        failures.push(`${packageName}: ${entry} points to missing ${target}`)
      }
    }
  }
}

const themeStyles = await readFile(
  resolve(process.cwd(), 'packages/theme/dist/styles.css'),
  'utf8',
)
const expectedImports = [
  "@import './tokens.css';",
  "@import './themes/light.css';",
  "@import './themes/dark.css';",
  "@import './element-plus.css';",
  "@import './base.css';",
]

let lastIndex = -1
for (const expected of expectedImports) {
  const index = themeStyles.indexOf(expected)
  if (index <= lastIndex) {
    failures.push(`theme: styles.css import order is invalid at ${expected}`)
  }
  lastIndex = index
}

if (failures.length > 0) {
  throw new Error(`Package artifact validation failed:\n${failures.join('\n')}`)
}

console.log('Package artifact validation passed.')

