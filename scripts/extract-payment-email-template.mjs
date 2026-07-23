import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const flowPath = resolve('power-automate/FlowGerarPagantesHttp-9DC91A2F-058F-4645-88C5-AB7A0AFB731F.json')
const outputPath = resolve('assets/email/payment-email-template.html')
const flow = JSON.parse(await readFile(flowPath, 'utf8'))

const findAction = (actions, name) => {
  for (const [actionName, action] of Object.entries(actions ?? {})) {
    if (actionName === name) return action
    const nested = findAction(action.actions, name) ?? findAction(action.else?.actions, name)
    if (nested) return nested
  }
  return null
}

const action = findAction(flow.properties?.definition?.actions, 'Send_Email_Link_Pagamento')
if (!action) throw new Error('Ação Send_Email_Link_Pagamento não encontrada no Flow.')

let template = action.inputs?.parameters?.['emailMessage/Body']
if (typeof template !== 'string' || !template.trim()) throw new Error('HTML do e-mail não encontrado no Flow.')

const replacements = new Map([
  ["@{items('Apply_to_each_Pagante')?['name']}", '{{PAYER_NAME}}'],
  ["@{outputs('Compose_Primeira_Data_Servico')}", '{{SERVICE_START_DATE}}'],
  ["@{outputs('Compose_Ultima_Data_Servico')}", '{{SERVICE_END_DATE}}'],
  ["@{outputs('Compose_Valor_Formatado')}", '{{AMOUNT}}'],
  ["@{body('HTTP_Gerar_Link_Cielo')?['shortUrl']}", '{{PAYMENT_URL}}'],
  ["@{outputs('Compose_Imagem_Cabecalho')}", 'cid:header'],
  ["@{outputs('Compose_Imagem_Instrucoes_Cabecalho')}", 'cid:instructions-header'],
  ["@{outputs('Compose_Imagem_Instrucoes')}", 'cid:instructions'],
  ["@{outputs('Compose_Imagem_Conte_Viagem')}", 'cid:trip-feedback'],
  ["@{outputs('Compose_Imagem_Icone_Financeiro')}", 'cid:finance-icon'],
  ["@{outputs('Compose_Imagem_Icone_Operacional')}", 'cid:operations-icon'],
  ["@{outputs('Compose_Imagem_Icone_Comercial')}", 'cid:commercial-icon']
])

for (const [from, to] of replacements) template = template.replaceAll(from, to)
if (/@\{/.test(template)) throw new Error('O template ainda contém expressão não convertida do Power Automate.')

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${template.trim()}\n`, 'utf8')
console.log(`Template extraído para ${outputPath}`)
