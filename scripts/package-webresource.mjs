import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import packageJson from '../package.json' with { type: 'json' }

const packageRoot = resolve('package/webresources/Tela_GerarPagantes')
const distIndex = resolve('dist/index.html')
const versionSuffix = `?v=${encodeURIComponent(packageJson.version)}`
const indexHtml = await readFile(distIndex, 'utf8')
await writeFile(distIndex, indexHtml
  .replace('./assets/gerar-pagantes.js', `./assets/gerar-pagantes.js${versionSuffix}`)
  .replace('./assets/gerar-pagantes.css', `./assets/gerar-pagantes.css${versionSuffix}`))
await rm(resolve('package'), { recursive: true, force: true })
await mkdir(packageRoot, { recursive: true })
await cp(resolve('dist'), packageRoot, { recursive: true })
await cp(resolve('webresources/Script_GerarPagantes.js'), resolve('package/webresources/Tela_Script_GerarPagantes.js'))
await cp(resolve('webresources/Script_GerarPagantes.js'), resolve('package/webresources/Script_AbrirTelaGerarPagantes.js'))
await cp(resolve('dataverse'), resolve('package/dataverse'), { recursive: true })
await cp(resolve('src/Plugins'), resolve('package/plugins'), { recursive: true })
