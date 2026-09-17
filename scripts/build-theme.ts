import { cp, mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

const packageRoot = resolve(import.meta.dirname, '..', 'packages', 'theme')
const sourceDir = resolve(packageRoot, 'src')
const outputDir = resolve(packageRoot, 'dist')

await rm(outputDir, { recursive: true, force: true })
await mkdir(outputDir, { recursive: true })
await cp(sourceDir, outputDir, { recursive: true })
