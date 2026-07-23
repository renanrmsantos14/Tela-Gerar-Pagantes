import { cp, mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

const packageRoot = resolve('package/webresources/Tela_GerarPagantes')
await rm(resolve('package'), { recursive: true, force: true })
await mkdir(packageRoot, { recursive: true })
await cp(resolve('dist'), packageRoot, { recursive: true })
await cp(resolve('webresources/Script_GerarPagantes.js'), resolve('package/webresources/Tela_Script_GerarPagantes.js'))
await cp(resolve('webresources/Script_GerarPagantes.js'), resolve('package/webresources/Script_AbrirTelaGerarPagantes.js'))
await cp(resolve('dataverse'), resolve('package/dataverse'), { recursive: true })
await cp(resolve('src/Plugins'), resolve('package/plugins'), { recursive: true })
