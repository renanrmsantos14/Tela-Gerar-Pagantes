import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const sourcePath = process.argv[2]
if (!sourcePath) throw new Error('Informe o arquivo JSON exportado com o modelo de e-mail.')

const targetPath = resolve('power-automate/FlowGerarPagantesHttp-9DC91A2F-058F-4645-88C5-AB7A0AFB731F.json')
const source = JSON.parse(await readFile(resolve(sourcePath), 'utf8')).serializedValue
const target = JSON.parse(await readFile(targetPath, 'utf8'))
const sourceActions = source.actions
const conditionActions = target.properties.definition.actions.Condition_Tem_Link.actions.Apply_to_each_Pagante.actions.Condition_Enviar_Email.actions

const findAction = (prefix) => {
  const entry = Object.entries(sourceActions).find(([name]) => name.startsWith(prefix))
  if (!entry) throw new Error(`Ação do modelo não encontrada: ${prefix}`)
  return structuredClone(entry[1])
}

const repairText = (value) => /Ã|Â/.test(value) ? Buffer.from(value, 'latin1').toString('utf8') : value
const sharePointAction = (prefix, runAfter) => {
  const action = findAction(prefix)
  action.runAfter = runAfter
  delete action.metadata
  return action
}
const composeDataUri = (getAction, runAfter) => ({
  type: 'Compose',
  inputs: `@dataUri(body('${getAction}'))`,
  runAfter
})

conditionActions.Compose_Primeira_Data_Servico = {
  type: 'Compose',
  inputs: "@if(empty(body('Parse_JSON_Payload')?['serviceStartDate']), '', formatDateTime(body('Parse_JSON_Payload')?['serviceStartDate'], 'dd/MM/yyyy'))",
  runAfter: {}
}
conditionActions.Compose_Ultima_Data_Servico = {
  type: 'Compose',
  inputs: "@if(or(empty(body('Parse_JSON_Payload')?['serviceEndDate']), equals(body('Parse_JSON_Payload')?['serviceEndDate'], body('Parse_JSON_Payload')?['serviceStartDate'])), '', concat('- ', formatDateTime(body('Parse_JSON_Payload')?['serviceEndDate'], 'dd/MM/yyyy')))",
  runAfter: { Compose_Primeira_Data_Servico: ['Succeeded'] }
}

const imageSteps = [
  ['Get_Imagem_Icone_Financeiro', 'Get_file_content_icone_financeiro', 'Compose_Imagem_Icone_Financeiro'],
  ['Get_Imagem_Conte_Viagem', 'Get_file_content_conte_como_foi_a_viagem', 'Compose_Imagem_Conte_Viagem'],
  ['Get_Imagem_Instrucoes', 'Get_file_content_instrucoes', 'Compose_Imagem_Instrucoes'],
  ['Get_Imagem_Instrucoes_Cabecalho', 'Get_file_content_instrucoes_cabecalho', 'Compose_Imagem_Instrucoes_Cabecalho'],
  ['Get_Imagem_Cabecalho', 'Get_file_content_cabecalho', 'Compose_Imagem_Cabecalho'],
  ['Get_Imagem_Icone_Operacional', 'Get_file_content_icone_operacional', 'Compose_Imagem_Icone_Operacional'],
  ['Get_Imagem_Icone_Comercial', 'Get_file_content_icone_comercial', 'Compose_Imagem_Icone_Comercial']
]

let previous = 'Compose_Ultima_Data_Servico'
for (const [getName, sourcePrefix, composeName] of imageSteps) {
  conditionActions[getName] = sharePointAction(sourcePrefix, { [previous]: ['Succeeded'] })
  conditionActions[getName].inputs.host = {
    apiId: '/providers/Microsoft.PowerApps/apis/shared_sharepointonline',
    operationId: 'GetFileContent',
    connectionName: 'shared_sharepointonline'
  }
  conditionActions[composeName] = composeDataUri(getName, { [getName]: ['Succeeded'] })
  previous = composeName
}

conditionActions.Compose_Valor_Formatado = {
  type: 'Compose',
  inputs: "@concat('R$ ', replace(formatNumber(div(float(coalesce(items('Apply_to_each_Pagante')?['amountCents'], 0)), 100), '0.00'), '.', ','))",
  runAfter: { [previous]: ['Succeeded'] }
}

const sourceEmail = findAction('Send_an_email_')
let body = repairText(sourceEmail.inputs.parameters['emailMessage/Body'])
const replacements = new Map([
  ["@{triggerBody()?['text_1']}", "@{items('Apply_to_each_Pagante')?['name']}"],
  ["@{outputs('Get_a_row_by_ID_PAG')?['body/cr40f_id']}", "@{body('Parse_JSON_Payload')?['financeiroDisplayId']}"],
  ["@{triggerBody()?['text_2']}", "@{body('Parse_JSON_Payload')?['financeiroDisplayId']}"],
  ["@{outputs('Compose_Dia_do_Primeiro_Serviço')}", "@{outputs('Compose_Primeira_Data_Servico')}"],
  ["@{outputs('Compose_ultima_data_de_serv_com_\"-\"_+_formatação')}", "@{outputs('Compose_Ultima_Data_Servico')}"],
  ["@{outputs('Compose_SHORT_LINK')}", "@{body('HTTP_Gerar_Link_Cielo')?['shortUrl']}"],
  ["@{outputs('Compose_valor_para_formato_moeda')}", "@{outputs('Compose_Valor_Formatado')}"],
  ["@{outputs('Compose_cabecalho')}", "@{outputs('Compose_Imagem_Cabecalho')}"],
  ["@{outputs('Compose_instrucoes_cabecalho')}", "@{outputs('Compose_Imagem_Instrucoes_Cabecalho')}"],
  ["@{outputs('Compose_instrucoes')}", "@{outputs('Compose_Imagem_Instrucoes')}"],
  ["@{outputs('Compose_conte_como_foi_a_viagem')}", "@{outputs('Compose_Imagem_Conte_Viagem')}"],
  ["@{outputs('Compose_icone_financeiro')}", "@{outputs('Compose_Imagem_Icone_Financeiro')}"],
  ["@{outputs('Compose_icone_operacional')}", "@{outputs('Compose_Imagem_Icone_Operacional')}"],
  ["@{outputs('Compose_icone_comercial')}", "@{outputs('Compose_Imagem_Icone_Comercial')}"]
])
for (const [from, to] of replacements) body = body.replaceAll(from, to)

conditionActions.Send_Email_Link_Pagamento.inputs.parameters = {
  'emailMessage/To': "noreply@betinhos.onmicrosoft.com;financeiro@betinhos.com.br;junior@betinhos.com.br;@{items('Apply_to_each_Pagante')?['email']}",
  'emailMessage/Subject': "Link de Pagamento @{body('Parse_JSON_Payload')?['financeiroDisplayId']} para @{items('Apply_to_each_Pagante')?['name']} | Betinhos Executive Service",
  'emailMessage/Body': body,
  'emailMessage/From': 'noreply@betinhos.com.br',
  'emailMessage/ReplyTo': 'financeiro@betinhos.com.br',
  'emailMessage/Importance': 'Normal'
}
conditionActions.Send_Email_Link_Pagamento.runAfter = { Compose_Valor_Formatado: ['Succeeded'] }

target.properties.connectionReferences.shared_sharepointonline = {
  api: { name: 'shared_sharepointonline' },
  connection: { connectionReferenceLogicalName: 'new_sharedsharepointonline_40934' },
  runtimeSource: 'embedded'
}

await writeFile(targetPath, `${JSON.stringify(target, null, 2)}\n`, 'utf8')
