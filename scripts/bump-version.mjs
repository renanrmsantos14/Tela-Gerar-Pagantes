import { readFile, writeFile } from 'node:fs/promises'

const packagePath = new URL('../package.json', import.meta.url)
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
const [major, minor, patch] = packageJson.version.split('.').map(Number)
packageJson.version = `${major}.${minor}.${patch + 1}`
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`)

const lockPath = new URL('../package-lock.json', import.meta.url)
const lockJson = JSON.parse(await readFile(lockPath, 'utf8'))
lockJson.version = packageJson.version
if (lockJson.packages?.['']) lockJson.packages[''].version = packageJson.version
await writeFile(lockPath, `${JSON.stringify(lockJson, null, 2)}\n`)
